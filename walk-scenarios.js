// 场景走查脚本：在模拟的 dsh 事件管线上，把每个场景的候选链完整走完——
// 消息进来 → 分类 → pre-step 定路由 → request 注入主用模型 → 上游失败逐级回退 → 链尾。
// 运行：node walk-scenarios.js
import { apply, ROUTES } from './index.js'
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

const lines = []
let failed = 0
for (const { tag, message } of SCENARIOS) {
  try {
    const h = createHarness({ defaultSelection: COMPOSER_DEFAULT })
    apply(h.ctx, { enabled: true })
    await h.flush()
    const agent = { id: 'walk-' + tag, options: { provider: 'test' }, session: { requestHeader: () => ({ config: null }) } }
    await h.fire('agent/pre-step', { agent, messages: userMessage(message), signal: {} })
    const chain = ROUTES[tag]
    const walked = []
    for (let i = 0; i < chain.length; i++) {
      const config = await h.request(agent)
      if (config.model !== chain[i]) throw new Error(`第 ${i + 1} 个候选期望 ${chain[i]}，实际 ${config.model}`)
      walked.push(config.model)
      if (i < chain.length - 1) {
        const retry = await h.fire('agent/request-error', { agent, failure: TRANSIENT })
        if (!retry || retry.kind !== 'retry') throw new Error(`第 ${i + 1} 次失败应触发回退，实际 ${JSON.stringify(retry)}`)
      }
    }
    const exhausted = await h.fire('agent/request-error', { agent, failure: TRANSIENT }, async () => 'EXHAUSTED')
    if (exhausted !== 'EXHAUSTED') throw new Error('链走完后不应再切换模型')
    lines.push(`☑ ${tag.padEnd(16)} ${message.padEnd(26)} → ${walked.join(' → ')}`)
  } catch (error) {
    failed += 1
    lines.push(`✗ ${tag.padEnd(16)} ${message.padEnd(26)} → 失败：${error.message}`)
  }
}

console.log('')
console.log('场景 → 模型链 走查（模拟每次主用模型上游失败，验证逐级回退到链尾）')
console.log('─'.repeat(92))
for (const line of lines) console.log(line)
console.log('─'.repeat(92))
console.log(`共 ${SCENARIOS.length} 个场景：${SCENARIOS.length - failed} 个完整走完${failed ? `，${failed} 个失败` : '，全部通过'}`)
if (failed) process.exitCode = 1