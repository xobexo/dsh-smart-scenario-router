# dsh-smart-scenario-router

为 DeepSeek Harness（dsh）提供基于对话场景的模型路由。插件会根据用户消息选择合适的模型，并在请求失败时按候选链自动回退。

## 功能

- 根据消息内容识别以下场景：
  - 项目拆解 / 架构设计
  - 插件查找 / 工具推荐
  - 代码审查
  - 代码变更对比
  - 代码编写 / 调试
  - 复杂推理 / 科研 / Agent
  - 日常对话 / 快速问答
  - 极速高并发 / 批量抽取
  - 多模态（图文输入）
  - 长文本 / 数据分析
- 优先使用国产模型，配置的 GPT 模型作为兜底。
- 请求失败时自动尝试当前场景的下一个模型。
- 低置信度的消息会使用 `deepseek-v4-flash-0731` 进行场景判断。
- 在 dsh Web 设置页显示模型池、场景映射和当前路由状态。
- 模型池配置会通过 dsh settings 持久化保存。

## 安装

要求：

- DeepSeek Harness `>= 0.1.1-rc.1`
- Node.js 和 pnpm
- 已在 dsh 中配置至少一个可用的模型 Provider

直接从 GitHub 安装：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web add github:xobexo/dsh-smart-scenario-router
```

也可以使用完整仓库地址：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web add https://github.com/xobexo/dsh-smart-scenario-router.git
```

安装后重启 Web profile：

```powershell
npx -y @deepseek-ai/dsh web
```

检查插件是否已安装：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web list
```

## 更新

更新已经安装的插件：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web update dsh-smart-scenario-router
```

如果是从 GitHub 安装的旧版本，也可以再次执行安装命令：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web add github:xobexo/dsh-smart-scenario-router
```

## 卸载

```powershell
npx -y @deepseek-ai/dsh plugin --profile web remove dsh-smart-scenario-router
```

卸载后重启 dsh。

## 配置

打开 dsh Web 界面的设置页，找到“智能场景路由”。这里可以：

- 启用或停用模型池中的模型。
- 所有模型都通过下拉框从 dsh「设置 → 模型」中已配置的模型中选择，不需要手输模型名称。
- 为模型填写明确的 Provider（留空时自动解析）。
- 查看每个模型对应的场景和优先级。
- 编辑每个场景的候选链（模型下拉框 + 追加 / 移除候选，顺序即回退顺序）。
- 选择裁判模型（留空为自动，优先挑选可用的 Flash 模型）。

首次使用时，插件会把最开始的规则内容（默认模型池 + 每个场景的候选链）自动写入配置，不需要手动添加：默认模型在 dsh「设置 → 模型」里不存在时，会自动替换为同系列（deepseek / glm / qwen / gpt）的真实配置模型并填入自动解析的 Provider；连同系列都没有时才保留原名称（设置页标注“未配置”，路由时自动跳过）。模型名称按 Harness 已配置的原值传递；如果模型未注册、Provider 不可用或模型无法解析，插件会继续尝试候选链中的下一个模型。

插件不会保存 API Key。Provider 的认证信息仍由 dsh 自己管理。

## 502 上游错误排查

如果直接选择 GLM-5.2 可以正常调用，但启用本插件后出现 `502 upstream service unavailable`，请打开“智能场景路由”设置，确认 GLM-5.2 的 Provider 与 dsh「设置 → 模型」中实际可用的 Provider 完全一致。插件会校验 provider/model 组合后再注入请求；显式填写 Provider 时不会静默切换到同名模型的其他 Provider。修改配置后重启 Web profile，使已安装的插件包重新加载。

该错误通常发生在模型已配置但 Provider 路由不匹配、Provider 上游暂时不可用，或安装的插件包不是当前源码版本；502 是上游调用失败，不是 Go POST 接口返回的 HTTP 状态。

## 默认路由

| 场景 | 候选模型顺序 | 设计理由 |
| --- | --- | --- |
| `project_planning` | `glm-5.2` → `deepseek-v4-pro-0813` → `gpt-5.6-sol` | 中文架构 / 方案表达与结构化规划最佳 |
| `plugin_discovery` | `deepseek-v4-flash-0731` → `glm-5.2` → `gpt-5.6-luna` | 检索推荐类轻量任务，快优先 |
| `code_review` | `deepseek-v4-pro-0813` → `glm-5.2` → `gpt-5.6-sol` | 需要深层次逻辑与安全漏洞洞察 |
| `code_diff` | `glm-5.2` → `deepseek-v4-flash-0731` → `gpt-5.6-luna` | 变更解释要求准确清晰，快模型兜底提速 |
| `coding` | `glm-5.2` → `deepseek-v4-pro-0813` → `gpt-5.6-sol` | 编写 / 调试代码首选，中文交互好 |
| `reasoning` | `deepseek-v4-pro-0813` → `qwen3.8-max` → `gpt-5.6-sol` | 深度推理主用，数学 / 科研由 qwen 兜底 |
| `daily` | `deepseek-v4-flash-0731` → `glm-5.2` → `gpt-5.6-luna` | 简单问答快速省，GLM 提升回答质量 |
| `fast` | `deepseek-v4-flash-0731` → `gpt-5.6-luna` | 极速抽取 / 批量任务，快优先 |
| `multimodal` | `qwen3.8-max` → `qwen3.7-max` → `gpt-5.6-sol` | qwen 系视觉理解能力最强 |
| `long_context` | `qwen3.8-max` → `deepseek-v4-pro-0813` → `gpt-5.6-sol` | 长上下文 + 数据处理，deepseek 兜底 |

### 场景 → 模型设计原则

- **深度编写 / 审查 / 架构** → `glm-5.2`（中文代码能力最强、表达清晰）与 `deepseek-v4-pro`（深度推理）交替主用。
- **轻量问答 / 抽取 / 分类 / 推荐** → `deepseek-v4-flash`（快、省 token）。
- **复杂推理 / 科研 / 数学 / Agent** → `deepseek-v4-pro` + `qwen3.8-max`（数学推理强）。
- **视觉 / 图片** → qwen 系（多模态支持）。
- **长文本 / 数据分析** → `qwen3.8-max`（长上下文 + 数据处理），deepseek-pro 兜底。
- **GPT 只作最后兜底**：`sol`（强）兜深度任务，`luna`（轻）兜轻量任务。

这些名称是默认候选值，不代表插件会自动提供模型或 Provider。首次使用时，插件会把上表中的规则内容自动写入：dsh「设置 → 模型」中存在的模型原样保留并自动解析 Provider，不存在的默认模型自动替换为同系列的真实配置模型（找不到时保留原名称并在路由时跳过），无需手动添加；也可以在设置页用下拉框调整。

> **升级注意**：0.3.0 起引入了规则表版本（schemaVersion）。旧版安装升级后，持久化的默认规则会被自动替换为新的默认映射（这是升级默认路由的必要代价）；你在设置页手动定制过的候选链 / 模型池会保留，仅规则表版本号会被更新。

## 工作方式

1. 插件读取当前会话中的用户消息。
2. 如果包含图片，或消息明确涉及图片内容，路由到 `multimodal`。
3. 如果文本很长，路由到 `long_context`。
4. 其他消息先按高优先级意图匹配：插件查找 / 工具推荐进入 `plugin_discovery`，Git diff / 当前修改进入 `code_diff`，代码质量、漏洞和潜在问题分析进入 `code_review`，架构 / 方案 / 规划类请求进入 `project_planning`；编写、调试或修复代码，以及「开发 / 实现 / 搭建 / 构建系统、应用、接口等」请求进入 `coding`（首位候选为 GLM-5.2）。剩余消息再根据双语关键词表（含中英文、常见编程词）匹配场景；置信度低于阈值时，调用裁判模型（默认 Flash，可在设置页更换）按带示例的规则再次判断。
5. 插件检查候选模型是否可用，并选择第一个可用模型。
6. 请求失败时，继续尝试当前场景候选链中的下一个模型。

如果用户在 dsh 中手动选择了非默认模型，插件会保留这次手动选择，不强制替换。

## 本地开发安装

克隆仓库后，可以直接从本地目录安装：

```powershell
git clone https://github.com/xobexo/dsh-smart-scenario-router.git
npx -y @deepseek-ai/dsh plugin --profile web add C:\path\to\dsh-smart-scenario-router
```

或者使用本地 tarball：

```powershell
cd C:\path\to\dsh-smart-scenario-router
pnpm install
pnpm pack
npx -y @deepseek-ai/dsh plugin --profile web add C:\path\to\dsh-smart-scenario-router\dsh-smart-scenario-router-0.2.0.tgz
```

打包内容由 `package.json` 的 `files` 字段控制，不需要提交 `node_modules`。

## 许可证

MIT
