# Contributing

感谢贡献代码、文档和问题反馈。

## 开发环境

- Node.js 22+
- pnpm
- DeepSeek Harness `>= 0.1.1-rc.1`

安装依赖：

```powershell
pnpm install
```

## 本地测试插件

从仓库根目录安装到 dsh Web profile：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web add .
```

修改代码后，重新执行安装命令并重启 dsh：

```powershell
npx -y @deepseek-ai/dsh plugin --profile web add .
npx -y @deepseek-ai/dsh web
```

## 修改建议

- 保持 `dsh.bundle` 和 `cordis.patch.yml` 可用。
- 不要提交 `node_modules`、`.tgz`、API Key 或本地配置文件。
- 新增模型名称前，确认它与 dsh 中注册的模型名称一致。
- 修改路由行为时，同时更新 README 中的默认路由说明。
- 提交前运行：

```powershell
git diff --check
pnpm pack --dry-run
```

## 提交信息

提交信息使用简短、明确的英文动词开头，例如：

```text
Improve coding scenario detection
Document provider configuration
Fix fallback route selection
```
