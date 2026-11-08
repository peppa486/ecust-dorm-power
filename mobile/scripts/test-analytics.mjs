import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzePowerHistory } from '../src/utils/analytics.ts'

test('analyzePowerHistory distributes hourly consumption and ignores recharge jumps', () => {
  const now = new Date('2026-11-08T15:00:00+08:00').getTime()
  const points = [
    { kwh: 50.0, createdAt: '2026-11-08T10:00:00+08:00', recharged: false },
    { kwh: 49.4, createdAt: '2026-11-08T11:00:00+08:00', recharged: false },
    { kwh: 48.2, createdAt: '2026-11-08T13:00:00+08:00', recharged: false },
    { kwh: 98.2, createdAt: '2026-11-08T14:00:00+08:00', recharged: true },
    { kwh: 97.2, createdAt: '2026-11-08T15:00:00+08:00', recharged: false }
  ]

  const result = analyzePowerHistory(points, null, 15, now)
  const today = result.hourlyDays.at(-1)
  assert.ok(today)
  assert.equal(today.dateKey, '2026-11-08')
  assert.equal(today.hours[10].kwh, 0.6)
  assert.equal(today.hours[11].kwh, 0.6)
  assert.equal(today.hours[12].kwh, 0.6)
  assert.equal(today.hours[13].kwh, 0)
  assert.equal(today.hours[14].kwh, 1.0)
  assert.equal(today.totalKwh, 2.8)
  assert.equal(today.peakHour, 14)
  assert.equal(result.summary.rechargeCount, 1)
  assert.equal(result.summary.lastRechargeAmount, 50)

  const pctSum = result.periods.reduce((acc, p) => acc + p.percentage, 0)
  assert.equal(pctSum, 100)
})

test('analyzePowerHistory builds 7x24 heatmap and forecast trajectory', () => {
  const now = new Date('2026-11-08T18:00:00+08:00').getTime()
  const points = []
  let kwh = 40
  for (let h = 24; h >= 0; h -= 1) {
    const t = new Date(now - h * 3_600_000).toISOString()
    points.push({ kwh, createdAt: t, recharged: false })
    kwh = Number((kwh - 0.25).toFixed(2))
  }

  const result = analyzePowerHistory(points, null, 15, now)
  assert.equal(result.heatmap.length, 7)
  assert.equal(result.heatmap[0].cells.length, 24)
  assert.ok(result.summary.dailyAverage >= 5.5 && result.summary.dailyAverage <= 6.5)
  assert.ok(result.forecastPoints.length >= 2)
  assert.ok(result.forecastPoints.at(-1).kwh < result.forecastPoints[0].kwh)
})
