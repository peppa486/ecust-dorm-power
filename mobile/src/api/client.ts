import type {
  ApiErrorBody,
  BuildingsResponse,
  Campus,
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
