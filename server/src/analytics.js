function toMs(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function round(value, digits = 1) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

export function normalizeHistory(items) {
  return items
    .map(item => ({
      ...item,
      kwh: Number(item.kwh),
      timeMs: toMs(item.created_at ?? item.createdAt)
    }))
    .filter(item => Number.isFinite(item.kwh) && item.timeMs !== null)
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
  const dayAgo = nowMs - 24 * 60 * 60 * 1000

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    const drop = prev.kwh - curr.kwh
    if (drop > 0 && drop < 100) {
      totalConsumed += drop
      if (prev.timeMs >= dayAgo) consumed24h += drop
    } else if (drop < -2) {
      rechargeCount += 1
    }
  }

  const spanHours = (points.at(-1).timeMs - points[0].timeMs) / 3_600_000
  const covered24h = points[0].timeMs <= dayAgo + 2 * 3_600_000
  const dailyAverage = spanHours >= 12 ? totalConsumed / (spanHours / 24) : null
  const current = points.at(-1).kwh
  const estimatedDays = dailyAverage && dailyAverage >= 0.05 ? Math.max(current, 0) / dailyAverage : null

  return {
    current: round(current, 2),
    consumed24h: covered24h ? round(consumed24h, 1) : null,
    dailyAverage: dailyAverage === null ? null : round(dailyAverage, 1),
    estimatedDays: estimatedDays === null ? null : round(estimatedDays, 1),
    rechargeCount
  }
}
