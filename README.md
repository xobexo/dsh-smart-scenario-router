# dsh-smart-scenario-router

为 DeepSeek Harness（dsh）提供基于对话场景的模型路由。插件会根据用户消息选择合适的模型，并在请求失败时按候选链自动回退。

## 功能

- 根据消息内容识别以下场景：
  - 项目拆解 / 架构设计
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
- 为模型填写明确的 Provider。
- 查看每个模型对应的场景和优先级。
- 查看固定的场景候选链和裁判模型。

Provider 留空时，插件会尝试从 dsh 已注册的模型目录中自动解析。模型名称必须与当前 dsh 中实际注册的模型名称一致；如果模型未注册、Provider 不可用或模型无法解析，插件会继续尝试候选链中的下一个模型。

插件不会保存 API Key。Provider 的认证信息仍由 dsh 自己管理。

## 默认路由

| 场景 | 候选模型顺序 |
| --- | --- |
| `project_planning` | `deepseek-v4-pro-0813` → `glm-5.2` → `gpt-5.6-sol` |
| `coding` | `glm-5.2` → `deepseek-v4-pro-0813` → `gpt-5.6-sol` |
| `reasoning` | `deepseek-v4-pro-0813` → `qwen3.8-max` → `gpt-5.6-sol` |
| `daily` | `deepseek-v4-flash-0731` → `glm-5.2` → `gpt-5.6-luna` |
| `fast` | `deepseek-v4-flash-0731` → `gpt-5.6-luna` |
| `multimodal` | `qwen3.8-max` → `qwen3.7-max` → `gpt-5.6-sol` |
| `long_context` | `deepseek-v4-pro-0813` → `qwen3.8-max` → `gpt-5.6-sol` |

这些名称是默认候选值，不代表插件会自动提供模型或 Provider。使用前请确认它们已经在你的 dsh 配置中可用，或者在设置页调整模型池和 Provider。

## 工作方式

1. 插件读取当前会话中的用户消息。
2. 如果包含图片，或消息明确涉及图片内容，路由到 `multimodal`。
3. 如果文本很长，路由到 `long_context`。
4. 其他消息根据关键词匹配场景；置信度低于阈值时，调用裁判模型再次判断。
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
npx -y @deepseek-ai/dsh plugin --profile web add C:\path\to\dsh-smart-scenario-router\dsh-smart-scenario-router-0.1.0.tgz
```

打包内容由 `package.json` 的 `files` 字段控制，不需要提交 `node_modules`。

## 许可证

MIT
