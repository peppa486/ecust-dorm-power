export type Campus = '奉贤' | '徐汇'

export const CAMPUSES: readonly Campus[] = ['奉贤', '徐汇']

export interface BuildingOption {
  value: string
  label: string
}

export interface BuildingsResponse {
  buildings: BuildingOption[]
}

export interface QueryPayload {
  campus: Campus
  building: string
  room: string
}

export interface PowerResult extends QueryPayload {
  kwh: number
  displayName: string
  updatedAt: string
  cached?: boolean
}

export interface MobileWatch {
  campus: Campus
  building: string
  room: string
  threshold: number
  notificationsEnabled: boolean
  updatedAt: string
  displayName: string
}

export interface MobileHistoryPoint {
  id: number
  kwh: number
  createdAt: string
  recharged: boolean
}

export interface MobileHistoryResponse {
  watch: MobileWatch
  displayName: string
  stats: {
    current: number | null
    consumed24h: number | null
    dailyAverage: number | null
    estimatedDays: number | null
    rechargeCount: number
  }
  items: MobileHistoryPoint[]
}

export interface MobileUpdate {
  version: string
  versionCode: number
  downloadUrl: string
  releaseNotes: string
  forceUpdate: boolean
  sha256: string | null
  publishedAt: string
}

export interface ApiErrorBody {
  error?: string
}
