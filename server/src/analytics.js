function toMs(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function round(value, digits = 1) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const MAX_POWER = 100_000
const MAX_INTERVAL_HOURS = 48
const MAX_CONSUMPTION_RATE = 10
const MAX_ESTIMATED_DAYS = 365

export function normalizeHistory(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      ...item,
      kwh: Number(item.kwh),
      timeMs: toMs(item.created_at ?? item.createdAt)
    }))
    .filter(item => Number.isFinite(item.kwh) && item.kwh >= -100 && item.kwh <= MAX_POWER && item.timeMs !== null)
    .sort((a, b) => a.timeMs - b.timeMs)
}

export function computeHistoryStats(items, nowMs = Date.now()) {
  const points = normalizeHistory(items)
  if (!points.length) {
    return { current: null, consumed24h: null, dailyAverage: null, estimatedDays: null, rechargeCount: 0 }
  }

  let totalConsumed = 0
  let consumed24h = 0
  let rechargeCount = 0
  const dayAgo = nowMs - DAY_MS
  let validHours = 0

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    const intervalMs = curr.timeMs - prev.timeMs
    const intervalHours = intervalMs / HOUR_MS
    if (intervalHours <= 0 || intervalHours > MAX_INTERVAL_HOURS) continue
    const drop = prev.kwh - curr.kwh
    if (drop > 0 && drop < 100 && drop / intervalHours <= MAX_CONSUMPTION_RATE) {
      totalConsumed += drop
      validHours += intervalHours
      const overlapMs = Math.max(0, Math.min(curr.timeMs, nowMs) - Math.max(prev.timeMs, dayAgo))
      if (overlapMs > 0) consumed24h += drop * (overlapMs / intervalMs)
    } else if (drop < -2) {
      rechargeCount += 1
    } else {
      validHours += intervalHours
    }
  }

  const firstTime = points[0].timeMs
  const lastTime = points.at(-1).timeMs
  const covered24h = firstTime <= dayAgo + 2 * HOUR_MS && lastTime >= nowMs - 2 * HOUR_MS
  const dailyAverage = validHours >= 12 ? totalConsumed / (validHours / 24) : null
  const current = points.at(-1).kwh
  const rawEstimatedDays = dailyAverage && dailyAverage >= 0.05
    ? Math.max(current, 0) / dailyAverage
    : null
  const estimatedDays = rawEstimatedDays === null ? null : Math.min(rawEstimatedDays, MAX_ESTIMATED_DAYS)

  return {
    current: round(current, 2),
    consumed24h: covered24h ? round(consumed24h, 1) : null,
    dailyAverage: dailyAverage === null ? null : round(dailyAverage, 1),
    estimatedDays: estimatedDays === null ? null : round(estimatedDays, 1),
    rechargeCount
  }
}
