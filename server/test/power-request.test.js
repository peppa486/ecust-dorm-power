import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPowerRequest, POWER_BASE_URL } from '../src/power-request.js'

test('builds Fengxian room query', () => {
  const request = buildPowerRequest('奉贤', '5', '202')
  assert.equal(request.url, POWER_BASE_URL)
  assert.deepEqual(request.params, {
    sysid: 1,
    roomid: '202',
    areaid: '2',
    buildid: '27'
  })
})

test('builds Xuhui special-building query', () => {
  assert.deepEqual(buildPowerRequest('徐汇', '南区4A', '101').params, {
    sysid: 1,
    roomid: '101',
    areaid: '3',
    buildid: '68'
  })
})
