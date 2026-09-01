import assert from 'node:assert/strict'
import test from 'node:test'
import { classify } from './index.js'

// Keep retry policy tests independent from the plugin runtime wiring.
function isRetryableFailure(failure) {
  const code = String(failure && failure.code || '').toUpperCase()
  const message = String(failure && failure.message || '').toLowerCase()
  if (code.includes('INVALID') || code.includes('PARAMETER') || code.includes('VALIDATION') ||
    /invalid parameter|validation error|function_call\\.arguments|tool[_ -]?call/.test(message)) return false
  if (code.includes('ABORT') || code.includes('CANCEL')) return false
  return code.includes('TIMEOUT') || code.includes('UNAVAILABLE') || code.includes('OVERLOAD') ||
    code.includes('RATE') || code.includes('NETWORK') || code.includes('CONNECTION') ||
    /temporarily unavailable|too many requests|rate limit|timed out|timeout|connection reset|network error/.test(message)
}

function message(text) {
  return [{ role: 'user', content: [{ type: 'text', text }] }]
}

test('plugin requests win over the broad code keyword', () => {
  const result = classify(message('请帮我找一个插件，功能是能看到我的代码当前更改并进行对比'))
  assert.equal(result.tag, 'plugin_discovery')
})

test('Git diff requests use the code diff route', () => {
  const result = classify(message('请查看当前工作区的 Git diff，并显示这些代码变更'))
  assert.equal(result.tag, 'code_diff')
})

test('code quality analysis uses the code review route', () => {
  const result = classify(message('请审查这段代码，找出潜在问题和安全漏洞'))
  assert.equal(result.tag, 'code_review')
})

test('implementation, debugging and system development requests use the coding route (GLM-5.2 first)', () => {
  assert.equal(classify(message('帮我修复这个 TypeScript 报错')).tag, 'coding')
  assert.equal(classify(message('请编写一个接口并补充测试用例')).tag, 'coding')
  assert.equal(classify(message('开发一个消费者权益系统')).tag, 'coding')
  assert.equal(classify(message('帮我实现一个消费者权益系统')).tag, 'coding')
  assert.equal(classify(message('搭建一个官方网站')).tag, 'coding')
  assert.equal(classify(message('写一个 Python 脚本处理日志')).tag, 'coding')
  assert.equal(classify(message('修复一个登录模块的 bug')).tag, 'coding')
  assert.equal(classify(message('这个函数为什么会报错')).tag, 'coding')
  assert.equal(classify(message('数据库查询很慢怎么优化')).tag, 'coding')
  assert.equal(classify(message('给这段 Python 代码加单元测试')).tag, 'coding')
  assert.equal(classify(message('开发一个关于 HTTP 请求接收的 POST 接口，响应 200，使用 Golang 语言')).tag, 'coding')
})

test('scenario keyword tables route representative requests correctly', () => {
  const cases = [
    ['设计一个电商系统的技术架构', 'project_planning'],
    ['输出一份项目的里程碑规划', 'project_planning'],
    ['帮我规划一下这个系统的模块拆分', 'project_planning'],
    ['请找一个能解析日志的插件', 'plugin_discovery'],
    ['推荐一个好用的代码格式化工具', 'plugin_discovery'],
    ['对比一下这两个分支的改动', 'code_diff'],
    ['查看当前代码变更', 'code_diff'],
    ['帮我审查这段代码的安全漏洞', 'code_review'],
    ['这段代码有没有性能瓶颈', 'code_review'],
    ['提交前检查一下改动', 'code_review'],
    ['解决一道数论证明题', 'reasoning'],
    ['设计一个多 Agent 的工作流', 'reasoning'],
    ['批量提取 5000 条文本的关键词', 'fast'],
    ['把这批数据去重清洗一下', 'fast'],
    ['识别这张截图里的表格', 'multimodal'],
    ['帮我看看这张照片', 'multimodal'],
    ['总结这份两万字的会议纪要', 'long_context'],
    ['分析这份销售数据报表', 'long_context'],
    ['把这份日志分析一下', 'long_context'],
    ['什么是微服务', 'daily'],
    ['怎么做番茄炒蛋', 'daily'],
    ['解释一下什么是依赖注入', 'daily'],
    ['写一首诗', 'daily'],
  ]
  for (const [text, expected] of cases) {
    assert.equal(classify(message(text)).tag, expected, text)
  }
})

test('pure greetings stay daily but attached requests do not', () => {
  assert.equal(classify(message('你好')).tag, 'daily')
  assert.equal(classify(message('谢谢')).tag, 'daily')
  assert.equal(classify(message('你好，帮我写个脚本')).tag, 'coding')
})

test('tool-call argument validation failures are not retried', () => {
  assert.equal(isRetryableFailure({
    code: 'InvalidParameter',
    message: 'validation error for Message.function_call.arguments: Input should be a valid string',
  }), false)
})

test('transient upstream failures remain retryable', () => {
  assert.equal(isRetryableFailure({ code: 'UPSTREAM_UNAVAILABLE', message: 'temporarily unavailable' }), true)
})
