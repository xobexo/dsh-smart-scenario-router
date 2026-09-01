import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

// ── 场景 → 模型默认映射（什么情景用什么模型）────────────────────────────
// 排序即回退顺序：首位为主用模型，其后为上游失败时的候选链。
// 设计原则：
//   · 深度编写 / 审查 / 架构 → GLM-5.2（中文代码能力最强、表达清晰）或 deepseek-v4-pro（深度推理）
//   · 轻量问答 / 抽取 / 分类 / 推荐 → deepseek-v4-flash（快、省）
//   · 复杂推理 / 科研 / 数学 → deepseek-v4-pro + qwen3.8-max（数学推理强）
//   · 视觉 / 图片 → qwen 系（多模态最强）
//   · 长文本 / 数据分析 → qwen3.8-max（长上下文 + 数据处理），deepseek-pro 兜底
//   · GPT 只作最后兜底：sol（强）兜深度任务，luna（轻）兜轻量任务
export const ROUTES = {
  // 架构设计 / 项目拆解：中文产品化规划表达最佳 → GLM-5.2 主用
  project_planning: ['glm-5.2', 'deepseek-v4-pro-0813', 'gpt-5.6-sol'],
  // 插件 / 工具推荐：检索推荐类轻量任务 → flash 主用，GLM 提升推荐质量
  plugin_discovery: ['deepseek-v4-flash-0731', 'glm-5.2', 'gpt-5.6-luna'],
  // 代码审查：需要深层次逻辑与安全漏洞洞察 → deepseek-pro 主用
  code_review: ['deepseek-v4-pro-0813', 'glm-5.2', 'gpt-5.6-sol'],
  // 变更对比：解释准确性优先 → GLM-5.2 主用，flash 快速兜底
  code_diff: ['glm-5.2', 'deepseek-v4-flash-0731', 'gpt-5.6-luna'],
  // 代码编写：GLM-5.2 代码能力 + 中文交互（用户首选）→ 主用
  coding: ['glm-5.2', 'deepseek-v4-pro-0813', 'gpt-5.6-sol'],
  // 复杂推理 / 科研 / Agent：深度推理主用，qwen-max 数学兜底
  reasoning: ['deepseek-v4-pro-0813', 'qwen3.8-max', 'gpt-5.6-sol'],
  // 日常对话 / 快速问答：轻量任务 → flash 主用（快、省），GLM 兜底质量
  daily: ['deepseek-v4-flash-0731', 'glm-5.2', 'gpt-5.6-luna'],
  // 极速高并发 / 批量抽取：快优先 → flash + luna
  fast: ['deepseek-v4-flash-0731', 'gpt-5.6-luna'],
  // 多模态：qwen 系视觉能力最强
  multimodal: ['qwen3.8-max', 'qwen3.7-max', 'gpt-5.6-sol'],
  // 长文本 / 数据分析：长上下文 + 数据处理 → qwen-max 主用，deepseek-pro 兜底
  long_context: ['qwen3.8-max', 'deepseek-v4-pro-0813', 'gpt-5.6-sol'],
}

// 规则表版本：升级默认映射 / 关键词时递增。已安装实例若持久化设置的
// schemaVersion 与当前不一致，视为“旧版自动规则”，会重新收敛为新默认值
//（用户手动定制过的配置不受影响，但 schemaVersion 会被更新）。
export const SCHEMA_VERSION = 2

const LABELS = {
  project_planning: '项目拆解 / 架构设计',
  plugin_discovery: '插件查找 / 工具推荐',
  code_review: '代码审查',
  code_diff: '代码变更对比',
  coding: '代码编写 / 调试',
  reasoning: '复杂推理 / 科研 / Agent',
  daily: '日常对话 / 快速问答',
  fast: '极速高并发 / 批量抽取',
  multimodal: '多模态（图文输入）',
  long_context: '长文本 / 数据分析',
}

export const DEFAULT_POOL = [
  { id: 'deepseek-v4-pro-0813', role: '国产主力', enabled: true, provider: '' },
  { id: 'deepseek-v4-flash-0731', role: '国产主力', enabled: true, provider: '' },
  { id: 'glm-5.2', role: '国产主力', enabled: true, provider: '' },
  { id: 'qwen3.8-max', role: '国产主力', enabled: true, provider: '' },
  { id: 'qwen3.7-max', role: '国产降级', enabled: true, provider: '' },
  { id: 'gpt-5.6-sol', role: '最后兜底', enabled: true, provider: '' },
  { id: 'gpt-5.6-luna', role: '最后兜底', enabled: true, provider: '' },
]

const ROUTER_NS = settingsNamespace('smart-scenario-router')
const RouterSettings = z.object({
  pool: z.array(z.object({
    id: z.string(),
    role: z.string(),
    enabled: z.boolean(),
    provider: z.string(),
  })).default(DEFAULT_POOL),
  routes: z.dict(z.array(z.string())).default(ROUTES),
  judgeModel: z.string().default(''),
  schemaVersion: z.number().default(SCHEMA_VERSION),
})

export const inject = ['llm', 'settings', 'webServer', 'agentDefaultModel']
export const Config = z.object({ enabled: z.boolean().default(true) })

function writeJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk.toString('utf8')
  if (raw === '') return {}
  return JSON.parse(raw)
}

function userText(messages) {
  let text = ''
  let image = false
  for (const message of messages || []) {
    if (!message || message.role !== 'user') continue
    for (const block of message.content || []) {
      if (block && block.type === 'text') text += block.text || ''
      if (block && block.type === 'image') image = true
    }
  }
  return { text, image }
}

// 场景识别得分上限：超过该值时不再调用裁判模型，直接采用本地分类。
const CONFIDENCE_CAP = 0.96
const JUDGE_THRESHOLD = 0.7

// 每个场景的双语关键词表。默认按“最先得分最高的规则”决胜（数组顺序即决胜顺序），
// 因此把 coding / project_planning 排在 daily 之前，避免“帮我写个系统”被通用词拖回日常。
const SCENARIO_RULES = [
  ['project_planning', ['架构', '架构设计', '技术方案', '系统设计', '项目拆解', '模块拆分', '里程碑', '技术选型', '设计方案', '需求分析', '概要设计', '接口设计', '数据库设计', 'roadmap', '技术栈', '原型', '规划']],
  ['coding', ['编写', '开发', '实现', '搭建', '构建', '修复', '调试', '编码', '代码', '函数', '方法', '接口', '类', '重构', '报错', '错误', '异常', '崩溃', 'bug', '前端', '后端', '数据库', 'sql', '查询', '脚本', '组件', '测试', '测试用例', '单元测试', 'typescript', 'javascript', 'python', 'golang', 'java', 'c++', 'k8s', 'docker', '部署', 'nginx', 'redis', 'grep', 'curl', '正则', '页面']],
  ['reasoning', ['推理', '逻辑', '证明', '数学', '方程', '微积分', '概率', '统计', '算法', '复杂度', '优化', '证明题', '定理', '推导', '科研', '论文', '实验设计', '假设', '因果', '深入分析', '权衡', 'agent', '多智能体', '工作流', '编排']],
  ['plugin_discovery', ['插件', '扩展', '工具推荐', '推荐工具', '工具查找', '找工具', '安装插件', '卸载插件', '插件市场', 'plugin', 'extension']],
  ['code_review', ['代码审查', '审查', '检查代码', '检查改动', 'review', '提交前检查', '找问题', '潜在问题', '安全漏洞', '代码质量', '最佳实践', '性能瓶颈', '漏洞']],
  ['code_diff', ['diff', 'git diff', '代码变更', '变更对比', '改动对比', '对比代码', '查看变更', '显示修改', '工作区', '分支', '提交记录', '变更记录']],
  ['fast', ['批量', '抽取', '提取', '高并发', '极速', '快速分类', '大量文本', '去重', '清洗', '批量处理']],
  ['multimodal', ['图片', '图像', '截图', '照片', '图文', '视觉', '看图', '识图', 'ocr', '扫描件', '表格图片']],
  ['long_context', ['长文本', '全文', '文档总结', '总结文档', '会议纪要', '数据分析', '数据集', '报表', '日志分析', '大文件', '知识库', '语料', '上下文']],
  ['daily', ['你好', '您好', '嗨', '谢谢', '感谢', '什么是', '是什么', '怎么做', '怎么用', '如何', '解释一下', '讲讲', '说说', '聊聊', '帮忙', '帮我', '快速问答', '在吗', '为什么']],
]

export function classify(messages) {
  const input = userText(messages)
  if (input.image || /图片|图像|截图|照片|图文|视觉|看图|识图|OCR|扫描件|表格图片/.test(input.text)) return { tag: 'multimodal', confidence: 0.98, judged: false }
  if (input.text.length > 12000) return { tag: 'long_context', confidence: 0.96, judged: false }
  const lower = input.text.toLowerCase().trim()

  // 纯打招呼 / 短句问候直接进入 daily（避免“你好”等被长句“你好，帮我写个脚本”误命中，
  // 因此这里的正则要求整条消息都是问候语）。
  if (/^(你好|您好|嗨|哈喽|hello|hi|hey|早上好|下午好|晚上好|在吗|谢谢|感谢|thanks|thank you|good morning|good afternoon)[，。！？!?\s]*$/.test(lower)) return { tag: 'daily', confidence: 0.92, judged: false }

  // ── 显式意图（最高优先级，确定性返回，不触发裁判）──
  const pluginIntent = /找(一个|个)?插件|插件(推荐|查找|搜索|列表)|推荐(一个|个)?[^\s，。:]{0,10}?(插件|工具|扩展)|有没有[^\s，。:]{0,12}?(插件|工具|扩展)|工具(推荐|查找|搜索|对比|评测)|扩展(推荐|查找)|安装(插件|扩展)|\bplugin\b|\bextension\b/.test(lower)
  if (pluginIntent) return { tag: 'plugin_discovery', confidence: 0.97, judged: false }

  const diffIntent = /当前(代码)?(更改|改动|修改)|工作区(修改|变更)|git\s*(diff|变更|修改)|diff|对比[^\s，。:]{0,10}?(代码|修改|改动|变更)|查看(当前)?(代码)?变更|显示(当前)?修改/.test(lower)
  if (diffIntent) return { tag: 'code_diff', confidence: 0.96, judged: false }

  const reviewIntent = /代码审查|审查(代码|变更)|检查(代码|改动)|review|提交前检查|找问题|潜在问题|安全漏洞|代码质量|最佳实践|性能瓶颈/.test(lower)
  if (reviewIntent) return { tag: 'code_review', confidence: 0.94, judged: false }

  // 架构 / 方案 / 规划类请求直接进入 project_planning（本质是设计决策，不是写代码）。
  const planningIntent = /(设计|规划|拆解|制定|输出)(一个|个)?[^\s，。:]{0,12}?(系统|方案|架构|项目|模块|里程碑|路线图|roadmap)/.test(lower)
  if (planningIntent) return { tag: 'project_planning', confidence: 0.95, judged: false }

  // 开发/实现/搭建/构建类请求直接进入 coding：这类请求若零关键词命中会落回 daily
  //（首位候选 deepseek-v4-flash-0731），从而无法命中以 GLM-5.2 为首的 coding 候选链。
  const devIntent = /(开发|实现|搭建|构建|编写|修复)(一个|个)?[^\s，。；：,.!?]{0,16}?(系统|应用|软件|网站|平台|小程序|插件|程序|项目|功能|模块|接口|页面|代码|\bapp\b|\bbug\b)|写(一个|个)?(系统|程序|脚本|工具|页面|网站|接口|代码)/.test(lower)
  if (devIntent) return { tag: 'coding', confidence: 0.96, judged: false }

  let best = 'daily'
  let bestScore = 0
  for (const rule of SCENARIO_RULES) {
    let score = 0
    for (const word of rule[1]) if (lower.includes(word.toLowerCase())) score += word.length > 3 ? 2 : 1
    if (score > bestScore) { best = rule[0]; bestScore = score }
  }
  return { tag: best, confidence: bestScore ? Math.min(CONFIDENCE_CAP, 0.52 + bestScore * 0.1) : 0.25, judged: false }
}

function source(model) { return model.indexOf('gpt-') === 0 ? '备用' : '国产' }

export function prioritizeRoute(first, routes) {
  if (!first) return routes.slice()
  const remaining = routes.filter((route) => route.model !== first.model || route.provider !== first.provider)
  return [first, ...remaining]
}

export function apply(ctx, config) {
  if (config && config.enabled === false) return
  const settings = ctx.settings.register(ROUTER_NS, RouterSettings, { base: { pool: DEFAULT_POOL } })
  const resolved = settings.get()
  let customized = false
  // staleSchema：用户层原始设置里没有 schemaVersion 键（旧版持久化），或版本号与
  // 当前规则表不一致。两种情况都视为“旧的自动默认规则”，允许重新收敛为新默认映射——否则
  // settings.get() 会用 schema 默认值补全缺失字段，导致旧版持久化被误判为“已是最新”。
  // 用户手动定制过的配置（带正确 schemaVersion）不受影响。
  let staleSchema = true
  try {
    const descriptor = (ctx.settings.describe ? ctx.settings.describe() : []).find((d) => d.ns === ROUTER_NS)
    const user = descriptor && descriptor.user && typeof descriptor.user === 'object' ? descriptor.user : null
    const userPool = user && Array.isArray(user.pool) ? user.pool : null
    const hasSchemaVersion = Boolean(user && Object.prototype.hasOwnProperty.call(user, 'schemaVersion'))
    staleSchema = !hasSchemaVersion || Number(user.schemaVersion) !== SCHEMA_VERSION
    // 空池不算已定制：用户层可能是旧版本误存的空池，应视为未配置并自动填充初始规则。
    customized = Boolean(userPool && userPool.length > 0) && !staleSchema
  } catch (_) {}
  const state = {
    pool: resolved.pool.map((item) => ({ ...item })),
    routes: Object.fromEntries(Object.entries(resolved.routes || {}).map(([tag, chain]) => [tag, chain.slice()])),
    judgeModel: resolved.judgeModel || '',
    providers: Object.create(null),
    providerCandidates: Object.create(null),
    available: Object.create(null),
    models: [],
    customized,
    converged: false,
    override: null,
    latest: { tag: 'daily', label: LABELS.daily, model: 'deepseek-v4-flash-0731', source: '国产', confidence: 0, judged: false },
    sessions: new Map(),
    loaded: false,
  }
  const llm = ctx.llm
  function defaultSelection() {
    return ctx.agentDefaultModel && ctx.agentDefaultModel.currentSelection ? ctx.agentDefaultModel.currentSelection() : null
  }
  function isDefaultConfig(config) {
    const current = defaultSelection()
    return Boolean(current && config && config.model === current.model && (!current.provider || !config.provider || config.provider === current.provider))
  }

  function rememberModel(id, provider) {
    if (!id || !provider) return
    const candidates = state.providerCandidates[id] || (state.providerCandidates[id] = [])
    if (!candidates.includes(provider)) candidates.push(provider)
    // Keep the first discovered provider as the automatic default. An explicit
    // pool provider still wins during candidate resolution below.
    if (!(id in state.providers)) state.providers[id] = provider
    state.available[provider + ':' + id] = true
    const entry = state.models.find((m) => m.id === id)
    if (entry) {
      if (!entry.provider) entry.provider = provider
    } else {
      state.models.push({ id, provider, source: source(id) })
    }
  }

  function scanSettingsModels() {
    try {
      const deepseek = ctx.settings.get ? ctx.settings.get('llm-deepseek') : null
      for (const model of (deepseek && deepseek.models) || []) {
        if (model && model.id) rememberModel(model.id, 'deepseek-official')
      }
    } catch (_) {}
    try {
      const pi = ctx.settings.get ? ctx.settings.get('llm-pi-ai') : null
      const providers = (pi && pi.providers) || {}
      for (const [provider, profile] of Object.entries(providers)) {
        if (!profile || typeof profile !== 'object') continue
        for (const model of (profile.models) || []) if (model && model.id) rememberModel(model.id, provider)
        for (const id of Object.keys(profile.modelOverrides || {})) rememberModel(id, provider)
      }
    } catch (_) {}
  }

  function modelFamily(id) {
    const match = /^(deepseek|glm|qwen|gpt)/i.exec(id || '')
    return match ? match[1].toLowerCase() : ''
  }

  function themeOf(id) {
    // 去掉末尾的日期/版本编号后缀（如 deepseek-v4-pro-0813 -> deepseek-v4-pro）。
    return String(id || '').replace(/-\d+$/, '')
  }

  function resolveDefaultModel(id) {
    // 1) 配置里有原名 -> 直接用原名。
    if (state.models.some((m) => m.id === id)) return id
    // 2) 按同系列（deepseek/glm/qwen/gpt）+ 主题名精确匹配真实配置的模型。
    const family = modelFamily(id)
    const theme = themeOf(id)
    const themeMatch = state.models.find((m) => modelFamily(m.id) === family && (m.id === theme || m.id.includes(theme) || theme.includes(m.id)))
    if (themeMatch) return themeMatch.id
    // 3) 同系列任意真实模型兜底。
    const fallback = state.models.find((m) => modelFamily(m.id) === family)
    return fallback ? fallback.id : id
  }

  function converge() {
    if (state.customized || state.converged) return false
    state.converged = true
    // 首次使用（或旧版规则表升级）把最开始的规则内容原样写入：不需要手动从下拉框添加。
    const pool = []
    for (const item of DEFAULT_POOL) {
      const id = resolveDefaultModel(item.id)
      const existing = pool.find((entry) => entry.id === id)
      if (existing) { if (!existing.provider) existing.provider = state.providers[id] || ''; continue }
      pool.push({ id, role: item.role, enabled: item.enabled, provider: item.provider || state.providers[id] || '' })
    }
    state.pool = pool
    const routes = {}
    for (const [tag, chain] of Object.entries(ROUTES)) {
      routes[tag] = chain.map((id) => resolveDefaultModel(id))
    }
    state.routes = routes
    return true
  }

  async function discover() {
    scanSettingsModels()
    if (converge()) {
      // 首次收敛自动写回设置（含规则表版本），清掉旧版本可能残留的空池 / 残缺候选链。
      try {
        await settings.replace({ pool: state.pool, routes: state.routes, judgeModel: state.judgeModel || '', schemaVersion: SCHEMA_VERSION })
      } catch (_) {}
    }
    if (state.loaded) return
    state.loaded = true
    try {
      for (const info of llm.listProviders() || []) {
        const provider = info && info.id
        if (!provider) continue
        try {
          for (const model of await llm.listModels(provider) || []) {
            if (!model || !model.id) continue
            state.providers[model.id] = provider
            state.available[provider + ':' + model.id] = true
            const entry = state.models.find((m) => m.id === model.id)
            if (entry) { if (!entry.provider) entry.provider = provider }
            else state.models.push({ id: model.id, provider, source: source(model.id) })
          }
        } catch (_) {}
      }
    } catch (_) {}
    converge()
  }

  function resolveJudgeId() {
    if (state.judgeModel) return state.judgeModel
    const flash = state.models.find((m) => m.id.toLowerCase().includes('flash'))
    if (flash) return flash.id
    return state.models.length ? state.models[0].id : ''
  }

  async function judge(messages, fallbackProvider, signal) {
    const model = resolveJudgeId()
    if (!model) return null
    const provider = state.providers[model] || fallbackProvider
    if (!provider) return null
    try {
      let output = ''
      for await (const chunk of llm.stream({ provider, model, messages, system: [
        '你是场景分类器。只输出一个场景标签，不要输出任何其他文字。可选标签：project_planning, plugin_discovery, code_review, code_diff, coding, reasoning, daily, fast, multimodal, long_context。',
        '规则：',
        '- 项目拆解 / 架构 / 技术方案 / 需求规划 → project_planning',
        '- 查找、推荐插件或工具 → plugin_discovery',
        '- 审查代码质量 / 漏洞 / 潜在问题 → code_review',
        '- 查看 Git diff / 当前代码变更 → code_diff',
        '- 编写、开发、实现、搭建、调试、修复代码或系统 → coding',
        '- 数学、逻辑推理、科研、论文、Agent / 工作流 → reasoning',
        '- 寒暄、闲聊、解释概念、简单问答、操作指导 → daily',
        '- 批量抽取、极速处理大量文本 → fast',
        '- 图片 / 截图 / 视觉理解 → multimodal',
        '- 超长文本、全文总结、数据分析、日志分析 → long_context',
        '示例：',
        '问：开发一个消费者权益系统 → coding',
        '问：这个函数为什么会报错 → coding',
        '问：设计一个电商系统的技术架构 → project_planning',
        '问：帮我审查这段代码的安全漏洞 → code_review',
        '问：看下当前分支的 git diff → code_diff',
        '问：找一个日志分析插件 → plugin_discovery',
        '问：解决一道数论证明题 → reasoning',
        '问：什么是 REST API → daily',
        '问：总结这份两万字的会议纪要 → long_context',
        '问：把这张截图里的表格整理成数据 → multimodal',
        '问：批量提取 5000 条文本的关键词 → fast',
        '只输出标签本身。',
      ].join('\n'), temperature: 0, maxTokens: 16, signal })) {
        if (chunk && chunk.type === 'text-delta') output += chunk.text || ''
        if (chunk && chunk.type === 'finish') break
      }
      const tag = Object.keys(ROUTES).find((candidate) => output.toLowerCase().includes(candidate))
      return tag ? { tag, confidence: 0.9, judged: true } : null
    } catch (_) { return null }
  }

  function view() {
    return {
      pool: state.pool.map((item) => ({ ...item })),
      routes: Object.fromEntries(Object.entries(state.routes).map(([tag, chain]) => [tag, chain.slice()])),
      latest: { ...state.latest },
      override: state.override,
      judgeModel: state.judgeModel,
      judgeResolved: resolveJudgeId(),
      threshold: 0.7,
      schemaVersion: SCHEMA_VERSION,
      models: state.models.map((m) => ({ ...m })),
      providers: Object.keys(state.providers).sort(),
      customized: state.customized,
    }
  }

  async function usable(provider, model, signal) {
    if (!provider || !model) return false
    const key = provider + ':' + model
    if (!llm.resolveCallConfig) return Boolean(state.available[key])
    try {
      await llm.resolveCallConfig({ provider, model }, signal)
      state.available[key] = true
      return true
    } catch (_) { return false }
  }

  async function resolveProviders(model, explicitProvider, fallbackProvider, signal) {
    const providers = []
    // An explicit provider is a deliberate route. Do not silently redirect it
    // to another provider serving the same model id.
    const candidates = explicitProvider ? [explicitProvider] : [ ...((state.providerCandidates[model]) || []), state.providers[model], fallbackProvider ]
    for (const provider of candidates) {
      if (provider && !providers.includes(provider)) providers.push(provider)
    }
    const usableProviders = []
    for (const provider of providers) if (await usable(provider, model, signal)) usableProviders.push(provider)
    return usableProviders
  }

  async function candidates(tag, fallbackProvider, signal) {
    const result = []
    const chain = (state.routes && state.routes[tag]) || []
    for (const model of chain) {
      if (!model) continue
      const item = state.pool.find((candidate) => candidate.id === model)
      if (item && !item.enabled) continue
      const providers = await resolveProviders(model, item && item.provider, fallbackProvider, signal)
      if (providers.length) result.push({ model, provider: providers[0], source: source(model) })
    }
    if (result.length) return result
    for (const item of state.pool) {
      if (!item.enabled) continue
      const providers = await resolveProviders(item.id, item.provider, fallbackProvider, signal)
      if (providers.length) return [{ model: item.id, provider: providers[0], source: source(item.id) }]
    }
    return []
  }

  function publish(result, route) {
    state.latest = { tag: result.tag, label: LABELS[result.tag] || result.tag, model: route.model, source: route.source, confidence: result.confidence, judged: result.judged }
  }

  void discover()
  const routes = []
  routes.push(ctx.webServer.register({
    kind: 'exact',
    path: '/smart-scenario-router/state',
    handler: async (_req, res) => {
      await discover()
      writeJson(res, 200, view())
    },
  }))
  routes.push(ctx.webServer.register({
    kind: 'exact',
    path: '/smart-scenario-router/update',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { error: 'method-not-allowed' })
      try {
        const args = await readJson(req)
        const pool = []
        for (const raw of Array.isArray(args.pool) ? args.pool : []) {
          if (!raw || typeof raw.id !== 'string') continue
          const id = raw.id.trim()
          if (!id || pool.some((item) => item.id === id)) continue
          const existing = state.pool.find((item) => item.id === id)
          pool.push({
            id,
            role: typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : (existing ? existing.role : '自定义'),
            enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
            provider: typeof raw.provider === 'string' ? raw.provider.trim() : '',
          })
        }
        const routesNext = {}
        for (const tag of Object.keys(ROUTES)) {
          const chain = args.routes && Array.isArray(args.routes[tag]) ? args.routes[tag] : (state.routes[tag] || [])
          routesNext[tag] = chain.filter((id) => typeof id === 'string').map((id) => id.trim())
        }
        const judgeModel = typeof args.judgeModel === 'string' ? args.judgeModel.trim() : state.judgeModel
        state.pool = pool
        state.routes = routesNext
        state.judgeModel = judgeModel
        state.customized = true
        state.converged = true
        await settings.replace({ pool, routes: routesNext, judgeModel, schemaVersion: SCHEMA_VERSION })
        return writeJson(res, 200, view())
      } catch (error) {
        return writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => () => { for (const dispose of routes) dispose() }, 'smart-scenario-router: HTTP routes')

  ctx.on('agent/pre-step', async (payload, next) => {
    const existing = state.sessions.get(payload.agent.id)
    if (existing) return next()
    const local = classify(payload.messages)
    const fallbackProvider = payload.agent && payload.agent.options && payload.agent.options.provider
    const result = local.confidence < 0.7 ? (await judge(payload.messages, fallbackProvider, payload.signal) || local) : local
    await discover()
    const routeList = await candidates(result.tag, fallbackProvider, payload.signal)
    const logged = payload.agent.session && payload.agent.session.requestHeader && payload.agent.session.requestHeader()
    const loggedProvider = logged && logged.config && (logged.config.provider || fallbackProvider)
    const persistedModel = logged && logged.config && logged.config.model && !isDefaultConfig(logged.config) ? logged.config.model : null
    const persisted = persistedModel && await usable(loggedProvider, persistedModel, payload.signal)
      ? { model: persistedModel, provider: loggedProvider, source: source(persistedModel) }
      : null
    const overrideProviders = state.override ? await resolveProviders(state.override, null, fallbackProvider, payload.signal) : []
    const overridden = overrideProviders.length
      ? { model: state.override, provider: overrideProviders[0], source: source(state.override) }
      : null
    const first = persisted || overridden || routeList[0]
    // A persisted/manual model stays first, but it must not destroy the
    // scenario fallback chain when its upstream later fails.
    const routesForSession = prioritizeRoute(first, routeList)
    state.sessions.set(payload.agent.id, {
      result,
      routes: routesForSession,
      index: 0,
      locked: Boolean(persisted),
      retrying: false,
      started: false,
    })
    if (first) publish(result, first)
    return next()
  })
  ctx.on('agent/request', async (payload, next) => {
    const config = await next()
    const route = state.sessions.get(payload.agent.id)
    const selected = route && route.routes[route.index]
    if (!route || !selected) return config
    if (route.retrying) {
      route.retrying = false
    } else if (route.started) {
      // DSH persists the selected provider/model and prepared adapter state in
      // the session request header. Tool-loop steps must pass that config
      // through unchanged; rewriting it here can break tool-call replay.
      return config
    } else if (!isDefaultConfig(config) && config.model && (config.model !== selected.model || (config.provider && selected.provider && config.provider !== selected.provider))) {
      // Keep the host model selector first, while preserving configured
      // fallbacks for upstream failures on later tool-loop steps.
      const manual = { model: config.model, provider: config.provider, source: source(config.model) }
      const remaining = route.routes.filter((candidate) => candidate.model !== manual.model || candidate.provider !== manual.provider)
      route.routes = [manual, ...remaining]
      route.index = 0
      publish(route.result, manual)
      return config
    }
    let usableRoute = selected
    while (usableRoute) {
      const providers = await resolveProviders(usableRoute.model, usableRoute.provider, config.provider, payload.signal)
      if (providers.length) {
        usableRoute = { ...usableRoute, provider: providers[0] }
        break
      }
      route.index += 1
      usableRoute = route.routes[route.index]
    }
    if (!usableRoute) return config
    if (usableRoute !== selected) publish(route.result, usableRoute)
    route.started = true
    route.locked = true
    return { ...config, provider: usableRoute.provider || config.provider, model: usableRoute.model }
  })
  function isRetryableFailure(failure) {
    const code = String(failure && failure.code || '').toUpperCase()
    const message = String(failure && failure.message || '').toLowerCase()
    // Provider validation errors are deterministic: changing models cannot fix
    // malformed tool-call arguments and only hides the original error.
    if (code.includes('INVALID') || code.includes('PARAMETER') || code.includes('VALIDATION') ||
      /invalid parameter|validation error|function_call\\.arguments|tool[_ -]?call/.test(message)) return false
    if (code.includes('ABORT') || code.includes('CANCEL')) return false
    return code.includes('TIMEOUT') || code.includes('UNAVAILABLE') || code.includes('OVERLOAD') ||
      code.includes('RATE') || code.includes('NETWORK') || code.includes('CONNECTION') ||
      /temporarily unavailable|too many requests|rate limit|timed out|timeout|connection reset|network error/.test(message)
  }

  ctx.on('agent/request-error', async (payload, next) => {
    const route = state.sessions.get(payload.agent.id)
    if (route && route.index + 1 < route.routes.length && isRetryableFailure(payload.failure)) {
      route.index += 1
      route.retrying = true
      publish(route.result, route.routes[route.index])
      return { kind: 'retry' }
    }
    return next()
  })
  ctx.on('agent/disposed', (payload) => { if (payload && payload.agent) state.sessions.delete(payload.agent.id) })
}