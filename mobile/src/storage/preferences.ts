import AsyncStorage from '@react-native-async-storage/async-storage'

import { CAMPUSES, type Campus, type QueryPayload } from '../types/api'

const STORAGE_KEY = '@ecust-power/mobile-preferences-v1'

export interface RoomSelection {
  building: string
  room: string
}

export interface StoredPreferences {
  lastCampus: Campus
  selections: Record<Campus, RoomSelection>
  myRoom: QueryPayload | null
  threshold: number
  monitoringEnabled: boolean
  notificationsEnabled: boolean
}

function emptySelection(): RoomSelection {
  return { building: '', room: '' }
}

export const MIN_THRESHOLD = 5
export const MAX_THRESHOLD = 40

export function normalizeThreshold(value: unknown, fallback = 15): number {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, Math.round(parsed)))
}

export function createDefaultPreferences(): StoredPreferences {
  return {
    lastCampus: CAMPUSES[0],
    selections: {
      奉贤: emptySelection(),
      徐汇: emptySelection()
    },
    myRoom: null,
    threshold: 15,
    monitoringEnabled: false,
    notificationsEnabled: false
  }
}

function isCampus(value: unknown): value is Campus {
  return typeof value === 'string' && (CAMPUSES as readonly string[]).includes(value)
}

function readSelection(value: unknown): RoomSelection {
  if (typeof value !== 'object' || value === null) return emptySelection()
  const candidate = value as Record<string, unknown>
  return {
    building: typeof candidate.building === 'string' ? candidate.building : '',
    room: typeof candidate.room === 'string' ? candidate.room : ''
  }
}

function readRoom(value: unknown): QueryPayload | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>
  if (!isCampus(candidate.campus)) return null
  if (typeof candidate.building !== 'string' || typeof candidate.room !== 'string') return null
  if (!candidate.building || !candidate.room) return null
  return {
    campus: candidate.campus,
    building: candidate.building,
    room: candidate.room
  }
}

function parsePreferences(value: string | null): StoredPreferences {
  const fallback = createDefaultPreferences()
  if (!value) return fallback

  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return fallback
    const candidate = parsed as Record<string, unknown>
    const selections = typeof candidate.selections === 'object' && candidate.selections !== null
      ? candidate.selections as Record<string, unknown>
      : {}
    return {
      lastCampus: isCampus(candidate.lastCampus) ? candidate.lastCampus : fallback.lastCampus,
      selections: {
        奉贤: readSelection(selections.奉贤),
        徐汇: readSelection(selections.徐汇)
      },
      myRoom: readRoom(candidate.myRoom),
      threshold: normalizeThreshold(candidate.threshold, fallback.threshold),
      monitoringEnabled: Boolean(candidate.monitoringEnabled) && Boolean(readRoom(candidate.myRoom)),
      notificationsEnabled: Boolean(candidate.notificationsEnabled) && Boolean(readRoom(candidate.myRoom))
    }
  } catch {
    return fallback
  }
}

export async function loadPreferences(): Promise<StoredPreferences> {
  try {
    return parsePreferences(await AsyncStorage.getItem(STORAGE_KEY))
  } catch {
    return createDefaultPreferences()
  }
}

export async function savePreferences(preferences: StoredPreferences): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}
