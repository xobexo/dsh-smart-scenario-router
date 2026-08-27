# Troubleshooting

## 插件安装后没有显示

确认安装命令使用的是 Web profile：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web list
```

如果列表中没有 `dsh-smart-scenario-router`，重新安装 GitHub 仓库：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web add github:xobexo/dsh-smart-scenario-router
```

安装后需要重启 dsh。只刷新浏览器页面不会重新加载服务端插件。

## 设置页没有“智能场景路由”

确认当前启动的是 `web` profile，而不是另一个 profile。然后重启：

```powershell
npx -y @deepseek-ai/dsh web
```

如果仍然没有显示，查看 dsh 启动日志中是否有插件加载错误。

## 模型显示为未选择

插件不会创建模型或 Provider。请先在 dsh 中配置至少一个模型，并确认模型名称与模型池中的名称完全一致。

也可以在 Web 设置页的 Provider 输入框中填写明确的 Provider。留空时插件会尝试从 dsh 的已注册模型目录自动解析。

## 路由没有切换

以下情况会保留当前模型：

- 当前会话已经固定了一个非默认模型。
- 所有候选模型都不可用。
- 用户手动选择了模型。

检查设置页中的模型是否启用，并确认对应 Provider 的认证信息由 dsh 正确管理。

## 请求失败后没有回退

回退只会发生在当前场景还有下一个候选模型，并且下一个模型通过可用性检查时。检查当前场景的默认候选链，以及模型池中对应模型是否被停用。

## 如何恢复默认模型池

插件设置保存在 dsh settings 中。要恢复默认值，可以在设置页重新启用默认模型并清空手动填写的 Provider，然后重启 dsh。
