import axios from 'axios'
import { buildingLabel, normalizeRoom } from './buildings.js'
import { parsePowerHtml } from './power-parser.js'
import { buildPowerRequest } from './power-request.js'
import { Semaphore } from './semaphore.js'

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile MicroMessenger/8.0'
const schoolGate = new Semaphore(Number(process.env.SCHOOL_MAX_CONCURRENCY || 3))

export async function fetchPower(campus, building, room) {
  const normalizedRoom = normalizeRoom(room)
  const request = buildPowerRequest(campus, building, normalizedRoom)
  const response = await schoolGate.use(() => axios.get(request.url, {
    params: request.params,
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml'
    },
    timeout: 10000,
    responseType: 'text',
    maxContentLength: 512 * 1024,
    validateStatus: status => status >= 200 && status < 300
  }))
  const kwh = parsePowerHtml(response.data)
  return {
    campus,
    building,
    room: normalizedRoom,
    kwh,
    displayName: `${campus} · ${buildingLabel(campus, building)} · ${normalizedRoom}`,
    updatedAt: new Date().toISOString()
  }
}
