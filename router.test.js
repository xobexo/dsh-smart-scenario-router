import assert from 'node:assert/strict'
import test from 'node:test'
import { classify } from './index.js'

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

test('implementation and debugging requests remain coding', () => {
  assert.equal(classify(message('帮我修复这个 TypeScript 报错')).tag, 'coding')
  assert.equal(classify(message('请编写一个接口并补充测试用例')).tag, 'coding')
})
