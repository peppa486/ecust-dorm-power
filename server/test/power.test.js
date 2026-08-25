import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { fetchPower, PowerUpstreamError } from '../src/power.js'

test('classifies school timeouts without exposing Axios details', async () => {
  mock.method(axios, 'get', async () => {
    const error = new Error('timeout of 10000ms exceeded')
    error.code = 'ECONNABORTED'
    throw error
  })
  await assert.rejects(
    () => fetchPower('奉贤', '5', '212'),
    error => error instanceof PowerUpstreamError
      && error.statusCode === 503
      && error.message === '学校电量服务响应超时，请稍后再试'
  )
  mock.restoreAll()
})

test('classifies an unrecognized school page as upstream data failure', async () => {
  mock.method(axios, 'get', async () => ({ data: '<html><body>系统维护中</body></html>' }))
  await assert.rejects(
    () => fetchPower('徐汇', '南区4A', '213'),
    error => error instanceof PowerUpstreamError
      && error.statusCode === 503
      && error.message === '学校电量页面暂时无法识别，请稍后再试'
  )
  mock.restoreAll()
})
