# Changelog

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
