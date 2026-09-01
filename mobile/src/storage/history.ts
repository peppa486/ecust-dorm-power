import AsyncStorage from '@react-native-async-storage/async-storage'

import type { QueryPayload } from '../types/api'

const STORAGE_KEY = '@ecust-power/mobile-history-v1'
const MAX_POINTS = 336
const MIN_SAMPLE_GAP_MS = 15 * 60 * 1000
const RECHARGE_JUMP_KWH = 2

export interface HistoryPoint {
  kwh: number
  createdAt: string
  recharged: boolean
}

interface StoredHistory {
  roomKey: string
  points: HistoryPoint[]
}

function roomKey(room: QueryPayload | null): string {
  if (!room) return ''
  return `${room.campus}/${room.building}/${room.room}`
}

function isHistoryPoint(value: unknown): value is HistoryPoint {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.kwh === 'number'
    && Number.isFinite(candidate.kwh)
    && typeof candidate.createdAt === 'string'
}

function parseStoredHistory(value: string | null, targetRoomKey: string): HistoryPoint[] {
  if (!value || !targetRoomKey) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return []
    const candidate = parsed as Record<string, unknown>
    if (candidate.roomKey !== targetRoomKey || !Array.isArray(candidate.points)) return []
    return candidate.points
      .filter(isHistoryPoint)
      .map(point => ({
        kwh: point.kwh,
        createdAt: point.createdAt,
        recharged: Boolean(point.recharged)
      }))
      .slice(-MAX_POINTS)
  } catch {
    return []
  }
}

export async function loadHistory(room: QueryPayload | null): Promise<HistoryPoint[]> {
  try {
    return parseStoredHistory(await AsyncStorage.getItem(STORAGE_KEY), roomKey(room))
  } catch {
    return []
  }
}

export async function appendHistory(
  room: QueryPayload,
  kwh: number,
  createdAt = new Date().toISOString()
): Promise<HistoryPoint[]> {
  if (!Number.isFinite(kwh)) return loadHistory(room)

  const existing = await loadHistory(room)
  const timestamp = Number.isNaN(Date.parse(createdAt)) ? new Date().toISOString() : createdAt
  const latest = existing.at(-1)
  const latestTime = latest ? Date.parse(latest.createdAt) : Number.NaN
  const replaceLatest = latest && Number.isFinite(latestTime)
    && Math.abs(Date.parse(timestamp) - latestTime) < MIN_SAMPLE_GAP_MS
  const baseline = replaceLatest ? existing.at(-2) : latest
  const point: HistoryPoint = {
    kwh,
    createdAt: timestamp,
    recharged: Boolean(baseline && kwh - baseline.kwh > RECHARGE_JUMP_KWH)
  }
  const next = replaceLatest
    ? [...existing.slice(0, -1), point]
    : [...existing, point]
  const trimmed = next.slice(-MAX_POINTS)

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
    roomKey: roomKey(room),
    points: trimmed
  } satisfies StoredHistory))
  return trimmed
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}
