export function formatShortTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

export function sameRoom(a, b) {
  if (!a || !b) return false
  return a.campus === b.campus && a.building === b.building && String(a.room) === String(b.room)
}
