# Changelog

## 0.3.0

- 重新设计场景 → 模型映射（详见 README「场景 → 模型设计原则」）：`project_planning` / `code_diff` 主用改为 `glm-5.2`，`long_context` 主用改为 `qwen3.8-max`，其余场景按「深度任务用 GLM / deepseek-pro、轻量任务用 flash、视觉用 qwen、GPT 兜底」的职责分配候选链。
- 分类器整体加强：新增架构 / 方案类意图（`project_planning`）、纯问候语快速路径（限定整句，避免「你好，帮我写个脚本」被误判日常）、扩充中英文关键词表（编程 / 推理 / 数据 / 日志 / 视觉等领域词）；显式意图确定性返回，不再依赖裁判。
- 裁判模型提示词升级为带示例的判定规则（few-shot），并给出每个场景的判定标准。
- 引入规则表版本（schemaVersion）自动迁移：升级后旧默认规则自动替换为新默认映射，手动定制保留；`/state` 接口暴露当前版本号。
- 测试覆盖扩充为 10 个场景的回归用例表共 8 组用例，全部通过。

## 0.2.1

- 修复「开发 / 实现 / 搭建一个 XX 系统」类请求被误判为 `daily`（日常对话 / 快速问答）导致命中 `deepseek-v4-flash-0731` 的问题：现在确定性进入 `coding` 路由，首位候选为 GLM-5.2。
- 「开发」「实现」「搭建」「构建」加入 `coding` 关键词表；裁判模型提示词补充说明开发/实现/搭建类请求应选 `coding`。

## 0.2.0

- 模型池不再手输模型名：所有模型从 dsh「设置 → 模型」中已配置的模型下拉选择。
- 新增场景候选链可视化编辑：每个场景可用下拉框增删候选模型，顺序即回退顺序。
- 裁判模型可在设置页下拉选择，留空时自动挑选可用的 Flash 模型。
- 首次使用自动写入最开始的规则内容：默认模型池与场景候选链无需手动添加；默认模型在 dsh 中不存在时自动替换为同系列（deepseek / glm / qwen / gpt）的真实配置模型并自动解析 Provider，找不到时保留原名称（路由时自动跳过）。

## 0.1.0

- Added scenario-based model selection for dsh.
- Added fallback routing when a selected model is unavailable or a request fails.
- Added persistent model-pool settings.
- Added Web settings and composer status UI.
- Added project planning, coding, reasoning, daily, fast, multimodal, and long-context routes.
