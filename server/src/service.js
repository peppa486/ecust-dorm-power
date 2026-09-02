import { computeHistoryStats } from './analytics.js'
import { buildingLabel, roomKey, validateRoom } from './buildings.js'
import { TtlCache } from './cache.js'
import { getDb } from './db.js'
import { MobilePushError, sendMobileNotification } from './mobile-push.js'
import { fetchPower } from './power.js'

const cache = new TtlCache(Number(process.env.CACHE_SECONDS || 600) * 1000)
const inFlightQueries = new Map()
let snapshotWrite = Promise.resolve()
let pollPromise = null

function normalizeThreshold(value) {
  const number = value === undefined || value === null || value === '' ? 15 : Number(value)
  if (!Number.isFinite(number)) throw new Error('提醒阈值格式不正确')
  return Math.max(5, Math.min(40, number))
}

function assertMobileTokenHash(tokenHash) {
  if (typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    const error = new Error('移动设备未登记')
    error.statusCode = 401
    error.expose = true
    throw error
  }
  return tokenHash
}

function normalizePushToken(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 512 || !/^(?:Expo|Exponent)PushToken\[[^\]]+\]$/.test(value)) {
    throw new Error('推送令牌格式不正确')
  }
  return value
}

function missingMobileWatch() {
  const error = new Error('移动设备尚未设置我的寝室')
  error.statusCode = 401
  error.expose = true
  return error
}

function toMobileWatch(watch) {
  if (!watch) return null
  return {
    campus: watch.campus,
    building: watch.building,
    room: watch.room,
    threshold: Number(watch.threshold),
    notificationsEnabled: Boolean(watch.notifications_enabled),
    updatedAt: watch.updated_at,
    displayName: `${watch.campus} · ${buildingLabel(watch.campus, watch.building)} · ${watch.room}`
  }
}

async function countRoomWatchers(db, campus, building, room) {
  return db.get(
    'SELECT COUNT(*) AS count FROM mobile_watches WHERE campus=? AND building=? AND room=?',
    campus, building, room
  )
}

async function cleanupRoomSnapshots(db, campus, building, room) {
  const remaining = await countRoomWatchers(db, campus, building, room)
  if (!remaining.count) await db.run('DELETE FROM snapshots WHERE room_key=?', roomKey(campus, building, room))
}

export async function queryPower(campus, building, room, { fresh = false, provider = fetchPower } = {}) {
  const normalizedRoom = validateRoom(campus, building, room)
  const key = roomKey(campus, building, normalizedRoom)
  if (!fresh) {
    const hit = cache.get(key)
    if (hit) return { ...hit, cached: true }
  }
  const pending = inFlightQueries.get(key)
  if (pending) return { ...(await pending), cached: true }

  const request = Promise.resolve()
    .then(() => provider(campus, building, normalizedRoom))
    .then(data => {
      cache.set(key, data)
      return data
    })
  inFlightQueries.set(key, request)
  try {
    return { ...(await request), cached: false }
  } finally {
    if (inFlightQueries.get(key) === request) inFlightQueries.delete(key)
  }
}

export function storeSnapshot(data) {
  const operation = snapshotWrite.then(async () => {
    const db = await getDb()
    const key = roomKey(data.campus, data.building, data.room)
    const last = await db.get('SELECT created_at FROM snapshots WHERE room_key=? ORDER BY id DESC LIMIT 1', key)
    const lastTime = last ? Date.parse(last.created_at) : 0
    if (lastTime && Date.now() - lastTime < 20 * 60 * 1000) return false
    await db.run(
      'INSERT INTO snapshots(room_key,campus,building,room,kwh,created_at) VALUES(?,?,?,?,?,?)',
      key, data.campus, data.building, data.room, data.kwh, new Date().toISOString()
    )
    return true
  })
  snapshotWrite = operation.catch(() => {})
  return operation
}

export async function getMobileWatch(tokenHash) {
  assertMobileTokenHash(tokenHash)
  const db = await getDb()
  const watch = await db.get(
    `SELECT campus,building,room,threshold,notifications_enabled,updated_at
     FROM mobile_watches WHERE token_hash=?`,
    tokenHash
  )
  return toMobileWatch(watch)
}

export async function saveMobileWatch(
  tokenHash,
  campus,
  building,
  room,
  threshold,
  notificationsEnabled = false,
  pushToken,
  { provider = fetchPower } = {}
) {
  assertMobileTokenHash(tokenHash)
  const normalizedRoom = validateRoom(campus, building, room)
  const safeThreshold = normalizeThreshold(threshold)
  const safeNotifications = Boolean(notificationsEnabled)
  const safePushToken = normalizePushToken(pushToken)
  const db = await getDb()
  const existing = await db.get(
    `SELECT campus,building,room,threshold,notifications_enabled,alerted,push_token
     FROM mobile_watches WHERE token_hash=?`,
    tokenHash
  )
  const changedRoom = !existing
    || existing.campus !== campus
    || existing.building !== building
    || existing.room !== normalizedRoom
  const changedThreshold = Number(existing?.threshold) !== safeThreshold
  const changedNotifications = Boolean(existing?.notifications_enabled) !== safeNotifications
  const resetAlerted = changedRoom || changedThreshold || changedNotifications
  const nextPushToken = safePushToken === undefined ? existing?.push_token || null : safePushToken
  const nextPushProvider = nextPushToken ? 'expo' : null

  await db.run(
    `INSERT INTO mobile_watches(
       token_hash,campus,building,room,threshold,notifications_enabled,alerted,push_token,push_provider,updated_at
     ) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(token_hash) DO UPDATE SET
       campus=excluded.campus,
       building=excluded.building,
       room=excluded.room,
       threshold=excluded.threshold,
       notifications_enabled=excluded.notifications_enabled,
       alerted=CASE WHEN ? THEN 0 ELSE mobile_watches.alerted END,
       push_token=excluded.push_token,
       push_provider=excluded.push_provider,
       updated_at=CURRENT_TIMESTAMP`,
    tokenHash,
    campus,
    building,
    normalizedRoom,
    safeThreshold,
    safeNotifications ? 1 : 0,
    0,
    nextPushToken,
    nextPushProvider,
    resetAlerted ? 1 : 0
  )

  if (changedRoom && existing) {
    await cleanupRoomSnapshots(db, existing.campus, existing.building, existing.room)
  }

  if (changedRoom) {
    try {
      const data = await queryPower(campus, building, normalizedRoom, { provider })
      await storeSnapshot(data)
    } catch (error) {
      console.warn(`mobile snapshot ${campus}/${building}/${normalizedRoom}: ${error.message}`)
    }
  }
  return getMobileWatch(tokenHash)
}

export async function removeMobileWatch(tokenHash) {
  assertMobileTokenHash(tokenHash)
  const db = await getDb()
  const watch = await db.get(
    'SELECT campus,building,room FROM mobile_watches WHERE token_hash=?',
    tokenHash
  )
  await db.run('DELETE FROM mobile_watches WHERE token_hash=?', tokenHash)
  if (watch) await cleanupRoomSnapshots(db, watch.campus, watch.building, watch.room)
}

function mapHistoryItems(items) {
  let previous = null
  return items.map(item => {
    const current = { id: item.id, kwh: Number(item.kwh), createdAt: item.created_at }
    const mapped = {
      ...current,
      recharged: Boolean(previous && current.kwh - previous.kwh > 2)
    }
    previous = current
    return mapped
  })
}

export async function getMobileHistory(tokenHash) {
  assertMobileTokenHash(tokenHash)
  const db = await getDb()
  const watch = await getMobileWatch(tokenHash)
  if (!watch) throw missingMobileWatch()
  const key = roomKey(watch.campus, watch.building, watch.room)
  const items = await db.all(
    `SELECT id,kwh,created_at FROM snapshots
     WHERE room_key=? AND datetime(created_at)>=datetime(?)
     ORDER BY created_at ASC, id ASC LIMIT 1008`,
    key,
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  )
  const mappedItems = mapHistoryItems(items)
  return {
    watch,
    displayName: watch.displayName,
    stats: computeHistoryStats(items),
    items: mappedItems
  }
}

export async function cleanupSnapshots(days = 14) {
  const db = await getDb()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  await db.run('DELETE FROM snapshots WHERE datetime(created_at)<datetime(?)', cutoff)
}

export async function cleanupMobileWatches(days = 30) {
  const db = await getDb()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const stale = await db.all(
    'SELECT campus,building,room FROM mobile_watches WHERE datetime(updated_at)<datetime(?)',
    cutoff
  )
  await db.run('DELETE FROM mobile_watches WHERE datetime(updated_at)<datetime(?)', cutoff)
  for (const watch of stale) {
    await cleanupRoomSnapshots(db, watch.campus, watch.building, watch.room)
  }
  return stale.length
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

async function pollWatchesOnce({
  powerProvider = fetchPower,
  mobileSendNotification = sendMobileNotification
} = {}) {
  const db = await getDb()
  const rooms = await db.all('SELECT DISTINCT campus,building,room FROM mobile_watches')
  const configuredConcurrency = Number(process.env.POLL_CONCURRENCY || 3)
  const concurrency = Math.max(1, Math.min(8, Number.isFinite(configuredConcurrency) ? Math.floor(configuredConcurrency) : 3))

  await mapLimit(rooms, concurrency, async room => {
    try {
      const data = await queryPower(room.campus, room.building, room.room, { fresh: true, provider: powerProvider })
      await storeSnapshot(data)

      const mobileUsers = await db.all(
        `SELECT token_hash,campus,building,room,threshold,notifications_enabled,alerted,push_token
         FROM mobile_watches WHERE campus=? AND building=? AND room=?`,
        room.campus, room.building, room.room
      )
      for (const watch of mobileUsers) {
        if (watch.alerted && data.kwh > watch.threshold + 2) {
          await db.run('UPDATE mobile_watches SET alerted=0 WHERE token_hash=?', watch.token_hash)
          watch.alerted = 0
        }
        if (!watch.notifications_enabled || data.kwh > watch.threshold || watch.alerted || !watch.push_token) continue

        try {
          await mobileSendNotification(
            watch.push_token,
            {
              ...watch,
              threshold: Number(watch.threshold),
              displayName: `${watch.campus} · ${buildingLabel(watch.campus, watch.building)} · ${watch.room}`
            },
            data.kwh
          )
          await db.run(
            'UPDATE mobile_watches SET alerted=1 WHERE token_hash=? AND notifications_enabled=1 AND alerted=0',
            watch.token_hash
          )
        } catch (error) {
          if (error instanceof MobilePushError && ['InvalidPushToken', 'DeviceNotRegistered'].includes(error.code)) {
            await db.run(
              'UPDATE mobile_watches SET push_token=NULL,push_provider=NULL WHERE token_hash=?',
              watch.token_hash
            )
          } else {
            console.error(`mobile notify ${watch.token_hash.slice(0, 8)}: ${error.message}`)
          }
        }
      }
    } catch (error) {
      console.error(`poll ${room.campus}/${room.building}/${room.room}: ${error.message}`)
    }
  })
}

export async function pollWatches(options) {
  if (pollPromise) return pollPromise
  pollPromise = pollWatchesOnce(options).finally(() => {
    pollPromise = null
  })
  return pollPromise
}
