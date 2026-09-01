import type { PowerResult } from '../types/api'

export type PowerTone = 'danger' | 'warning' | 'good'

export interface PowerStatus {
  tone: PowerTone
  label: string
}

export function getPowerStatus(kwh: number): PowerStatus {
  if (kwh <= 5) return { tone: 'danger', label: '紧张' }
  if (kwh <= 15) return { tone: 'warning', label: '偏低' }
  return { tone: 'good', label: '充足' }
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

export function displayKwh(result: PowerResult): string {
  return Number.isInteger(result.kwh) ? String(result.kwh) : result.kwh.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
