import type { PowerResult } from '../types/api'

export type PowerTone = 'danger' | 'warning' | 'good'

export interface PowerStatus {
  tone: PowerTone
  label: string
}

export function getPowerStatus(kwh: number, threshold = 15): PowerStatus {
  const safeThreshold = Number.isFinite(threshold) ? threshold : 15
  if (kwh <= Math.min(5, safeThreshold * 0.5)) return { tone: 'danger', label: '急需充电' }
  if (kwh <= safeThreshold) return { tone: 'warning', label: '低于阈值' }
  return { tone: 'good', label: '余量充足' }
}

export function normalizeRoomInput(value: string): string {
  return value.trim().toUpperCase()
}

export function isValidRoom(value: string): boolean {
  return /^(?=.*\d)[0-9A-Z-]{2,8}$/.test(value)
}

export function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

export function formatNumberCompact(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return '--'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(maxDecimals).replace(/0+$/, '').replace(/\.$/, '')
}

export function displayKwh(result: PowerResult): string {
  return formatNumberCompact(result.kwh, 2)
}
