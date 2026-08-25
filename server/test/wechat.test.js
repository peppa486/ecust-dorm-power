import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'

process.env.WECHAT_FIELD_ROOM = 'thing1'
process.env.WECHAT_FIELD_POWER = 'number2'
process.env.WECHAT_FIELD_POWER_TYPE = 'number'
process.env.WECHAT_FIELD_TIP = 'thing3'
process.env.WECHAT_LOW_POWER_TEMPLATE_ID = 'template-id'
process.env.WECHAT_APPID = 'appid'
process.env.WECHAT_SECRET = 'secret'

const watch = { campus: '奉贤', building: '5', room: '202', threshold: 15 }

test('builds subscription fields from environment configuration', async () => {
  const { buildLowPowerData } = await import('../src/wechat.js?data')
  assert.deepEqual(buildLowPowerData(watch, 8.5), {
    thing1: { value: '奉贤5号楼 202' },
    number2: { value: '8.5' },
    thing3: { value: '低于 15 度，请及时充值' }
  })
})

test('concurrent sends share one access-token request', async () => {
  let tokenCalls = 0
  let sendCalls = 0
  mock.method(axios, 'get', async () => {
    tokenCalls += 1
    await new Promise(resolve => setTimeout(resolve, 10))
    return { data: { access_token: 'token', expires_in: 7200 } }
  })
  mock.method(axios, 'post', async () => {
    sendCalls += 1
    return { data: { errcode: 0 } }
  })

  const { sendLowPower } = await import('../src/wechat.js?concurrent')
  await Promise.all([
    sendLowPower('user-1', watch, 8),
    sendLowPower('user-2', watch, 7)
  ])
  assert.equal(tokenCalls, 1)
  assert.equal(sendCalls, 2)
  mock.restoreAll()
})

test('refreshes an invalid access token once', async () => {
  let tokenCalls = 0
  let sendCalls = 0
  mock.method(axios, 'get', async () => ({
    data: { access_token: `token-${++tokenCalls}`, expires_in: 7200 }
  }))
  mock.method(axios, 'post', async () => ({
    data: sendCalls++ === 0 ? { errcode: 40014, errmsg: 'invalid token' } : { errcode: 0 }
  }))

  const { sendLowPower } = await import('../src/wechat.js?refresh')
  await sendLowPower('user-1', watch, 8)
  assert.equal(tokenCalls, 2)
  assert.equal(sendCalls, 2)
  mock.restoreAll()
})

test('preserves typed WeChat errors for subscription handling', async () => {
  mock.method(axios, 'get', async () => ({
    data: { access_token: 'token', expires_in: 7200 }
  }))
  mock.method(axios, 'post', async () => ({
    data: { errcode: 43101, errmsg: 'no subscription credit' }
  }))

  const { sendLowPower, WeChatSendError } = await import('../src/wechat.js?errors')
  await assert.rejects(
    () => sendLowPower('user-1', watch, 8),
    error => error instanceof WeChatSendError && error.code === 43101
  )
  mock.restoreAll()
})
