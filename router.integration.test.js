// 端到端集成测试：在模拟的 dsh 事件管线上，把每个场景的候选链完整走完。
// 一个场景 = 消息进来 → 分类 → pre-step 决定会话路由 → request 注入主用模型
// → 上游失败(request-error)按顺序回退 → 直到链尾(不再切换，透传 next)。
import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, ROUTES, DEFAULT_POOL, SCHEMA_VERSION } from './index.js'
import { createHarness, userMessage } from './harness.js'

const TRANSIENT = { code: 'UPSTREAM_UNAVAILABLE', message: 'temporarily unavailable' }
const COMPOSER_DEFAULT = { model: 'gpt-5.6-luna', provider: 'test' }

const SCENARIOS = [
  { tag: 'coding', message: '开发一个消费者权益系统' },
  { tag: 'project_planning', message: '设计一个电商系统的技术架构' },
  { tag: 'plugin_discovery', message: '请找一个能解析日志的插件' },
  { tag: 'code_diff', message: '对比一下这两个分支的改动' },
  { tag: 'code_review', message: '帮我审查这段代码的安全漏洞' },
  { tag: 'reasoning', message: '解决一道数论证明题' },
  { tag: 'daily', message: '什么是微服务' },
  { tag: 'fast', message: '批量提取 5000 条文本的关键词' },
  { tag: 'multimodal', message: '识别这张截图里的表格' },
  { tag: 'long_context', message: '总结这份两万字的会议纪要' },
]

async function boot(options = {}) {
  const h = createHarness({ defaultSelection: COMPOSER_DEFAULT, ...options })
  apply(h.ctx, { enabled: true })
  await h.flush()
  return h
}

function agentOf(id, header) {
  return { id, options: { provider: 'test' }, session: { requestHeader: () => (header || { config: null }) } }
}

for (const { tag, message } of SCENARIOS) {
  test(`[walk] ${tag}: ${ROUTES[tag].join(' → ')} 完整走完`, async () => {
    const h = await boot()
    const agent = agentOf('agent-' + tag)
    await h.fire('agent/pre-step', { agent, messages: userMessage(message), signal: {} })

    // 上一步 pre-step 已按场景定好路由：首候选就是该场景链的第一位
    const view0 = await h.getView()
    assert.equal(view0.latest.tag, tag, `${tag}: 场景标签来自本地分类/裁判`)
    assert.equal(view0.latest.model, ROUTES[tag][0], `${tag}: 主用模型应为链头`)

    // 逐级走完整条候选链：先打真请求验证注入模型，再注入上游失败触发回退
    const chain = ROUTES[tag]
    const walked = []
    for (let i = 0; i < chain.length; i++) {
      const config = await h.request(agent)
      assert.equal(config.model, chain[i], `${tag} 第 ${i + 1} 个候选应注入 ${chain[i]}`)
      walked.push(config.model)
      if (i < chain.length - 1) {
        const retry = await h.fire('agent/request-error', { agent, failure: TRANSIENT })
        assert.deepEqual(retry, { kind: 'retry' }, `${tag} 第 ${i + 1} 次失败应触发回退`)
      }
    }
    // 链已走完：再失败必须放弃（调用 next 透传），不允许再切换模型
    const exhausted = await h.fire('agent/request-error', { agent, failure: TRANSIENT }, async () => 'EXHAUSTED')
    assert.equal(exhausted, 'EXHAUSTED', `${tag} 链走完后不应再切换模型`)
    console.log(`[walk] ${tag} ☑ ${walked.join(' → ')} 完整走完`)
  })
}

test('[skip] 主用模型不可用时，pre-step 直接落到下一个可用候选', async () => {
  const h = await boot({ unusableModels: ['glm-5.2'] })
  const agent = agentOf('skip-head')
  await h.fire('agent/pre-step', { agent, messages: userMessage('开发一个消费者权益系统'), signal: {} })
  const view0 = await h.getView()
  assert.equal(view0.latest.model, 'deepseek-v4-pro-0813', 'GLM-5.2 不可用时应跳过链头')
  const config = await h.request(agent)
  assert.equal(config.model, 'deepseek-v4-pro-0813')
})

test('[judge] 低置信度消息由裁判模型定场景并走对应链', async () => {
  const h = await boot({ judgeTag: 'reasoning' })
  const agent = agentOf('judge')
  // 无任何关键词命中 → 本地置信度 0.25 → 触发裁判
  await h.fire('agent/pre-step', { agent, messages: userMessage('近期关于消费者权益的新规定'), signal: {} })
  const view0 = await h.getView()
  assert.equal(view0.latest.tag, 'reasoning')
  assert.equal(view0.latest.judged, true, '该次分类应标记为裁判判定')
  const config = await h.request(agent)
  assert.equal(config.model, 'deepseek-v4-pro-0813', '应走 reasoning 链头')
})

test('[manual] 用户手动选择的模型保持第一顺位，失败后按剩余链回退', async () => {
  const h = await boot()
  const agent = agentOf('manual')
  await h.fire('agent/pre-step', { agent, messages: userMessage('开发一个消费者权益系统'), signal: {} })
  const manual = await h.request(agent, { model: 'qwen3.8-max', provider: 'test' })
  assert.equal(manual.model, 'qwen3.8-max', '手动选择必须原样保留')
  await h.fire('agent/request-error', { agent, failure: TRANSIENT })
  const fallback = await h.request(agent)
  assert.equal(fallback.model, 'glm-5.2', '手动模型失败后应回到 coding 链的 GLM-5.2')
})

test('[persisted] 会话持久化的非默认模型保持第一顺位', async () => {
  const h = await boot()
  const agent = agentOf('persisted', { config: { provider: 'test', model: 'qwen3.8-max' } })
  await h.fire('agent/pre-step', { agent, messages: userMessage('开发一个消费者权益系统'), signal: {} })
  const first = await h.request(agent)
  assert.equal(first.model, 'qwen3.8-max', '持久化模型应优先')
  await h.fire('agent/request-error', { agent, failure: TRANSIENT })
  const fallback = await h.request(agent)
  assert.equal(fallback.model, 'glm-5.2', '持久化模型失败后应回到链上候选')
})

test('[tool-loop] 首轮选择 GLM 后，后续工具续轮透传 DSH 请求配置', async () => {
  const h = await boot({ defaultSelection: { model: 'deepseek-v4-pro-0813', provider: 'test' } })
  const agent = agentOf('tool-loop')
  await h.fire('agent/pre-step', { agent, messages: userMessage('开发一个消费者权益系统'), signal: {} })
  const first = await h.request(agent)
  assert.deepEqual(first, { model: 'glm-5.2', provider: 'test' }, '首轮仍应由场景路由选择 GLM-5.2')
  const continuation = await h.request(agent)
  assert.deepEqual(continuation, { model: 'deepseek-v4-pro-0813', provider: 'test' }, '工具续轮不得再次覆盖 DSH 请求配置')
})

test('[retry-policy] 参数校验类失败不重试，直接透传且不切换模型', async () => {
  const h = await boot()
  const agent = agentOf('validation')
  await h.fire('agent/pre-step', { agent, messages: userMessage('开发一个消费者权益系统'), signal: {} })
  const first = await h.request(agent)
  assert.equal(first.model, 'glm-5.2')
  const failure = { code: 'InvalidParameter', message: 'validation error for Message.function_call.arguments: Input should be a valid string' }
  const outcome = await h.fire('agent/request-error', { agent, failure }, async () => 'NO-RETRY')
  assert.equal(outcome, 'NO-RETRY', '校验错误不应重试')
  const again = await h.request(agent)
  assert.equal(again.model, COMPOSER_DEFAULT.model, '未发生回退，后续请求应透传 DSH 配置')
})

test('[migration] 旧版持久化（无 schemaVersion）自动升级为新默认映射', async () => {
  const oldRoutes = {}
  for (const tag of Object.keys(ROUTES)) oldRoutes[tag] = ['deepseek-v4-flash-0731']
  const h = await boot({
    userSettings: {
      pool: [{ id: 'deepseek-v4-flash-0731', role: '国产主力', enabled: true, provider: '' }],
      routes: oldRoutes,
      judgeModel: '',
      // 故意不写 schemaVersion —— 模拟 0.2.x 的持久化
    },
  })
  await h.flush()
  assert.ok(h.replaces.length >= 1, '旧版应触发一次自动收敛写回')
  const last = h.replaces[h.replaces.length - 1]
  assert.equal(last.schemaVersion, SCHEMA_VERSION)
  assert.equal(last.routes.coding[0], 'glm-5.2', '新默认：coding 链头为 GLM-5.2')
  assert.equal(last.routes.long_context[0], 'qwen3.8-max', '新默认：long_context 链头为 qwen-max')
  const view0 = await h.getView()
  assert.equal(view0.customized, false)
})

test('[customized] 已定制（带正确 schemaVersion）的配置不被覆盖', async () => {
  const custom = {}
  for (const tag of Object.keys(ROUTES)) custom[tag] = [...ROUTES[tag]]
  custom.coding = ['qwen3.8-max', 'glm-5.2']
  const h = await boot({
    userSettings: {
      pool: DEFAULT_POOL.map((item) => ({ ...item })),
      routes: custom,
      judgeModel: '',
      schemaVersion: SCHEMA_VERSION,
    },
  })
  await h.flush()
  assert.equal(h.replaces.length, 0, '已定制且版本一致时不应写回覆盖')
  const agent = agentOf('custom')
  await h.fire('agent/pre-step', { agent, messages: userMessage('开发一个消费者权益系统'), signal: {} })
  const config = await h.request(agent)
  assert.equal(config.model, 'qwen3.8-max', '应使用用户定制的 coding 链')
})

test('[http] /state 与 /update 接口工作正常并保留 schemaVersion', async () => {
  const h = await boot()
  const routes = {}
  for (const tag of Object.keys(ROUTES)) routes[tag] = [...ROUTES[tag]]
  const { status, body } = await h.postUpdate({
    pool: DEFAULT_POOL.map((item) => ({ ...item })),
    routes,
    judgeModel: '',
  })
  assert.equal(status, 200)
  assert.equal(body.customized, true)
  assert.equal(h.replaces[h.replaces.length - 1].schemaVersion, SCHEMA_VERSION, '保存时必须带规则表版本')
  const state = await h.getView()
  assert.equal(state.schemaVersion, SCHEMA_VERSION)
  assert.equal(state.routes.coding[0], 'glm-5.2')
})