import { getDb } from './db.js'
import { MobilePushError, sendMobileUpdateNotification } from './mobile-push.js'

const VERSION_PATTERN = /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/
const PUSH_TOKEN_PATTERN = /^(?:Expo|Exponent)PushToken\[[^\]]+\]$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/i

function clientError(message) {
  const error = new Error(message)
  error.statusCode = 400
  error.expose = true
  return error
}

function assertTokenHash(tokenHash) {
  if (typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    const error = new Error('移动设备未登记')
    error.statusCode = 401
    error.expose = true
    throw error
  }
}

function normalizeVersion(value) {
  const version = String(value || '').trim()
  if (!VERSION_PATTERN.test(version) || version.length > 32) {
    throw clientError('更新版本格式不正确')
  }
  return version
}

function normalizeVersionCode(value) {
  const versionCode = Number(value)
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2147483647) {
    throw clientError('更新版本号格式不正确')
  }
  return versionCode
}

function normalizeDownloadUrl(value) {
  const downloadUrl = String(value || '').trim()
  let parsed
  try {
    parsed = new URL(downloadUrl)
  } catch {
    throw clientError('更新下载地址格式不正确')
  }
  if (parsed.protocol !== 'https:' || downloadUrl.length > 2048) {
    throw clientError('更新下载地址必须使用 HTTPS')
  }
  return downloadUrl
}

function normalizeReleaseNotes(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string' || value.length > 2000) {
    throw clientError('更新说明格式不正确')
  }
  return value.trim()
}

function normalizeSha256(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw clientError('APK 校验值格式不正确')
  }
  return value.toLowerCase()
}

function normalizePublishedAt(value) {
  if (value === undefined || value === null || value === '') return new Date().toISOString()
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw clientError('发布时间格式不正确')
  return date.toISOString()
}

function normalizePushToken(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 512 || !PUSH_TOKEN_PATTERN.test(value)) {
    throw clientError('推送令牌格式不正确')
  }
  return value
}

function toMobileUpdate(row) {
  if (!row) return null
  return {
    version: row.version,
    versionCode: Number(row.version_code),
    downloadUrl: row.download_url,
    releaseNotes: row.release_notes || '',
    forceUpdate: Boolean(row.force_update),
    sha256: row.sha256 || null,
    publishedAt: row.published_at
  }
}

function toMobileDevice(row) {
  return {
    appVersion: row.app_version,
    appVersionCode: Number(row.app_version_code),
    lastSeenAt: row.last_seen_at
  }
}

export async function getMobileUpdate() {
  const db = await getDb()
  const row = await db.get(
    `SELECT version,version_code,download_url,release_notes,force_update,sha256,published_at
     FROM mobile_updates WHERE id=1`
  )
  return toMobileUpdate(row)
}

export async function registerMobileDevice(
  tokenHash,
  { appVersion, appVersionCode, pushToken } = {}
) {
  assertTokenHash(tokenHash)
  const version = normalizeVersion(appVersion)
  const versionCode = normalizeVersionCode(appVersionCode)
  const safePushToken = normalizePushToken(pushToken)
  const db = await getDb()
  const existing = await db.get(
    'SELECT push_token FROM mobile_devices WHERE token_hash=?',
    tokenHash
  )
  const nextPushToken = safePushToken === undefined ? existing?.push_token || null : safePushToken
  const nextPushProvider = nextPushToken ? 'expo' : null

  await db.run(
    `INSERT INTO mobile_devices(
       token_hash,push_token,push_provider,app_version,app_version_code,created_at,last_seen_at
     ) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(token_hash) DO UPDATE SET
       push_token=excluded.push_token,
       push_provider=excluded.push_provider,
       app_version=excluded.app_version,
       app_version_code=excluded.app_version_code,
       last_seen_at=CURRENT_TIMESTAMP`,
    tokenHash,
    nextPushToken,
    nextPushProvider,
    version,
    versionCode,
    new Date().toISOString()
  )

  const row = await db.get(
    'SELECT app_version,app_version_code,last_seen_at FROM mobile_devices WHERE token_hash=?',
    tokenHash
  )
  return toMobileDevice(row)
}

export async function removeMobileDevice(tokenHash) {
  assertTokenHash(tokenHash)
  const db = await getDb()
  await db.run('DELETE FROM mobile_devices WHERE token_hash=?', tokenHash)
}

export async function cleanupMobileDevices(days = 90) {
  const db = await getDb()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const result = await db.run(
    'DELETE FROM mobile_devices WHERE datetime(last_seen_at)<datetime(?)',
    cutoff
  )
  return result.changes || 0
}

function normalizeUpdate(payload = {}) {
  const input = payload && typeof payload === 'object' ? payload : {}
  return {
    version: normalizeVersion(input.version),
    versionCode: normalizeVersionCode(input.versionCode),
    downloadUrl: normalizeDownloadUrl(input.downloadUrl),
    releaseNotes: normalizeReleaseNotes(input.releaseNotes),
    forceUpdate: Boolean(input.forceUpdate ?? input.force),
    sha256: normalizeSha256(input.sha256),
    publishedAt: normalizePublishedAt(input.publishedAt)
  }
}

async function mapLimit(items, limit, worker) {
  const queue = [...items]
  const jobs = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      await worker(item)
    }
  })
  await Promise.all(jobs)
}

export async function publishMobileUpdate(
  payload,
  { mobileSendUpdateNotification = sendMobileUpdateNotification } = {}
) {
  const update = normalizeUpdate(payload)
  const db = await getDb()
  await db.run(
    `INSERT INTO mobile_updates(
       id,version,version_code,download_url,release_notes,force_update,sha256,published_at
     ) VALUES(1,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       version=excluded.version,
       version_code=excluded.version_code,
       download_url=excluded.download_url,
       release_notes=excluded.release_notes,
       force_update=excluded.force_update,
       sha256=excluded.sha256,
       published_at=excluded.published_at`,
    update.version,
    update.versionCode,
    update.downloadUrl,
    update.releaseNotes,
    update.forceUpdate ? 1 : 0,
    update.sha256,
    update.publishedAt
  )

  const devices = await db.all(
    `SELECT DISTINCT push_token
     FROM mobile_devices
     WHERE push_token IS NOT NULL AND push_token<>''`
  )
  let notified = 0
  let invalidTokens = 0
  let failed = 0

  await mapLimit(devices, 4, async device => {
    try {
      await mobileSendUpdateNotification(device.push_token, update)
      notified += 1
    } catch (error) {
      if (error instanceof MobilePushError && ['InvalidPushToken', 'DeviceNotRegistered'].includes(error.code)) {
        invalidTokens += 1
        await db.run('UPDATE mobile_devices SET push_token=NULL,push_provider=NULL WHERE push_token=?', device.push_token)
      } else {
        failed += 1
        console.error(`mobile update notify failed: ${error?.message || 'unknown error'}`)
      }
    }
  })

  return {
    update: toMobileUpdate({
      ...update,
      version_code: update.versionCode,
      download_url: update.downloadUrl,
      release_notes: update.releaseNotes,
      force_update: update.forceUpdate ? 1 : 0,
      published_at: update.publishedAt
    }),
    notified,
    invalidTokens,
    failed
  }
}
