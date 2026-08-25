import test from 'node:test'
import assert from 'node:assert/strict'
import { computeHistoryStats, normalizeHistory } from '../src/analytics.js'

const hour = 3_600_000
const now = Date.parse('2026-08-25T00:00:00.000Z')

function item(hoursAgo, kwh, id = 1) {
  return { id, kwh, created_at: new Date(now - hoursAgo * hour).toISOString() }
}

test('normalizes history chronologically', () => {
  const points = normalizeHistory([item(1, 9), item(3, 12), item(2, 11)])
  assert.deepEqual(points.map(point => point.kwh), [12, 11, 9])
})

test('computes consumption and estimate while ignoring recharge jump', () => {
  const points = [
    item(30, 30, 1),
    item(24, 28, 2),
    item(18, 26, 3),
    item(12, 48, 4),
    item(6, 46, 5),
    item(0, 44, 6)
  ]
  const stats = computeHistoryStats(points, now)
  assert.equal(stats.current, 44)
  assert.equal(stats.consumed24h, 6)
  assert.equal(stats.rechargeCount, 1)
  assert.ok(stats.dailyAverage > 0)
  assert.ok(stats.estimatedDays > 0)
})

test('with short history, daily metrics stay unavailable', () => {
  const stats = computeHistoryStats([item(2, 10), item(0, 9)], now)
  assert.equal(stats.dailyAverage, null)
  assert.equal(stats.estimatedDays, null)
  assert.equal(stats.consumed24h, null)
})
