window.__ModuleLoader__.load({
  id: 'dsh-smart-scenario-router',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /* ── 色板：每场景 / 每模型族 / 每角色一个专属颜色（RGB 三元组，明暗主题通用） ── */
    const SCENE_COLORS = {
      project_planning: [99, 102, 241],   // indigo
      coding: [14, 165, 233],             // sky
      reasoning: [139, 92, 246],          // violet
      daily: [16, 185, 129],              // emerald
      fast: [245, 158, 11],               // amber
      multimodal: [236, 72, 153],         // pink
      long_context: [20, 184, 166],       // teal
    }
    const FAMILY_COLORS = {
      deepseek: [99, 102, 241],           // indigo
      glm: [16, 185, 129],                // emerald
      qwen: [14, 165, 233],               // sky
      gpt: [139, 92, 246],                // violet
      other: [148, 163, 184],             // slate
    }
    const ROLE_COLORS = {
      '国产主力': [37, 99, 235],
      '国产降级': [13, 148, 136],
      '最后兜底': [180, 83, 9],
      '自定义': [100, 116, 139],
      'GPT兜底': [139, 92, 246],
      '国产': [16, 185, 129],
      '备用': [217, 119, 6],
    }
    const rgb = (c) => c.join(' ')
    function familyOf(id) {
      const match = /^(deepseek|glm|qwen|gpt)/i.exec(id || '')
      return match ? match[1].toLowerCase() : 'other'
    }
    const sceneColor = (tag) => rgb(SCENE_COLORS[tag] || SCENE_COLORS.daily)
    const familyColor = (id) => rgb(FAMILY_COLORS[familyOf(id)])
    const roleColor = (role) => rgb(ROLE_COLORS[role] || ROLE_COLORS['自定义'])

    /* ── 样式（基于 DSW 主题令牌 + 色板，明暗主题自适应） ── */
    const CSS = `
.smart-router-settings,.smart-router-status{--sc-project:99 102 241;--sc-coding:14 165 233;--sc-reasoning:139 92 246;--sc-daily:16 185 129;--sc-fast:245 158 11;--sc-multimodal:236 72 153;--sc-long_context:20 184 166;--fam-deepseek:99 102 241;--fam-glm:16 185 129;--fam-qwen:14 165 233;--fam-gpt:139 92 246;--fam-other:148 163 184}
.smart-router-settings{max-width:780px;color:var(--dsw-alias-label-primary)}
.smart-router-settings *,.smart-router-status *{box-sizing:border-box}
.ssr-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ssr-title{margin:0;font-size:20px;line-height:1.35;font-weight:650;letter-spacing:-.01em}
.ssr-sub{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.65;margin:6px 0 0;max-width:62ch}
.ssr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin:16px 0 4px}
.ssr-stat{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:10px 12px 9px;display:flex;flex-direction:column;gap:1px;min-width:0}
.ssr-stat-num{font-size:20px;font-weight:700;line-height:1.25;font-variant-numeric:tabular-nums;color:rgb(var(--c));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ssr-stat-lbl{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ssr-block-head{display:flex;align-items:baseline;gap:8px;margin:22px 0 8px;flex-wrap:wrap}
.ssr-block-head h3{margin:0;font-size:15px;font-weight:650;line-height:1.4}
.ssr-block-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.ssr-badge{display:inline-flex;align-items:center;gap:5px;height:22px;max-width:100%;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgb(var(--c));background:rgb(var(--c) / .13)}
.ssr-badge .ssr-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.ssr-badge-solid{background:rgb(var(--c));color:#fff}
.ssr-dim{color:var(--dsw-alias-label-tertiary);font-size:12px}
.ssr-select,.smart-router-settings select,.smart-router-settings input[type=text],.smart-router-status select{box-sizing:border-box;height:30px;max-width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 8px;outline:none;transition:border-color .12s,box-shadow .12s}
.ssr-select:focus,.smart-router-settings select:focus,.smart-router-settings input[type=text]:focus,.smart-router-status select:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}
.smart-router-status select{height:26px;max-width:200px;font-size:12px}
.ssr-switch{position:relative;display:inline-block;width:36px;height:20px;flex:none;cursor:pointer}
.ssr-switch input{appearance:none;-webkit-appearance:none;margin:0;width:36px;height:20px;border-radius:999px;border:0;background:var(--dsw-alias-fill-l2,#d9dee5);cursor:pointer;transition:background .18s;position:relative}
.ssr-switch input:checked{background:rgb(var(--c))}
.ssr-switch input::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / .25);transition:transform .18s}
.ssr-switch input:checked::after{transform:translateX(16px)}
.ssr-switch input:focus-visible{outline:2px solid rgb(var(--c));outline-offset:2px}
.ssr-pool{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.ssr-pool-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:10px 12px;transition:border-color .15s,opacity .15s}
.ssr-pool-card:hover{border-color:var(--dsw-alias-border-l3)}
.ssr-pool-card.ssr-off{opacity:.55}
.ssr-pool-card.ssr-off:hover{opacity:.85}
.ssr-pool-main{display:flex;flex-direction:column;gap:7px;min-width:0}
.ssr-pool-row1{display:flex;align-items:center;gap:8px;min-width:0}
.ssr-pool-row2{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.ssr-family-dot{width:10px;height:10px;border-radius:50%;background:rgb(var(--c));flex:none;box-shadow:0 0 0 3px rgb(var(--c) / .15)}
.ssr-provider{width:150px}
.ssr-icon-btn{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary);background:transparent;border:1px solid transparent;cursor:pointer;font-size:14px;line-height:1;padding:0}
.ssr-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}
.ssr-add{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px dashed var(--dsw-alias-border-l3);border-radius:14px;padding:9px 12px;background:transparent;transition:border-color .15s}
.ssr-add:hover{border-color:var(--dsw-alias-border-l2)}
.ssr-add-label{font-size:13px;color:var(--dsw-alias-label-secondary);font-weight:500}
.ssr-add select{min-width:240px;flex:1}
.ssr-judge{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:22px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:11px 14px}
.ssr-judge-dot{width:10px;height:10px;border-radius:50%;background:rgb(245 158 11);flex:none;box-shadow:0 0 0 3px rgb(245 158 11 / .15)}
.ssr-judge-label{font-size:14px;font-weight:600}
.ssr-judge select{min-width:220px}
.ssr-scenes{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px;margin-top:6px}
.ssr-scene{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0;transition:border-color .15s}
.ssr-scene:hover{border-color:var(--dsw-alias-border-l3)}
.ssr-scene-head{display:flex;align-items:center;gap:8px;min-width:0}
.ssr-scene-dot{width:10px;height:10px;border-radius:50%;flex:none;background:rgb(var(--sc));box-shadow:0 0 0 3px rgb(var(--sc) / .16)}
.ssr-scene-name{font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgb(var(--sc))}
.ssr-scene-count{margin-left:auto;flex:none}
.ssr-chain{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px}
.ssr-node{flex:1 1 132px;min-width:0;display:flex;flex-direction:column;gap:6px;border:1px solid rgb(var(--sc) / .38);background:rgb(var(--sc) / .06);border-radius:10px;padding:6px 8px}
.ssr-node-head{display:flex;align-items:center;gap:4px;min-height:16px}
.ssr-node-role{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgb(var(--sc));flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ssr-node-x{width:16px;height:16px;border-radius:5px;display:grid;place-items:center;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:11px;line-height:1;padding:0}
.ssr-node-x:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}
.ssr-arrow{display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:13px;padding:0 1px;flex:none}
.ssr-node-empty{flex:1 1 132px;border:1px dashed var(--dsw-alias-border-l3);border-radius:10px;color:var(--dsw-alias-label-tertiary);font-size:12px;justify-content:center;align-items:center;display:flex;padding:6px 8px}
.ssr-node-add{display:inline-flex;align-items:center;justify-content:center;gap:4px;flex:none;border:1px dashed var(--dsw-alias-border-l3);border-radius:10px;padding:0 12px;color:var(--dsw-alias-label-tertiary);background:transparent;cursor:pointer;font-size:12px;line-height:1}
.ssr-node-add:hover{color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}
.ssr-loading{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:13px;padding:10px 2px}
.ssr-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-state-business-primary);animation:ssr-spin .7s linear infinite;flex:none}
@keyframes ssr-spin{to{transform:rotate(360deg)}}
.smart-router-status{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:28px;padding:2px 4px;color:var(--dsw-alias-label-secondary);font:12px/1.3 system-ui,sans-serif}
.ssr-ghost{box-sizing:border-box;height:24px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;padding:0 10px;display:inline-flex;align-items:center;gap:4px;transition:background .12s,color .12s}
.ssr-ghost:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ssr-pulse{width:7px;height:7px;border-radius:50%;background:rgb(245 158 11);animation:ssr-pulse 1s ease-in-out infinite}
@keyframes ssr-pulse{50%{opacity:.35}}
`

    /* ── 数据层 ── */
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
      if (empty !== undefined) options.push(h('option', { key: '', value: '' }, empty))
      if (value && !models.some((m) => m.id === value)) options.push(h('option', { key: 'missing', value }, value + '（未配置）'))
      options.push(...models.map((m) => h('option', { key: m.id, value: m.id }, m.id + (m.provider ? '　· ' + m.provider : ''))))
      return h('select', { value: value || '', onChange: (event) => onChange(event.target.value) }, options)
    }

    /* ── 通用小组件 ── */
    function Badge(props) {
      const { color, solid, dot, title, children } = props
      const cls = 'ssr-badge' + (solid ? ' ssr-badge-solid' : '')
      const kids = dot ? [h('span', { key: 'dot', className: 'ssr-dot' }), children] : [children]
      return h('span', { className: cls, style: color ? { '--c': color } : null, title }, kids)
    }
    function Spin() {
      return h('div', { className: 'ssr-loading' }, h('span', { className: 'ssr-spinner' }), '加载模型池…')
    }

    /* ── 状态栏（会话输入框下方 dock） ── */
    function StatusBar(props) {
      const pair = useRouterState(props.timer)
      const snapshot = pair[0]
      const [open, setOpen] = React.useState(false)
      const [override, setOverride] = React.useState(null)
      if (!snapshot) return h('div', { className: 'smart-router-status' }, h('span', { className: 'ssr-pulse' }), '场景路由初始化中…')
      const latest = snapshot.latest || {}
      const model = override || latest.model
      const options = (snapshot.pool || []).filter((item) => item.enabled)
      const tag = latest.tag || 'daily'
      const isGpt = Boolean(model && model.indexOf('gpt-') === 0)
      const onChange = (event) => { setOverride(event.target.value || null); setOpen(false) }
      return h('div', { className: 'smart-router-status' },
        h(Badge, { color: sceneColor(tag), dot: true, title: '当前识别场景' }, latest.label || latest.tag || '日常对话'),
        model ? h(Badge, { color: familyColor(model), dot: true, title: '当前路由模型' }, model)
          : h('span', { className: 'ssr-dim' }, '未选择模型'),
        h(Badge, { color: isGpt ? '217 119 6' : '16 185 129', dot: true, title: isGpt ? 'GPT 备用链路' : '国产链路' }, isGpt ? '备用' : '国产'),
        h('button', { type: 'button', className: 'ssr-ghost', title: '临时覆盖当前页面显示的模型', onClick: () => setOpen(!open) }, open ? '收起' : '覆盖'),
        open ? h('select', { className: 'ssr-select', value: override || '', onChange },
          h('option', { value: '' }, '自动路由'),
          options.map((item) => h('option', { key: item.id, value: item.id }, item.id)),
        ) : null,
      )
    }

    /* ── 设置页 ── */
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
      if (!snapshot || !draft) return h('div', { className: 'smart-router-settings' }, h(Spin, null))
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

      /* 统计概览 */
      const enabledCount = draft.pool.filter((item) => item.enabled).length
      const sceneCount = Object.keys(LABELS).length
      const judgeResolved = snapshot.judgeResolved || '自动'
      const stats = [
        { num: String(draft.pool.length), lbl: '模型池总数', c: rgb(SCENE_COLORS.project_planning) },
        { num: String(enabledCount), lbl: '已启用', c: rgb([16, 185, 129]) },
        { num: String(sceneCount), lbl: '场景规则', c: rgb(SCENE_COLORS.reasoning) },
        { num: judgeResolved, lbl: '裁判模型', c: rgb(SCENE_COLORS.fast), title: '低置信度消息由裁判模型复判' },
      ]

      /* 模型池卡片 */
      const poolCards = draft.pool.map((item) => {
        const uses = scenarioUses(item.id, draft.routes)
        return h('div', { key: item.id, className: 'ssr-pool-card' + (item.enabled ? '' : ' ssr-off') },
          h('label', { className: 'ssr-switch', style: { '--c': familyColor(item.id) }, title: item.enabled ? '停用该模型' : '启用该模型' },
            h('input', { type: 'checkbox', checked: item.enabled, onChange: (event) => updatePoolItem(item.id, { enabled: event.target.checked }) })),
          h('div', { className: 'ssr-pool-main' },
            h('div', { className: 'ssr-pool-row1' },
              h('span', { className: 'ssr-family-dot', style: { '--c': familyColor(item.id) } }),
              h(ModelSelect, { value: item.id, models, onChange: (next) => updatePoolItem(item.id, { id: next }) })),
            h('div', { className: 'ssr-pool-row2' },
              h(Badge, { color: roleColor(item.role) }, item.role),
              h('input', { type: 'text', className: 'ssr-provider', value: item.provider, placeholder: 'Provider 自动解析', title: 'Provider（留空自动解析）', onChange: (event) => updatePoolItem(item.id, { provider: event.target.value }) }),
              uses.length
                ? uses.map((use) => h(Badge, { key: use.tag, color: sceneColor(use.tag), title: use.text }, use.text))
                : h('span', { className: 'ssr-dim' }, '未绑定场景'))),
          h('button', { type: 'button', className: 'ssr-icon-btn', title: '从模型池移除', 'aria-label': '移除 ' + item.id, onClick: () => removePoolItem(item.id) }, '✕'),
        )
      })
      const available = models.filter((m) => !draft.pool.some((item) => item.id === m.id))

      /* 场景候选链卡片（可视化：主用 → 回退 N） */
      const sceneEditors = Object.keys(LABELS).map((tag) => {
        const chain = (draft.routes && draft.routes[tag]) || []
        const sc = sceneColor(tag)
        const nodes = []
        chain.forEach((model, index) => {
          if (index > 0) nodes.push(h('span', { key: 'arrow-' + index, className: 'ssr-arrow' }, '→'))
          nodes.push(h('div', { key: 'node-' + index, className: 'ssr-node', style: { '--sc': sc } },
            h('div', { className: 'ssr-node-head' },
              h('span', { className: 'ssr-node-role' }, index === 0 ? '主用' : '回退 ' + index),
              h('button', { type: 'button', className: 'ssr-node-x', title: '移除该候选', onClick: () => commit({ ...draft, routes: { ...draft.routes, [tag]: chain.filter((_, i) => i !== index) } }) }, '×')),
            h(ModelSelect, { value: model, models, empty: index === 0 ? '选择主用模型…' : '选择候选…', onChange: (next) => { const copy = chain.slice(); copy[index] = next; commit({ ...draft, routes: { ...draft.routes, [tag]: copy } }) } }),
          ))
        })
        if (!chain.length) nodes.push(h('div', { key: 'empty', className: 'ssr-node-empty' }, '未配置候选，走全局兜底'))
        nodes.push(h('button', { key: 'add', type: 'button', className: 'ssr-node-add', title: '追加候选模型', onClick: () => commit({ ...draft, routes: { ...draft.routes, [tag]: [...chain, ''] } }) }, '＋ 候选'))
        return h('div', { className: 'ssr-scene', key: tag, style: { '--sc': sc } },
          h('div', { className: 'ssr-scene-head' },
            h('span', { className: 'ssr-scene-dot' }),
            h('span', { className: 'ssr-scene-name' }, LABELS[tag] || tag),
            h('span', { className: 'ssr-block-hint ssr-scene-count' }, chain.length ? chain.length + ' 个候选' : '未配置')),
          h('div', { className: 'ssr-chain' }, nodes),
        )
      })

      return h('div', { className: 'smart-router-settings' },
        h('div', { className: 'ssr-head' },
          h('h2', { className: 'ssr-title' }, '智能场景路由'),
          h(Badge, { color: '16 185 129', dot: true, solid: true, title: '路由服务运行中' }, '运行中')),
        h('p', { className: 'ssr-sub' }, '模型均从「设置 → 模型」中已配置的模型选择，名称按 Harness 已配置的原值传递；Provider 留空时自动解析。首次使用会只保留你实际配置的模型。'),
        h('div', { className: 'ssr-stats' },
          stats.map((stat) => h('div', { key: stat.lbl, className: 'ssr-stat', title: stat.title },
            h('div', { className: 'ssr-stat-num', style: { '--c': stat.c } }, stat.num),
            h('div', { className: 'ssr-stat-lbl' }, stat.lbl)))),
        h('div', { className: 'ssr-block-head' },
          h('h3', null, '模型池'),
          h('span', { className: 'ssr-block-hint' }, '启用开关决定该模型是否参与路由；角色与场景自动标注')),
        h('div', { className: 'ssr-pool' }, poolCards),
        h('div', { className: 'ssr-add' },
          h('span', { className: 'ssr-add-label' }, '＋ 添加模型'),
          h(ModelSelect, { value: '', models: available, empty: available.length ? '选择要添加的模型…' : '池中已包含全部已配置模型', onChange: (next) => addPoolItem(next) })),
        h('div', { className: 'ssr-judge' },
          h('span', { className: 'ssr-judge-dot' }),
          h('span', { className: 'ssr-judge-label' }, '裁判模型'),
          h(ModelSelect, { value: draft.judgeModel, models, empty: '自动（推荐）', onChange: (next) => commit({ ...draft, judgeModel: next }) }),
          h(Badge, { color: rgb(SCENE_COLORS.fast), title: '当前实际用于场景复判的模型' }, '当前解析：' + judgeResolved)),
        h('div', { className: 'ssr-block-head' },
          h('h3', null, '场景候选链'),
          h('span', { className: 'ssr-block-hint' }, '顺序即回退顺序：主用失败后依次尝试下一候选')),
        h('div', { className: 'ssr-scenes' }, sceneEditors),
      )
    }

    /* ── 挂载 ── */
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