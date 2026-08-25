import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePowerHtml } from '../src/power-parser.js'

test('parses direct degree value', () => {
  assert.equal(parsePowerHtml('<div>23.56度</div>'), 23.56)
})

test('prefers value near remaining-power label', () => {
  const html = '<div>今日用电 3.2 度</div><div>剩余电量：18.75 kWh</div>'
  assert.equal(parsePowerHtml(html), 18.75)
})

test('parses the negative value returned by the school page', () => {
  assert.equal(parsePowerHtml('<div>房间 202</div><div>剩余电量 -18.8度</div>'), -18.8)
})

test('accepts a labeled value without a unit', () => {
  assert.equal(parsePowerHtml('<span>剩余电量：18.75</span>'), 18.75)
})

test('ignores values inside scripts and rejects missing power', () => {
  assert.throws(() => parsePowerHtml('<script>const x = "99度"</script><p>维护中</p>'), /没有解析到电量/)
})

test('rejects ambiguous degree values instead of choosing a metric', () => {
  assert.throws(() => parsePowerHtml('<p>房间 202</p><p>今日用电 3度</p><p>充值 20度</p>'), /不明确/)
})

test('rejects an out-of-range negative value', () => {
  assert.throws(() => parsePowerHtml('<div>剩余电量 -101度</div>'), /没有解析到电量/)
})
