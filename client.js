window.__ModuleLoader__.load({
  id: 'dsh-smart-scenario-router',
  factory: (require) => {
    const React = require('react')
    const CSS = '.smart-router-status{display:flex;align-items:center;gap:8px;min-height:28px;padding:4px 8px;color:var(--dsh-fg-muted,#667085);font:12px/1.3 system-ui,sans-serif;border-top:1px solid var(--dsh-border,#e5e7eb)}' +
  '.smart-router-status button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;padding:3px 6px;border-radius:5px}' +
  '.smart-router-status button:hover{background:var(--dsh-bg-hover,#f2f4f7)}' +
  '.smart-router-status select{max-width:220px;padding:3px 5px;border:1px solid var(--dsh-border,#d0d5dd);border-radius:4px;background:var(--dsh-bg,#fff);color:var(--dsh-fg,#101828)}' +
  '.smart-router-settings{max-width:920px;color:var(--dsh-fg,#101828)}' +
  '.smart-router-settings p{color:var(--dsh-fg-muted,#667085);font-size:13px}' +
  '.smart-router-settings table{width:100%;border-collapse:collapse;font-size:13px}' +
  '.smart-router-settings th,.smart-router-settings td{padding:8px 6px;text-align:left;vertical-align:top;border-bottom:1px solid var(--dsh-border,#eaecf0)}' +
  '.smart-router-settings input[type=text]{width:180px;padding:5px 7px;border:1px solid var(--dsh-border,#d0d5dd);border-radius:4px;background:var(--dsh-bg,#fff);color:var(--dsh-fg,#101828)}' +
  '.smart-router-settings .scenario-list{display:flex;flex-direction:column;gap:4px;min-width:290px}' +
  '.smart-router-settings .scenario-item{font-size:12px;line-height:1.4;white-space:normal}'

async function getState() {
  const response = await fetch('/smart-scenario-router/state', { cache: 'no-store' })
  if (!response.ok) throw new Error('router state unavailable')
  return response.json()
}
async function updatePool(pool) {
  const response = await fetch('/smart-scenario-router/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pool }),
  })
  if (!response.ok) throw new Error('router settings update failed')
  return response.json()
}
function useRouterState(timer) {
  const [snapshot, setSnapshot] = React.useState(null)
  const reload = () => getState().then(setSnapshot).catch(() => {})
  React.useEffect(() => { reload(); return timer.interval(reload, 1200) }, [])
  return [snapshot, reload]
}
function scenarioUses(model, routes) {
  const result = []
  const labels = {
    project_planning: '项目拆解 / 架构设计', coding: '代码编写 / 调试',
    reasoning: '复杂推理 / 科研 / Agent', daily: '日常对话 / 快速问答',
    fast: '极速高并发 / 批量抽取', multimodal: '多模态（图文输入）', long_context: '长文本 / 数据分析',
  }
  Object.keys(routes || {}).forEach((tag) => {
    const chain = routes[tag] || []
    const index = chain.indexOf(model)
    if (index < 0) return
    const role = index === 0 ? '主用' : (model.indexOf('gpt-') === 0 ? 'GPT兜底' : '国产降级')
    result.push({ tag, text: role + '：' + (labels[tag] || tag) })
  })
  return result
}
function StatusBar(props) {
  const pair = useRouterState(props.timer)
  const snapshot = pair[0]
  const [open, setOpen] = React.useState(false)
  const [override, setOverride] = React.useState(null)
  if (!snapshot) return React.createElement('div', { className: 'smart-router-status' }, '场景路由初始化中…')
  const latest = snapshot.latest || {}
  const model = override || latest.model
  const options = (snapshot.pool || []).filter((item) => item.enabled)
  const onChange = (event) => { setOverride(event.target.value || null); setOpen(false) }
  return React.createElement('div', { className: 'smart-router-status' },
    React.createElement('span', null, '场景：', latest.label || latest.tag || '日常对话'),
    React.createElement('span', null, '模型：', model || '未选择'),
    React.createElement('span', null, '来源：', model && model.indexOf('gpt-') === 0 ? '备用' : '国产'),
    React.createElement('button', { type: 'button', title: '临时覆盖当前页面显示的模型', onClick: () => setOpen(!open) }, open ? '收起' : '覆盖模型'),
    open ? React.createElement('select', { value: override || '', onChange },
      React.createElement('option', { value: '' }, '自动路由'),
      options.map((item) => React.createElement('option', { key: item.id, value: item.id }, item.id)),
    ) : null,
  )
}
function SettingsSection(props) {
  const pair = useRouterState(props.timer)
  const snapshot = pair[0]
  const reload = pair[1]
  const [pool, setPool] = React.useState([])
  React.useEffect(() => { if (snapshot) setPool(snapshot.pool || []) }, [snapshot])
  if (!snapshot) return React.createElement('div', { className: 'smart-router-settings' }, '加载模型池…')
  const update = (id, patch) => {
    const next = pool.map((item) => item.id === id ? { ...item, ...patch } : item)
    setPool(next)
    updatePool(next).then(reload).catch(() => {})
  }
  const rows = pool.map((item) => {
    const uses = scenarioUses(item.id, snapshot.routes)
    const usage = uses.length
      ? React.createElement('div', { className: 'scenario-list' }, uses.map((use) => React.createElement('div', { className: 'scenario-item', key: use.tag }, use.text)))
      : React.createElement('span', null, '未绑定场景')
    return React.createElement('tr', { key: item.id },
      React.createElement('td', null, React.createElement('input', { type: 'checkbox', checked: item.enabled, onChange: (event) => update(item.id, { enabled: event.target.checked }) })),
      React.createElement('td', null, item.id),
      React.createElement('td', null, item.role),
      React.createElement('td', null, usage),
      React.createElement('td', null, React.createElement('input', { type: 'text', value: item.provider, placeholder: '自动解析', onChange: (event) => update(item.id, { provider: event.target.value }) })),
    )
  })
  const routes = Object.keys(snapshot.routes || {}).map((tag) => React.createElement('div', { key: tag, style: { marginTop: 8 } }, React.createElement('strong', null, tag), React.createElement('span', null, '  ', snapshot.routes[tag].join('  →  '))))
  return React.createElement('div', { className: 'smart-router-settings' },
    React.createElement('h2', null, '智能场景路由'),
    React.createElement('p', null, '模型名称按 Harness 已配置的原值传递。Provider 留空时自动从已注册模型目录解析。裁判模型固定为 ', snapshot.judgeModel, '。'),
    React.createElement('table', null,
      React.createElement('thead', null, React.createElement('tr', null,
        React.createElement('th', null, '启用'), React.createElement('th', null, '模型'), React.createElement('th', null, '用途'), React.createElement('th', null, '适用场景'), React.createElement('th', null, 'Provider（可选）'),
      )),
      React.createElement('tbody', null, rows),
    ),
    React.createElement('h3', null, '场景映射'),
    routes,
  )
}

    function apply(ctx) {
      const style = document.createElement('style')
      style.setAttribute('data-plugin', 'dsh-smart-scenario-router')
      style.textContent = CSS
      document.head.appendChild(style)
      ctx.effect(() => () => style.remove(), 'smart-scenario-router: styles')
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        { name: 'settings.section', id: 'smart-scenario-router', order: 35, label: '智能场景路由' },
        () => React.createElement(SettingsSection, { timer: ctx.timer }),
      ))
      ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
        { name: 'conversation.composer.dock', id: 'smart-scenario-router-status', order: 20, label: '场景路由状态' },
        () => React.createElement(StatusBar, { timer: ctx.timer }),
      ))
    }
    return { inject: ['slots', 'timer'], apply }
  },
})
