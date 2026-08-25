import axios from 'axios'
import { buildingLabel, normalizeRoom } from './buildings.js'
import { parsePowerHtml } from './power-parser.js'
import { buildPowerRequest } from './power-request.js'
import { Semaphore } from './semaphore.js'

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile MicroMessenger/8.0'
const schoolGate = new Semaphore(Number(process.env.SCHOOL_MAX_CONCURRENCY || 3))

export class PowerUpstreamError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'PowerUpstreamError'
    this.statusCode = 503
    this.expose = true
    this.cause = cause
  }
}

function requestError(error) {
  if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
    return new PowerUpstreamError('学校电量服务响应超时，请稍后再试', error)
  }
  if (error?.response?.status) {
    return new PowerUpstreamError(`学校电量服务返回异常（HTTP ${error.response.status}）`, error)
  }
  return new PowerUpstreamError('学校电量服务暂时无法连接，请稍后再试', error)
}

export async function fetchPower(campus, building, room) {
  const normalizedRoom = normalizeRoom(room)
  const request = buildPowerRequest(campus, building, normalizedRoom)
  let response
  try {
    response = await schoolGate.use(() => axios.get(request.url, {
      params: request.params,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml'
      },
      timeout: Math.max(1000, Math.min(30_000, Number(process.env.SCHOOL_TIMEOUT_MS) || 10_000)),
      responseType: 'text',
      maxContentLength: 512 * 1024,
      maxBodyLength: 512 * 1024,
      validateStatus: status => status >= 200 && status < 300
    }))
  } catch (error) {
    throw requestError(error)
  }

  let kwh
  try {
    kwh = parsePowerHtml(response.data)
  } catch (error) {
    throw new PowerUpstreamError('学校电量页面暂时无法识别，请稍后再试', error)
  }
  return {
    campus,
    building,
    room: normalizedRoom,
    kwh,
    displayName: `${campus} · ${buildingLabel(campus, building)} · ${normalizedRoom}`,
    updatedAt: new Date().toISOString()
  }
}
