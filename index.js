import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

const ROUTES = {
  project_planning: ['deepseek-v4-pro-0813', 'glm-5.2', 'gpt-5.6-sol'],
  coding: ['glm-5.2', 'deepseek-v4-pro-0813', 'gpt-5.6-sol'],
  reasoning: ['deepseek-v4-pro-0813', 'qwen3.8-max', 'gpt-5.6-sol'],
  daily: ['deepseek-v4-flash-0731', 'glm-5.2', 'gpt-5.6-luna'],
  fast: ['deepseek-v4-flash-0731', 'gpt-5.6-luna'],
  multimodal: ['qwen3.8-max', 'qwen3.7-max', 'gpt-5.6-sol'],
  long_context: ['deepseek-v4-pro-0813', 'qwen3.8-max', 'gpt-5.6-sol'],
}

const LABELS = {
  project_planning: '项目拆解 / 架构设计',
  coding: '代码编写 / 调试',
  reasoning: '复杂推理 / 科研 / Agent',
  daily: '日常对话 / 快速问答',
  fast: '极速高并发 / 批量抽取',
  multimodal: '多模态（图文输入）',
  long_context: '长文本 / 数据分析',
}

const DEFAULT_POOL = [
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

function classify(messages) {
  const input = userText(messages)
  if (input.image || /图片|图像|截图|照片|图文|视觉|看图|识图|OCR|扫描件|表格图片/.test(input.text)) return { tag: 'multimodal', confidence: 0.98, judged: false }
  if (input.text.length > 12000) return { tag: 'long_context', confidence: 0.96, judged: false }
  const rules = [
    ['project_planning', ['架构', '项目拆解', '技术方案', '系统设计', '模块拆分', '里程碑', '规划']],
    ['coding', ['代码', '编写', '调试', 'bug', '报错', '函数', '接口', 'typescript', 'javascript', 'python', '重构', '前端', '后端', '数据库', '测试用例']],
    ['reasoning', ['推理', '科研', '论文', '证明', '分析原因', 'agent', '实验设计', '复杂']],
    ['fast', ['批量', '抽取', '高并发', '极速', '快速分类', '大量文本']],
    ['multimodal', ['图片', '图像', '截图', '照片', '图文', '视觉', '看图']],
    ['long_context', ['长文本', '全文', '数据分析', '日志分析', '报表', '数据集', '上下文']],
    ['daily', ['你好', '什么是', '怎么做', '帮我', '解释一下', '快速问答', '谢谢']],
  ]
  let best = 'daily'
  let bestScore = 0
  const lower = input.text.toLowerCase()
  for (const rule of rules) {
    let score = 0
    for (const word of rule[1]) if (lower.includes(word.toLowerCase())) score += word.length > 3 ? 2 : 1
    if (score > bestScore) { best = rule[0]; bestScore = score }
  }
  return { tag: best, confidence: bestScore ? Math.min(0.96, 0.52 + bestScore * 0.1) : 0.25, judged: false }
}

function source(model) { return model.indexOf('gpt-') === 0 ? '备用' : '国产' }

export function apply(ctx, config) {
  if (config && config.enabled === false) return
  const settings = ctx.settings.register(ROUTER_NS, RouterSettings, { base: { pool: DEFAULT_POOL } })
  const state = {
    pool: settings.get().pool.map((item) => ({ ...item })),
    providers: Object.create(null),
    available: Object.create(null),
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

  async function discover() {
    if (state.loaded) return
    try {
      for (const info of llm.listProviders() || []) {
        const provider = info && info.id
        if (!provider) continue
        try {
          for (const model of await llm.listModels(provider) || []) {
            if (!model || !model.id) continue
            state.providers[model.id] = provider
            state.available[provider + ':' + model.id] = true
          }
        } catch (_) {}
      }
    } catch (_) {}
    state.loaded = true
  }

  async function judge(messages, fallbackProvider, signal) {
    const model = 'deepseek-v4-flash-0731'
    const provider = state.providers[model] || fallbackProvider
    if (!provider) return null
    try {
      let output = ''
      for await (const chunk of llm.stream({ provider, model, messages, system: '只输出一个场景标签，不要解释。可选值：project_planning, coding, reasoning, daily, fast, multimodal, long_context。', temperature: 0, maxTokens: 12, signal })) {
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
      routes: Object.fromEntries(Object.entries(ROUTES).map(([tag, chain]) => [tag, chain.slice()])),
      latest: { ...state.latest },
      override: state.override,
      judgeModel: 'deepseek-v4-flash-0731',
      threshold: 0.7,
      providers: Object.keys(state.providers).sort(),
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

  async function candidates(tag, fallbackProvider, signal) {
    const result = []
    const models = ROUTES[tag] || ROUTES.daily
    for (const model of models) {
      const item = state.pool.find((candidate) => candidate.id === model)
      if (item && !item.enabled) continue
      const provider = (item && item.provider) || state.providers[model] || fallbackProvider
      if (!provider) continue
      if (await usable(provider, model, signal)) result.push({ model, provider, source: source(model) })
    }
    if (result.length) return result
    for (const item of state.pool) {
      const provider = item.provider || state.providers[item.id] || fallbackProvider
      if (!item.enabled || !provider) continue
      if (await usable(provider, item.id, signal)) return [{ model: item.id, provider, source: source(item.id) }]
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
    handler: (_req, res) => writeJson(res, 200, view()),
  }))
  routes.push(ctx.webServer.register({
    kind: 'exact',
    path: '/smart-scenario-router/update',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { error: 'method-not-allowed' })
      try {
        const args = await readJson(req)
        const updates = args && Array.isArray(args.pool) ? args.pool : []
        for (const update of updates) {
          const item = state.pool.find((candidate) => candidate.id === (update && update.id))
          if (!item) continue
          if (typeof update.enabled === 'boolean') item.enabled = update.enabled
          if (typeof update.provider === 'string') item.provider = update.provider.trim()
        }
        await settings.replace({ pool: state.pool })
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
    const overridden = state.override && await usable(state.providers[state.override] || fallbackProvider, state.override, payload.signal)
      ? { model: state.override, provider: state.providers[state.override] || fallbackProvider, source: source(state.override) }
      : null
    const first = persisted || overridden || routeList[0]
    const routesForSession = persisted || overridden ? [first] : routeList
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
    } else if (!isDefaultConfig(config) && config.model && (config.model !== selected.model || (config.provider && selected.provider && config.provider !== selected.provider))) {
      // The host model selector changed the request; keep that manual choice.
      const manual = { model: config.model, provider: config.provider, source: source(config.model) }
      route.routes = [manual]
      route.index = 0
      publish(route.result, manual)
      return config
    }
    let usableRoute = selected
    while (usableRoute && !(await usable(usableRoute.provider || config.provider, usableRoute.model, payload.signal))) {
      route.index += 1
      usableRoute = route.routes[route.index]
    }
    if (!usableRoute) return config
    if (usableRoute !== selected) publish(route.result, usableRoute)
    route.started = true
    route.locked = true
    return { ...config, provider: usableRoute.provider || config.provider, model: usableRoute.model }
  })
  ctx.on('agent/request-error', async (payload, next) => {
    const route = state.sessions.get(payload.agent.id)
    if (route && route.index + 1 < route.routes.length) {
      route.index += 1
      route.retrying = true
      publish(route.result, route.routes[route.index])
      return { kind: 'retry' }
    }
    return next()
  })
  ctx.on('agent/disposed', (payload) => { if (payload && payload.agent) state.sessions.delete(payload.agent.id) })
}
