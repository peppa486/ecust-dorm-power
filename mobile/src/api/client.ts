import type {
  ApiErrorBody,
  BuildingsResponse,
  Campus,
  MobileHistoryResponse,
  MobileUpdate,
  MobileWatch,
  PowerResult,
  QueryPayload
} from '../types/api'

export const API_BASE = 'https://power.ecust.cc'

const REQUEST_TIMEOUT_MS = 12_000

export class ApiError extends Error {
  readonly statusCode?: number

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBuildingOption(value: unknown): value is { value: string; label: string } {
  return isRecord(value) && typeof value.value === 'string' && typeof value.label === 'string'
}

function getErrorMessage(value: unknown, statusCode: number): string {
  if (isRecord(value) && typeof (value as ApiErrorBody).error === 'string') {
    return (value as ApiErrorBody).error as string
  }
  return `请求失败（HTTP ${statusCode}）`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(init.headers || {})
        },
        signal: controller.signal
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (controller.signal.aborted) {
        throw new ApiError('请求超时，请稍后再试')
      }
      throw new ApiError('网络请求失败，请检查网络连接')
    }

    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // Keep the HTTP error below useful even if the server did not return JSON.
    }

    if (!response.ok) {
      throw new ApiError(getErrorMessage(body, response.status), response.status)
    }
    return body as T
  } finally {
    clearTimeout(timeout)
  }
}

export async function getBuildings(campus: Campus): Promise<BuildingsResponse> {
  const data = await request<BuildingsResponse>(`/api/buildings?campus=${encodeURIComponent(campus)}`)
  if (!Array.isArray(data?.buildings) || !data.buildings.every(isBuildingOption)) {
    throw new ApiError('楼栋数据格式异常')
  }
  return data
}

export async function queryPower(payload: QueryPayload): Promise<PowerResult> {
  const data = await request<PowerResult>('/api/query', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  if (typeof data?.kwh !== 'number') {
    throw new ApiError('电量数据格式异常')
  }
  return data
}

function mobileHeaders(token: string): HeadersInit {
  return { 'X-Mobile-Token': token }
}

function isMobileWatch(value: unknown): value is MobileWatch {
  return isRecord(value)
    && typeof value.campus === 'string'
    && typeof value.building === 'string'
    && typeof value.room === 'string'
    && typeof value.threshold === 'number'
    && typeof value.notificationsEnabled === 'boolean'
    && typeof value.displayName === 'string'
}

function isMobileUpdate(value: unknown): value is MobileUpdate {
  return isRecord(value)
    && typeof value.version === 'string'
    && typeof value.versionCode === 'number'
    && Number.isSafeInteger(value.versionCode)
    && typeof value.downloadUrl === 'string'
    && value.downloadUrl.startsWith('https://')
    && typeof value.releaseNotes === 'string'
    && typeof value.forceUpdate === 'boolean'
    && (value.sha256 === null || typeof value.sha256 === 'string')
    && typeof value.publishedAt === 'string'
}

export async function getMobileUpdate(): Promise<MobileUpdate | null> {
  const data = await request<{ update: MobileUpdate | null }>('/api/mobile/update')
  if (data?.update === null) return null
  if (!isMobileUpdate(data?.update)) throw new ApiError('更新信息格式异常')
  return data.update
}

export async function registerMobileDevice(
  token: string,
  appVersion: string,
  appVersionCode: number,
  pushToken?: string | null
): Promise<void> {
  const body: Record<string, unknown> = { appVersion, appVersionCode }
  if (pushToken !== undefined) body.pushToken = pushToken

  await request<{ device: unknown }>('/api/mobile/device', {
    method: 'POST',
    headers: mobileHeaders(token),
    body: JSON.stringify(body)
  })
}

export async function registerMobileWatch(
  token: string,
  room: QueryPayload,
  threshold: number,
  notificationsEnabled: boolean,
  pushToken?: string | null
): Promise<MobileWatch> {
  const body: Record<string, unknown> = {
    ...room,
    threshold,
    notificationsEnabled
  }
  if (pushToken !== undefined) body.pushToken = pushToken

  const data = await request<{ watch: MobileWatch }>('/api/mobile/watch', {
    method: 'POST',
    headers: mobileHeaders(token),
    body: JSON.stringify(body)
  })
  if (!isMobileWatch(data?.watch)) throw new ApiError('服务器监控数据格式异常')
  return data.watch
}

export async function getMobileHistory(token: string): Promise<MobileHistoryResponse> {
  const data = await request<MobileHistoryResponse>('/api/mobile/history', {
    headers: mobileHeaders(token)
  })
  if (!isMobileWatch(data?.watch) || !Array.isArray(data?.items)) {
    throw new ApiError('服务器趋势数据格式异常')
  }
  return data
}

export async function removeMobileWatch(token: string): Promise<void> {
  await request<{ ok: boolean }>('/api/mobile/watch', {
    method: 'DELETE',
    headers: mobileHeaders(token)
  })
}
