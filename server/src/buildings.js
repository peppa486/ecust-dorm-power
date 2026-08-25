export const BUILDINGS = Object.freeze({
  奉贤: Object.freeze({
    '1': '1', '2': '2', '3': '3', '4': '4', '5': '27', '6': '28', '7': '29', '8': '30',
    '9': '31', '10': '32', '11': '33', '12': '34', '13': '35', '14': '36', '15': '37', '16': '38',
    '17': '39', '18': '40', '19': '41', '20': '42', '21': '43', '22': '44', '23': '45', '24': '46',
    '25': '49', '26': '50', '27': '51', '28': '52', '后勤职工': '55'
  }),
  徐汇: Object.freeze({
    '1': '64', '2': '47', '3': '5', '4': '6', '5': '7', '6': '8', '7': '9', '8': '10',
    '9': '11', '10': '12', '11': '13', '12': '14', '13': '15', '14': '16', '15': '17', '16': '18',
    '17': '19', '18': '20', '19': '21', '20': '22', '21': '23', '22': '24', '23': '25', '24': '26',
    '25': '48', '晨园': '53', '励志': '54', '南区1': '66', '南区2': '65', '南区3': '67',
    '南区4A': '68', '南区4B': '69'
  })
})

export function normalizeRoom(room) {
  return String(room ?? '').trim().toUpperCase()
}

export function roomKey(campus, building, room) {
  return `${campus}:${building}:${normalizeRoom(room)}`
}

export function validateRoom(campus, building, room) {
  if (!Object.hasOwn(BUILDINGS, campus)) throw new Error('不支持的校区')
  if (!Object.hasOwn(BUILDINGS[campus], building)) throw new Error('不支持的楼栋')
  const normalized = normalizeRoom(room)
  if (!/^(?=.*\d)[0-9A-Z-]{2,8}$/.test(normalized)) throw new Error('寝室号格式不正确')
  return normalized
}

const SPECIAL_LABELS = Object.freeze({
  '奉贤:后勤职工': '后勤职工宿舍',
  '徐汇:晨园': '晨园公寓',
  '徐汇:励志': '励志公寓',
  '徐汇:南区1': '南区第一宿舍楼',
  '徐汇:南区2': '南区第二宿舍楼',
  '徐汇:南区3': '南区第三宿舍楼',
  '徐汇:南区4A': '南区4A宿舍楼',
  '徐汇:南区4B': '南区4B宿舍楼'
})

export function buildingLabel(campus, building) {
  return SPECIAL_LABELS[`${campus}:${building}`] || `${building}号楼`
}

export function buildingOptions(campus) {
  if (!Object.hasOwn(BUILDINGS, campus)) throw new Error('不支持的校区')
  return Object.keys(BUILDINGS[campus]).map(value => ({ value, label: buildingLabel(campus, value) }))
}
