// 测试支撑：在纯 Node 环境里模拟 dsh 的 ctx（settings / llm / webServer /
// agentDefaultModel / 事件总线），让插件 apply() 可以完整跑通
// agent/pre-step → agent/request → agent/request-error → retry 的整条事件管线。
import { ROUTES, DEFAULT_POOL, SCHEMA_VERSION } from './index.js'

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

export function createHarness(options = {}) {
  const {
    models = ['deepseek-v4-pro-0813', 'deepseek-v4-flash-0731', 'glm-5.2', 'qwen3.8-max', 'qwen3.7-max', 'gpt-5.6-sol', 'gpt-5.6-luna'],
    provider = 'test',
    unusableModels = [], // resolveCallConfig 会为这些模型抛错 → 视为不可用
    userSettings = null, // 持久化的“用户层”设置（descriptor.user 的原始内容）
    defaultSelection = null, // 会话下拉框当前选中的 { model, provider }
    judgeTag = null, // 裁判模型(flash)的输出；null 表示空响应
  } = options
  const events = new Map()
  const effects = []
  const replaces = []
  const webHandlers = new Map()
  let user = clone(userSettings)

  const defaults = { pool: clone(DEFAULT_POOL), routes: clone(ROUTES), judgeModel: '', schemaVersion: SCHEMA_VERSION }
  const merged = () => {
    const out = clone(defaults)
    if (user && typeof user === 'object') for (const key of Object.keys(user)) out[key] = clone(user[key])
    return out
  }

  const settings = {
    register: () => ({
      get: () => merged(),
      replace: (next) => { user = clone(next); replaces.push(clone(next)) },
    }),
    describe: () => [{ ns: 'smart-scenario-router', user: user ? clone(user) : null }],
    get: (key) => (key === 'llm-deepseek' ? { models: [] } : null),
  }

  const llm = {
    listProviders: () => [{ id: provider }],
    listModels: async () => models.map((id) => ({ id })),
    resolveCallConfig: async ({ model }) => {
      if (unusableModels.includes(model)) throw new Error(`upstream unavailable: ${model}`)
      return { model }
    },
    stream: async function* () {
      if (judgeTag) {
        yield { type: 'text-delta', text: judgeTag }
        yield { type: 'finish' }
      }
    },
  }

  const ctx = {
    settings,
    llm,
    agentDefaultModel: { currentSelection: () => clone(defaultSelection) },
    webServer: {
      register: ({ path, handler }) => { webHandlers.set(path, handler); return () => webHandlers.delete(path) },
    },
    effect: (fn) => effects.push(fn),
    on: (event, handler) => { events.set(event, handler) },
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
  const fire = async (event, payload, next) => {
    const handler = events.get(event)
    if (!handler) return next ? next() : undefined
    return handler(payload, next || (async () => undefined))
  }
  const request = async (agent, config) => fire('agent/request', { agent, signal: {} }, async () => config || clone(defaultSelection) || {})
  const getView = async () => {
    const handler = webHandlers.get('/smart-scenario-router/state')
    const res = { status: 0, body: '', writeHead(status) { this.status = status }, end(body) { this.body = body } }
    await handler({}, res)
    return JSON.parse(res.body)
  }
  const postUpdate = async (body) => {
    const handler = webHandlers.get('/smart-scenario-router/update')
    const req = {
      method: 'POST',
      async *[Symbol.asyncIterator]() { yield JSON.stringify(body) },
    }
    const res = { status: 0, body: '', writeHead(status) { this.status = status }, end(body) { this.body = body } }
    await handler(req, res)
    return { status: res.status, body: res.body ? JSON.parse(res.body) : null }
  }

  return { ctx, events, effects, replaces, webHandlers, flush, fire, request, getView, postUpdate }
}

export function userMessage(text) {
  return [{ role: 'user', content: [{ type: 'text', text }] }]
}