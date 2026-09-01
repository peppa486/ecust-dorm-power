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

export interface ApiErrorBody {
  error?: string
}
