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

test('ignores values inside scripts and rejects missing power', () => {
  assert.throws(() => parsePowerHtml('<script>const x = "99度"</script><p>维护中</p>'), /没有解析到电量/)
})
