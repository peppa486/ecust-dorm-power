import { computeHistoryStats } from './analytics.js'
import { buildingLabel, roomKey, validateRoom } from './buildings.js'
import { TtlCache } from './cache.js'
import { getDb } from './db.js'
import { fetchPower } from './power.js'
import { sendLowPower, WeChatSendError } from './wechat.js'

const cache = new TtlCache(Number(process.env.CACHE_SECONDS || 600) * 1000)
const powerProvider = fetchPower

export async function queryPower(campus, building, room, { fresh = false } = {}) {
  const normalizedRoom = validateRoom(campus, building, room)
  const key = roomKey(campus, building, normalizedRoom)
  if (!fresh) {
    const hit = cache.get(key)
    if (hit) return { ...hit, cached: true }
  }
  const data = await powerProvider(campus, building, normalizedRoom)
  cache.set(key, data)
  return { ...data, cached: false }
}

export async function storeSnapshot(data) {
  const db = await getDb()
  const key = roomKey(data.campus, data.building, data.room)
  const last = await db.get('SELECT kwh,created_at FROM snapshots WHERE room_key=? ORDER BY id DESC LIMIT 1', key)
  const lastTime = last ? Date.parse(last.created_at) : 0
  if (lastTime && Date.now() - lastTime < 20 * 60 * 1000) return false
  await db.run(
    'INSERT INTO snapshots(room_key,campus,building,room,kwh,created_at) VALUES(?,?,?,?,?,?)',
    key, data.campus, data.building, data.room, data.kwh, new Date().toISOString()
  )
  return true
}

export async function getWatch(openid) {
  const db = await getDb()
  const watch = await db.get(
    'SELECT campus,building,room,threshold,credits,alerted,updated_at FROM watches WHERE openid=?',
    openid
  )
  if (!watch) return null
  return {
    ...watch,
    displayName: `${watch.campus} · ${buildingLabel(watch.campus, watch.building)} · ${watch.room}`
  }
}

export async function saveWatch(openid, campus, building, room, threshold) {
  const normalizedRoom = validateRoom(campus, building, room)
  const safeThreshold = Math.max(5, Math.min(40, Number(threshold || 15)))
  if (!Number.isFinite(safeThreshold)) throw new Error('提醒阈值格式不正确')
  const db = await getDb()
  const existing = await db.get('SELECT campus,building,room,alerted FROM watches WHERE openid=?', openid)
  const changedRoom = !existing || existing.campus !== campus || existing.building !== building || existing.room !== normalizedRoom
  await db.run(
    `INSERT INTO watches(openid,campus,building,room,threshold,credits,alerted,updated_at)
     VALUES(?,?,?,?,?,0,0,CURRENT_TIMESTAMP)
     ON CONFLICT(openid) DO UPDATE SET
       campus=excluded.campus,
       building=excluded.building,
       room=excluded.room,
       threshold=excluded.threshold,
       alerted=CASE WHEN ? THEN 0 ELSE watches.alerted END,
       updated_at=CURRENT_TIMESTAMP`,
    openid, campus, building, normalizedRoom, safeThreshold, changedRoom ? 1 : 0
  )
  if (changedRoom && existing) {
    const oldKey = roomKey(existing.campus, existing.building, existing.room)
    const remaining = await db.get(
      'SELECT COUNT(*) AS count FROM watches WHERE campus=? AND building=? AND room=?',
      existing.campus, existing.building, existing.room
    )
    if (!remaining.count) await db.run('DELETE FROM snapshots WHERE room_key=?', oldKey)
  }

  if (changedRoom) {
    try {
      const data = await queryPower(campus, building, normalizedRoom)
      await storeSnapshot(data)
    } catch (error) {
      console.warn(`snapshot ${campus}/${building}/${normalizedRoom}: ${error.message}`)
    }
  }
  return getWatch(openid)
}

export async function removeWatch(openid) {
  const db = await getDb()
  const watch = await db.get('SELECT campus,building,room FROM watches WHERE openid=?', openid)
  await db.run('DELETE FROM watches WHERE openid=?', openid)
  if (!watch) return
  const remaining = await db.get(
    'SELECT COUNT(*) AS count FROM watches WHERE campus=? AND building=? AND room=?',
    watch.campus, watch.building, watch.room
  )
  if (!remaining.count) await db.run('DELETE FROM snapshots WHERE room_key=?', roomKey(watch.campus, watch.building, watch.room))
}

export async function cleanupSnapshots(days = 14) {
  const db = await getDb()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  await db.run('DELETE FROM snapshots WHERE datetime(created_at)<datetime(?)', cutoff)
}

export async function addSubscriptionCredit(openid, threshold) {
  const db = await getDb()
  const watch = await db.get('SELECT openid FROM watches WHERE openid=?', openid)
  if (!watch) throw new Error('请先设为我的寝室')
  const safeThreshold = Math.max(5, Math.min(40, Number(threshold || 15)))
  if (!Number.isFinite(safeThreshold)) throw new Error('提醒阈值格式不正确')
  await db.run(
    'UPDATE watches SET threshold=?,credits=MIN(credits+1,5),updated_at=CURRENT_TIMESTAMP WHERE openid=?',
    safeThreshold,
    openid
  )
  return getWatch(openid)
}

export async function getHistory(openid) {
  const db = await getDb()
  const watch = await getWatch(openid)
  if (!watch) throw new Error('还没有设置我的寝室')
  const key = roomKey(watch.campus, watch.building, watch.room)
  const items = await db.all(
    `SELECT id,kwh,created_at FROM snapshots
     WHERE room_key=? AND datetime(created_at)>=datetime(?)
     ORDER BY created_at ASC LIMIT 240`,
    key,
    new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  )
  return {
    watch,
    displayName: watch.displayName,
    stats: computeHistoryStats(items),
    items: items.map(item => ({ id: item.id, kwh: item.kwh, createdAt: item.created_at }))
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

export async function pollWatches() {
  const db = await getDb()
  const rooms = await db.all('SELECT DISTINCT campus,building,room FROM watches')
  const concurrency = Math.max(1, Math.min(8, Number(process.env.POLL_CONCURRENCY || 3)))

  await mapLimit(rooms, concurrency, async room => {
    try {
      const data = await queryPower(room.campus, room.building, room.room, { fresh: true })
      await storeSnapshot(data)
      const users = await db.all(
        'SELECT openid,campus,building,room,threshold,credits,alerted FROM watches WHERE campus=? AND building=? AND room=?',
        room.campus, room.building, room.room
      )

      for (const watch of users) {
        if (watch.alerted && data.kwh > watch.threshold + 2) {
          await db.run('UPDATE watches SET alerted=0 WHERE openid=?', watch.openid)
          watch.alerted = 0
        }
        if (data.kwh > watch.threshold || watch.alerted || watch.credits <= 0) continue

        try {
          await sendLowPower(watch.openid, watch, data.kwh)
          await db.run('UPDATE watches SET alerted=1,credits=MAX(credits-1,0) WHERE openid=?', watch.openid)
        } catch (error) {
          if (error instanceof WeChatSendError && error.code === 43101) {
            await db.run('UPDATE watches SET credits=0 WHERE openid=?', watch.openid)
          } else {
            console.error(`notify ${watch.openid.slice(0, 6)}: ${error.message}`)
          }
        }
      }
    } catch (error) {
      console.error(`poll ${room.campus}/${room.building}/${room.room}: ${error.message}`)
    }
  })
}
