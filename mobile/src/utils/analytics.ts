import type { HistoryPoint } from '../storage/history'
import type { MobileHistoryResponse } from '../types/api'

export type ServerHistoryStats = MobileHistoryResponse['stats']

export interface HourlyBucket {
  hour: number
  label: string
  rangeLabel: string
  kwh: number
  hasSample: boolean
}

export interface HourlyDayRecord {
  dateKey: string
  label: string
  shortLabel: string
  weekdayLabel: string
  totalKwh: number
  peakHour: number | null
  peakKwh: number
  hours: HourlyBucket[]
}

export interface DailyConsumptionPoint {
  dateKey: string
  label: string
  shortLabel: string
  weekdayShort: string
  kwh: number
  isToday: boolean
  isWeekend: boolean
  hasSample: boolean
}

export type PeriodId = 'evening' | 'night' | 'afternoon' | 'morning'

export interface PeriodShare {
  id: PeriodId
  label: string
  rangeLabel: string
  kwh: number
  percentage: number
  color: string
}

export interface HeatmapCell {
  hour: number
  kwh: number
  level: 0 | 1 | 2 | 3 | 4
  hasSample: boolean
}

export interface HeatmapRow {
  dateKey: string
  label: string
  shortLabel: string
  totalKwh: number
  cells: HeatmapCell[]
}

export interface ForecastPoint {
  kwh: number
  createdAt: string
  timestamp: number
}

export interface PowerAnalyticsSummary {
  current: number | null
  consumed24h: number | null
  dailyAverage: number | null
  estimatedDays: number | null
  estimatedDepletionLabel: string
  thresholdEtaLabel: string
  rechargeCount: number
  lastRechargeAmount: number | null
  peakWindowLabel: string
  sampleCount: number
}

export interface PowerAnalytics {
  summary: PowerAnalyticsSummary
  hourlyDays: HourlyDayRecord[]
  dailyBars: DailyConsumptionPoint[]
  periods: PeriodShare[]
  heatmap: HeatmapRow[]
  forecastPoints: ForecastPoint[]
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const MAX_INTERVAL_HOURS = 48
const MAX_HOURLY_RATE = 12
const RECHARGE_DROP_THRESHOLD = -2
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const
const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'] as const

function round(value: number, digits = 2): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfLocalDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function formatDayLabel(dayStartMs: number, todayStartMs: number): {
  label: string
  shortLabel: string
  weekdayLabel: string
  weekdayShort: string
  isToday: boolean
  isWeekend: boolean
} {
  const date = new Date(dayStartMs)
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const dow = date.getDay()
  const weekdayLabel = WEEKDAYS[dow]
  const weekdayShort = WEEKDAYS_SHORT[dow]
  const diffDays = Math.round((todayStartMs - dayStartMs) / DAY_MS)
  const shortLabel = `${month}-${day}`
  const isToday = diffDays === 0
  const isWeekend = dow === 0 || dow === 6

  let label = `${month}月${day}日 ${weekdayLabel}`
  if (diffDays === 0) label = `今天 · ${month}月${day}日`
  else if (diffDays === 1) label = `昨天 · ${month}月${day}日`

  return { label, shortLabel, weekdayLabel, weekdayShort, isToday, isWeekend }
}

function createEmptyHours(): HourlyBucket[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${pad2(hour)}:00`,
    rangeLabel: `${pad2(hour)}:00–${pad2((hour + 1) % 24)}:00`,
    kwh: 0,
    hasSample: false
  }))
}

interface NormalizedSample {
  kwh: number
  createdAt: string
  timeMs: number
  recharged: boolean
}

function normalizeSamples(points: HistoryPoint[]): NormalizedSample[] {
  return (Array.isArray(points) ? points : [])
    .map(point => ({
      kwh: Number(point.kwh),
      createdAt: point.createdAt,
      timeMs: Date.parse(point.createdAt),
      recharged: Boolean(point.recharged)
    }))
    .filter(item => Number.isFinite(item.kwh) && item.kwh >= -100 && item.kwh <= 100_000 && Number.isFinite(item.timeMs))
    .sort((a, b) => a.timeMs - b.timeMs)
}

export function analyzePowerHistory(
  points: HistoryPoint[],
  serverStats?: ServerHistoryStats | null,
  threshold = 15,
  nowMs = Date.now()
): PowerAnalytics {
  const samples = normalizeSamples(points)
  const todayStartMs = startOfLocalDay(nowMs)

  // 初始化最近 14 天的日容器
  const dayMap = new Map<string, {
    dayStartMs: number
    hours: HourlyBucket[]
  }>()

  for (let offset = 13; offset >= 0; offset -= 1) {
    const dayStartMs = todayStartMs - offset * DAY_MS
    const key = toLocalDateKey(dayStartMs)
    dayMap.set(key, {
      dayStartMs,
      hours: createEmptyHours()
    })
  }

  let totalConsumed = 0
  let consumed24h = 0
  let validHours = 0
  let rechargeCount = 0
  let lastRechargeAmount: number | null = null
  const dayAgoMs = nowMs - DAY_MS
  const hourProfile = new Array<number>(24).fill(0)

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1]
    const curr = samples[i]
    const intervalMs = curr.timeMs - prev.timeMs
    const intervalHours = intervalMs / HOUR_MS
    if (intervalHours <= 0 || intervalHours > MAX_INTERVAL_HOURS) continue

    const drop = prev.kwh - curr.kwh
    if (drop < RECHARGE_DROP_THRESHOLD || curr.recharged) {
      rechargeCount += 1
      if (drop < RECHARGE_DROP_THRESHOLD) {
        lastRechargeAmount = round(-drop, 1)
      }
      continue
    }

    if (drop >= 0 && drop < 100 && drop / intervalHours <= MAX_HOURLY_RATE) {
      totalConsumed += drop
      validHours += intervalHours

      const overlap24h = Math.max(0, Math.min(curr.timeMs, nowMs) - Math.max(prev.timeMs, dayAgoMs))
      if (overlap24h > 0) {
        consumed24h += drop * (overlap24h / intervalMs)
      }

      // 将 [prev.timeMs, curr.timeMs] 按自然整点切分并分摊耗电量
      let cursor = prev.timeMs
      while (cursor < curr.timeMs) {
        const cursorDate = new Date(cursor)
        const nextHourDate = new Date(cursor)
        nextHourDate.setMinutes(0, 0, 0)
        nextHourDate.setHours(cursorDate.getHours() + 1)
        const sliceEnd = Math.min(curr.timeMs, nextHourDate.getTime())
        const sliceMs = Math.max(0, sliceEnd - cursor)

        if (sliceMs > 0) {
          const shareKwh = drop * (sliceMs / intervalMs)
          const dateKey = toLocalDateKey(cursor)
          const hourIndex = cursorDate.getHours()
          hourProfile[hourIndex] += shareKwh

          if (!dayMap.has(dateKey)) {
            const customDayStart = startOfLocalDay(cursor)
            dayMap.set(dateKey, {
              dayStartMs: customDayStart,
              hours: createEmptyHours()
            })
          }
          const dayRecord = dayMap.get(dateKey)
          if (dayRecord) {
            dayRecord.hours[hourIndex].kwh += shareKwh
            dayRecord.hours[hourIndex].hasSample = true
          }
        }
        cursor = sliceEnd > cursor ? sliceEnd : cursor + 60_000
      }
    } else if (Math.abs(drop) <= 2) {
      validHours += intervalHours
    }
  }

  // 构建按日期升序排列的 HourlyDayRecord 列表（保留最近 14 天）
  const sortedDayEntries = Array.from(dayMap.entries())
    .sort((a, b) => a[1].dayStartMs - b[1].dayStartMs)
    .slice(-14)

  const hourlyDays: HourlyDayRecord[] = sortedDayEntries.map(([dateKey, entry]) => {
    const meta = formatDayLabel(entry.dayStartMs, todayStartMs)
    const hours = entry.hours.map(bucket => ({
      ...bucket,
      kwh: round(bucket.kwh, 2)
    }))
    const totalKwh = round(hours.reduce((acc, item) => acc + item.kwh, 0), 2)
    let peakHour: number | null = null
    let peakKwh = 0
    for (const bucket of hours) {
      if (bucket.kwh > peakKwh) {
        peakKwh = bucket.kwh
        peakHour = bucket.hour
      }
    }
    return {
      dateKey,
      label: meta.label,
      shortLabel: meta.shortLabel,
      weekdayLabel: meta.weekdayLabel,
      totalKwh,
      peakHour,
      peakKwh: round(peakKwh, 2),
      hours
    }
  })

  // 近 14 天每日耗电柱状图
  const dailyBars: DailyConsumptionPoint[] = sortedDayEntries.map(([dateKey, entry]) => {
    const meta = formatDayLabel(entry.dayStartMs, todayStartMs)
    const rawTotal = entry.hours.reduce((acc, item) => acc + item.kwh, 0)
    const hasSample = entry.hours.some(item => item.hasSample)
    return {
      dateKey,
      label: meta.label,
      shortLabel: meta.shortLabel,
      weekdayShort: meta.isToday ? '今' : meta.weekdayShort,
      kwh: round(rawTotal, 2),
      isToday: meta.isToday,
      isWeekend: meta.isWeekend,
      hasSample
    }
  })

  // 四时段耗电占比（基于最近 7 天或全部有效样本）
  const recent7Days = hourlyDays.slice(-7)
  const periodTotals: Record<PeriodId, number> = {
    night: 0,
    morning: 0,
    afternoon: 0,
    evening: 0
  }

  for (const day of recent7Days) {
    for (const bucket of day.hours) {
      if (bucket.hour < 6) periodTotals.night += bucket.kwh
      else if (bucket.hour < 12) periodTotals.morning += bucket.kwh
      else if (bucket.hour < 18) periodTotals.afternoon += bucket.kwh
      else periodTotals.evening += bucket.kwh
    }
  }

  const periodSum = periodTotals.evening + periodTotals.night + periodTotals.afternoon + periodTotals.morning
  const rawPeriodDefs: Array<{ id: PeriodId; label: string; rangeLabel: string; color: string }> = [
    { id: 'evening', label: '晚间高峰', rangeLabel: '18:00–24:00', color: '#007AFF' },
    { id: 'night', label: '夜间睡眠', rangeLabel: '00:00–06:00', color: '#30B0C7' },
    { id: 'afternoon', label: '午间活动', rangeLabel: '12:00–18:00', color: '#34C759' },
    { id: 'morning', label: '上午课时', rangeLabel: '06:00–12:00', color: '#FF9500' }
  ]

  const periods: PeriodShare[] = rawPeriodDefs.map(def => {
    const kwh = round(periodTotals[def.id], 2)
    const percentage = periodSum > 0.01 ? Math.round((periodTotals[def.id] / periodSum) * 100) : 0
    return {
      ...def,
      kwh,
      percentage
    }
  })

  // 修正四舍五入百分比总和为 100%
  if (periodSum > 0.01) {
    const currentPctSum = periods.reduce((sum, item) => sum + item.percentage, 0)
    const diff = 100 - currentPctSum
    if (diff !== 0) {
      let maxIdx = 0
      for (let i = 1; i < periods.length; i += 1) {
        if (periods[i].kwh > periods[maxIdx].kwh) maxIdx = i
      }
      periods[maxIdx].percentage = Math.max(0, periods[maxIdx].percentage + diff)
    }
  }

  // 7×24h 用电密度热力矩阵（最新一天在最上方）
  const allRecentHourlyValues = recent7Days
    .flatMap(day => day.hours.map(h => h.kwh))
    .filter(v => v > 0.01)
  const maxHourlyKwh = allRecentHourlyValues.length ? Math.max(...allRecentHourlyValues, 0.25) : 0.5

  const heatmap: HeatmapRow[] = [...recent7Days].reverse().map(day => ({
    dateKey: day.dateKey,
    label: day.label,
    shortLabel: day.shortLabel.slice(3), // 仅保留日期或简短标识
    totalKwh: day.totalKwh,
    cells: day.hours.map(bucket => {
      let level: 0 | 1 | 2 | 3 | 4 = 0
      if (bucket.kwh > 0.005) {
        const ratio = bucket.kwh / maxHourlyKwh
        if (ratio >= 0.75) level = 4
        else if (ratio >= 0.5) level = 3
        else if (ratio >= 0.25) level = 2
        else level = 1
      }
      return {
        hour: bucket.hour,
        kwh: bucket.kwh,
        level,
        hasSample: bucket.hasSample
      }
    })
  }))

  // 汇总统计与服务端 stats 融合
  const current = samples.length
    ? round(samples[samples.length - 1].kwh, 2)
    : (serverStats?.current ?? null)

  const computedDailyAvg = validHours >= 6 ? round(totalConsumed / (validHours / 24), 1) : null
  const dailyAverage = serverStats?.dailyAverage ?? computedDailyAvg

  const computedConsumed24h = validHours >= 2 ? round(consumed24h, 1) : null
  const finalConsumed24h = serverStats?.consumed24h ?? computedConsumed24h

  const computedEstimatedDays = current !== null && dailyAverage !== null && dailyAverage >= 0.05
    ? round(Math.min(365, Math.max(0, current) / dailyAverage), 1)
    : null
  const estimatedDays = serverStats?.estimatedDays ?? computedEstimatedDays

  const finalRechargeCount = Math.max(rechargeCount, serverStats?.rechargeCount ?? 0)

  // 计算最高频用电窗口（连续 2 小时峰值）
  let bestStartHour = 21
  let bestWindowSum = 0
  for (let h = 0; h < 24; h += 1) {
    const pairSum = hourProfile[h] + hourProfile[(h + 1) % 24]
    if (pairSum > bestWindowSum) {
      bestWindowSum = pairSum
      bestStartHour = h
    }
  }
  const peakWindowLabel = bestWindowSum > 0.02
    ? `${pad2(bestStartHour)}:00–${pad2((bestStartHour + 2) % 24)}:00`
    : '暂无峰值'

  // 预计耗尽日期与触达阈值时间
  let estimatedDepletionLabel = '采样积累中'
  let thresholdEtaLabel = '采样积累中'
  if (current !== null && dailyAverage !== null && dailyAverage >= 0.1) {
    const hoursToZero = (Math.max(0, current) / dailyAverage) * 24
    if (hoursToZero <= 24) {
      estimatedDepletionLabel = '预计 24 小时内耗尽'
    } else if (hoursToZero <= 24 * 90) {
      const targetDate = new Date(nowMs + hoursToZero * HOUR_MS)
      estimatedDepletionLabel = `预计 ${targetDate.getMonth() + 1}月${targetDate.getDate()}日 耗尽`
    } else {
      estimatedDepletionLabel = '余量充足 (>90天)'
    }

    if (current <= threshold) {
      thresholdEtaLabel = `已低于阈值 (${threshold}度)`
    } else {
      const hoursToThreshold = ((current - threshold) / dailyAverage) * 24
      if (hoursToThreshold <= 24) {
        thresholdEtaLabel = `约 ${Math.max(1, Math.round(hoursToThreshold))} 小时后触达阈值`
      } else {
        thresholdEtaLabel = `约 ${round(hoursToThreshold / 24, 1)} 天后触达阈值`
      }
    }
  } else if (current !== null && current <= threshold) {
    thresholdEtaLabel = `已低于阈值 (${threshold}度)`
  }

  // 生成未来 36 小时线性预测轨迹点（供余量预测折线图绘制虚线）
  const forecastPoints: ForecastPoint[] = []
  if (samples.length > 0 && dailyAverage !== null && dailyAverage >= 0.1) {
    const latest = samples[samples.length - 1]
    const hourlyBurn = dailyAverage / 24
    forecastPoints.push({
      kwh: latest.kwh,
      createdAt: latest.createdAt,
      timestamp: latest.timeMs
    })
    for (let stepHours = 6; stepHours <= 36; stepHours += 6) {
      const futureMs = latest.timeMs + stepHours * HOUR_MS
      const projected = Math.max(0, round(latest.kwh - hourlyBurn * stepHours, 2))
      forecastPoints.push({
        kwh: projected,
        createdAt: new Date(futureMs).toISOString(),
        timestamp: futureMs
      })
      if (projected <= 0) break
    }
  }

  return {
    summary: {
      current,
      consumed24h: finalConsumed24h,
      dailyAverage,
      estimatedDays,
      estimatedDepletionLabel,
      thresholdEtaLabel,
      rechargeCount: finalRechargeCount,
      lastRechargeAmount,
      peakWindowLabel,
      sampleCount: samples.length
    },
    hourlyDays,
    dailyBars,
    periods,
    heatmap,
    forecastPoints
  }
}

/**
 * 生成基于当前实测余量锚定的 7 天 × 24 小时典型寝室用电示例序列
 * 仅在用户主动点击「预览图表效果」时用于演示全维度图表交互
 */
export function buildDemoPowerHistory(
  anchorKwh: number = 27.8,
  nowMs: number = Date.now()
): HistoryPoint[] {
  const hourlyProfile = [
    0.18, 0.12, 0.08, 0.06, 0.06, 0.07, // 00:00 - 05:00 夜间睡眠低负载
    0.11, 0.22, 0.16, 0.11, 0.09, 0.12, // 06:00 - 11:00 早起洗漱与上午课时
    0.28, 0.34, 0.21, 0.15, 0.18, 0.26, // 12:00 - 17:00 午休空调与下午活动
    0.42, 0.56, 0.68, 0.74, 0.62, 0.38  // 18:00 - 23:00 晚间回寝高峰（空调/电脑/热水器）
  ]

  const totalHours = 7 * 24
  const endHourMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS
  const deltas: { timeMs: number; delta: number; recharged: boolean }[] = []

  for (let i = totalHours; i >= 1; i -= 1) {
    const t = endHourMs - i * HOUR_MS
    const d = new Date(t)
    const hour = d.getHours()
    const dayOfWeek = d.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const wave = 0.88 + ((i * 7 + hour * 3) % 9) * 0.03
    const weekendFactor = isWeekend && hour >= 9 && hour <= 17 ? 1.35 : 1
    // 模拟 3 天前下午 15:00 充值 +50 度
    if (i === 78) {
      deltas.push({ timeMs: t, delta: 50, recharged: true })
    } else {
      const consumed = round(hourlyProfile[hour] * wave * weekendFactor, 2)
      deltas.push({ timeMs: t, delta: -consumed, recharged: false })
    }
  }

  // 从当前实测度数倒推历史每个整点的度数，使最新一点精确等于 anchorKwh
  const pointsReversed: HistoryPoint[] = [
    {
      kwh: round(anchorKwh, 2),
      createdAt: new Date(endHourMs).toISOString(),
      recharged: false
    }
  ]

  let cursorKwh = anchorKwh
  for (let idx = deltas.length - 1; idx >= 0; idx -= 1) {
    const step = deltas[idx]
    const prevKwh = round(cursorKwh - step.delta, 2)
    pointsReversed.push({
      kwh: Math.max(2, prevKwh),
      createdAt: new Date(step.timeMs).toISOString(),
      recharged: idx < deltas.length - 1 ? deltas[idx + 1].recharged : false
    })
    cursorKwh = Math.max(2, prevKwh)
  }

  return pointsReversed.reverse()
}
