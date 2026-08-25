import { BUILDINGS, validateRoom } from './buildings.js'

export const POWER_BASE_URL = 'https://yktyd.ecust.edu.cn/epay/wxpage/wanxiao/eleresult'

export function buildPowerRequest(campus, building, room) {
  const normalizedRoom = validateRoom(campus, building, room)
  return {
    url: POWER_BASE_URL,
    params: {
      sysid: 1,
      roomid: normalizedRoom,
      areaid: campus === '奉贤' ? '2' : '3',
      buildid: BUILDINGS[campus][building]
    }
  }
}
