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
  '.smart-router-settings input[type=text]{width:170px;padding:5px 7px;border:1px solid var(--dsh-border,#d0d5dd);border-radius:4px;background:var(--dsh-bg,#fff);color:var(--dsh-fg,#101828)}' +
  '.smart-router-settings select{max-width:260px;padding:5px 7px;border:1px solid var(--dsh-border,#d0d5dd);border-radius:4px;background:var(--dsh-bg,#fff);color:var(--dsh-fg,#101828)}' +
  '.smart-router-settings .scenario-list{display:flex;flex-direction:column;gap:4px;min-width:290px}' +
  '.smart-router-settings .scenario-item{font-size:12px;line-height:1.4;white-space:normal}' +
  '.smart-router-settings .pool-add{display:flex;gap:8px;align-items:center;margin:12px 0 4px}' +
  '.smart-router-settings .remove-row{font:12px/1.4 system-ui,sans-serif;color:var(--dsh-fg-muted,#667085);background:transparent;border:1px solid var(--dsh-border,#d0d5dd);border-radius:4px;cursor:pointer;padding:2px 8px}' +
  '.smart-router-settings .remove-row:hover{background:var(--dsh-bg-hover,#f2f4f7)}' +
  '.smart-router-settings .chain-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--dsh-border,#eaecf0)}' +
  '.smart-router-settings .chain-row:last-child{border-bottom:0}' +
  '.smart-router-settings .chain-label{min-width:150px;font-weight:600}' +
  '.smart-router-settings .chain-slot{display:inline-flex;gap:4px;align-items:center}' +
  '.smart-router-settings .chain-slot select{max-width:200px}' +
  '.smart-router-settings button{font:12px/1.4 system-ui,sans-serif;color:var(--dsh-fg-muted,#667085);background:transparent;border:1px solid var(--dsh-border,#d0d5dd);border-radius:4px;cursor:pointer;padding:2px 8px}' +
  '.smart-router-settings button:hover{background:var(--dsh-bg-hover,#f2f4f7)}' +
  '.smart-router-settings .judge-row{display:flex;gap:8px;align-items:center;margin:14px 0 6px}' +
  '.smart-router-settings .judge-row select{max-width:300px}' +
  '.smart-router-settings .judge-note{color:var(--dsh-fg-muted,#667085);font-size:12px}'

async function getState() {
  const response = await fetch('/smart-scenario-router/state', { cache: 'no-store' })
  if (!response.ok) throw new Error('router state unavailable')
  return response.json()
}
async function updateState(payload) {
  const response = await fetch('/smart-scenario-router/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
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
const LABELS = {
  project_planning: '项目拆解 / 架构设计', coding: '代码编写 / 调试',
  reasoning: '复杂推理 / 科研 / Agent', daily: '日常对话 / 快速问答',
  fast: '极速高并发 / 批量抽取', multimodal: '多模态（图文输入）', long_context: '长文本 / 数据分析',
}
function scenarioUses(model, routes) {
  const result = []
  Object.keys(routes || {}).forEach((tag) => {
    const chain = routes[tag] || []
    const index = chain.indexOf(model)
    if (index < 0) return
    const role = index === 0 ? '主用' : (model.indexOf('gpt-') === 0 ? 'GPT兜底' : '国产降级')
    result.push({ tag, text: role + '：' + (LABELS[tag] || tag) })
  })
  return result
}
function ModelSelect(props) {
  const { value, models, onChange, empty } = props
  const options = []
  if (empty !== undefined) options.push(React.createElement('option', { key: '', value: '' }, empty))
  if (value && !models.some((m) => m.id === value)) options.push(React.createElement('option', { key: 'missing', value }, value + '（未配置）'))
  options.push(...models.map((m) => React.createElement('option', { key: m.id, value: m.id }, m.id + (m.provider ? '　· ' + m.provider : ''))))
  return React.createElement('select', { value: value || '', onChange: (event) => onChange(event.target.value) }, options)
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
  const [draft, setDraft] = React.useState(null)
  React.useEffect(() => {
    if (!snapshot) return
    setDraft({
      pool: (snapshot.pool || []).map((item) => ({ ...item })),
      routes: Object.fromEntries(Object.entries(snapshot.routes || {}).map(([tag, chain]) => [tag, chain.slice()])),
      judgeModel: snapshot.judgeModel || '',
    })
  }, [snapshot])
  if (!snapshot || !draft) return React.createElement('div', { className: 'smart-router-settings' }, '加载模型池…')
  const models = snapshot.models || []
  const commit = (next) => {
    setDraft(next)
    updateState({ pool: next.pool, routes: next.routes, judgeModel: next.judgeModel }).then(reload).catch(() => {})
  }
  const updatePoolItem = (id, patch) => commit({ ...draft, pool: draft.pool.map((item) => item.id === id ? { ...item, ...patch } : item) })
  const removePoolItem = (id) => commit({ ...draft, pool: draft.pool.filter((item) => item.id !== id) })
  const addPoolItem = (id) => {
    if (!id || draft.pool.some((item) => item.id === id)) return
    const match = models.find((m) => m.id === id)
    const role = match && match.id.indexOf('gpt-') === 0 ? '最后兜底' : '国产主力'
    commit({ ...draft, pool: [...draft.pool, { id, role: role || '自定义', enabled: true, provider: (match && match.provider) || '' }] })
  }
  const rows = draft.pool.map((item) => {
    const uses = scenarioUses(item.id, draft.routes)
    const usage = uses.length
      ? React.createElement('div', { className: 'scenario-list' }, uses.map((use) => React.createElement('div', { className: 'scenario-item', key: use.tag }, use.text)))
      : React.createElement('span', null, '未绑定场景')
    return React.createElement('tr', { key: item.id },
      React.createElement('td', null, React.createElement('input', { type: 'checkbox', checked: item.enabled, onChange: (event) => updatePoolItem(item.id, { enabled: event.target.checked }) })),
      React.createElement('td', null, React.createElement(ModelSelect, { value: item.id, models, onChange: (next) => updatePoolItem(item.id, { id: next }) })),
      React.createElement('td', null, item.role),
      React.createElement('td', null, usage),
      React.createElement('td', null, React.createElement('input', { type: 'text', value: item.provider, placeholder: '自动解析', onChange: (event) => updatePoolItem(item.id, { provider: event.target.value }) })),
      React.createElement('td', null, React.createElement('button', { type: 'button', className: 'remove-row', title: '从模型池移除', onClick: () => removePoolItem(item.id) }, '移除')),
    )
  })
  const available = models.filter((m) => !draft.pool.some((item) => item.id === m.id))
  const routeEditors = Object.keys(LABELS).map((tag) => {
    const chain = (draft.routes && draft.routes[tag]) || []
    const slots = chain.map((model, index) => React.createElement('span', { className: 'chain-slot', key: index },
      React.createElement(ModelSelect, { value: model, models, empty: '候选…', onChange: (next) => { const copy = chain.slice(); copy[index] = next; commit({ ...draft, routes: { ...draft.routes, [tag]: copy } }) } }),
      React.createElement('button', { type: 'button', title: '移除该候选', onClick: () => commit({ ...draft, routes: { ...draft.routes, [tag]: chain.filter((_, i) => i !== index) } }) }, '✕'),
    ))
    return React.createElement('div', { className: 'chain-row', key: tag },
      React.createElement('span', { className: 'chain-label' }, LABELS[tag] || tag),
      slots,
      React.createElement('button', { type: 'button', title: '追加候选模型', onClick: () => commit({ ...draft, routes: { ...draft.routes, [tag]: [...chain, ''] } }) }, '＋ 候选'),
    )
  })
  return React.createElement('div', { className: 'smart-router-settings' },
    React.createElement('h2', null, '智能场景路由'),
    React.createElement('p', null, '模型均从「设置 → 模型」中已配置的模型选择，名称按 Harness 已配置的原值传递；Provider 留空时自动解析。首次使用会只保留你实际配置的模型。'),
    React.createElement('table', null,
      React.createElement('thead', null, React.createElement('tr', null,
        React.createElement('th', null, '启用'), React.createElement('th', null, '模型'), React.createElement('th', null, '用途'), React.createElement('th', null, '适用场景'), React.createElement('th', null, 'Provider（可选）'), React.createElement('th', null, ''),
      )),
      React.createElement('tbody', null, rows),
    ),
    React.createElement('div', { className: 'pool-add' },
      React.createElement('span', null, '添加模型：'),
      React.createElement(ModelSelect, { value: '', models: available, empty: available.length ? '选择要添加的模型…' : '（池中已包含全部已配置模型）', onChange: (next) => addPoolItem(next) }),
    ),
    React.createElement('div', { className: 'judge-row' },
      React.createElement('span', null, '裁判模型：'),
      React.createElement(ModelSelect, { value: draft.judgeModel, models, empty: '自动（推荐）', onChange: (next) => commit({ ...draft, judgeModel: next }) }),
      snapshot.judgeResolved ? React.createElement('span', { className: 'judge-note' }, '当前解析：', snapshot.judgeResolved) : null,
    ),
    React.createElement('h3', null, '场景候选链（可编辑，拖动顺序即回退顺序）'),
    routeEditors,
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