import test, { after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecust-dorm-service-'))
process.env.DB_PATH = path.join(tempDir, 'power.sqlite')

const { closeDb, getDb } = await import('../src/db.js')
const {
  cleanupMobileWatches,
  getMobileHistory,
  pollWatches,
  queryPower,
  removeMobileWatch,
  saveMobileWatch,
  storeSnapshot
} = await import('../src/service.js')
const {
  cleanupMobileDevices,
  getMobileUpdate,
  publishMobileUpdate,
  registerMobileDevice
} = await import('../src/mobile-update.js')
const { hashMobileToken } = await import('../src/mobile-auth.js')

const db = await getDb()

function power(campus, building, room, kwh) {
  return {
    campus,
    building,
    room,
    kwh,
    displayName: `${campus}-${building}-${room}`,
    updatedAt: new Date().toISOString()
  }
}

async function clearData() {
  await db.exec('DELETE FROM mobile_watches; DELETE FROM mobile_devices; DELETE FROM mobile_updates; DELETE FROM snapshots;')
}

after(async () => {
  await closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

beforeEach(clearData)

test('ordinary queries coalesce and do not create history', async () => {
  let calls = 0
  const provider = async (campus, building, room) => {
    calls += 1
    await new Promise(resolve => setTimeout(resolve, 15))
    return power(campus, building, room, 22)
  }

  const results = await Promise.all([
    queryPower('奉贤', '5', '204', { provider }),
    queryPower('奉贤', '5', '204', { provider })
  ])
  assert.equal(calls, 1)
  assert.equal(results[0].cached, false)
  assert.equal(results[1].cached, true)
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots')).count, 0)
})

test('mobile watches share one snapshot and cleanup happens after the last removal', async () => {
  const firstToken = hashMobileToken('A'.repeat(48))
  const secondToken = hashMobileToken('B'.repeat(48))
  const provider = async (campus, building, room) => power(campus, building, room, 20)
  await saveMobileWatch(firstToken, '奉贤', '5', '205', 15, false, undefined, { provider })
  await saveMobileWatch(secondToken, '奉贤', '5', '205', 15, false, undefined, { provider })

  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots')).count, 1)
  await removeMobileWatch(firstToken)
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots')).count, 1)
  await removeMobileWatch(secondToken)
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots')).count, 0)
})

test('polling one room samples once and notifies all mobile watchers', async () => {
  const firstToken = hashMobileToken('C'.repeat(48))
  const secondToken = hashMobileToken('D'.repeat(48))
  const setupProvider = async (...args) => power(...args, 20)
  await saveMobileWatch(firstToken, '徐汇', '3', '301', 15, true, 'ExponentPushToken[first]', { provider: setupProvider })
  await saveMobileWatch(secondToken, '徐汇', '3', '301', 15, true, 'ExponentPushToken[second]', { provider: setupProvider })
  await db.run(
    'UPDATE snapshots SET created_at=? WHERE room_key=?',
    new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    '徐汇:3:301'
  )

  let calls = 0
  const notifications = []
  const pollOptions = {
    powerProvider: async (...args) => {
      calls += 1
      return power(...args, 10)
    },
    mobileSendNotification: async (pushToken, watch, kwh) => {
      notifications.push({ pushToken, room: watch.room, kwh })
    }
  }
  await Promise.all([pollWatches(pollOptions), pollWatches(pollOptions)])

  assert.equal(calls, 1)
  assert.deepEqual(notifications.sort((left, right) => left.pushToken.localeCompare(right.pushToken)), [
    { pushToken: 'ExponentPushToken[first]', room: '301', kwh: 10 },
    { pushToken: 'ExponentPushToken[second]', room: '301', kwh: 10 }
  ])
  const rows = await db.all('SELECT alerted FROM mobile_watches ORDER BY token_hash')
  assert.deepEqual(rows, [{ alerted: 1 }, { alerted: 1 }])
})

test('mobile watches are sampled and history is available without the app running', async () => {
  const tokenHash = hashMobileToken('E'.repeat(48))
  let calls = 0
  await saveMobileWatch(tokenHash, '奉贤', '5', '212', 15, false, undefined, {
    provider: async (...args) => {
      calls += 1
      return power(...args, calls === 1 ? 17.7 : 11.6)
    }
  })
  await db.run(
    'UPDATE snapshots SET created_at=? WHERE room_key=?',
    new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    '奉贤:5:212'
  )

  await pollWatches({
    powerProvider: async (...args) => {
      calls += 1
      return power(...args, 11.6)
    }
  })

  const history = await getMobileHistory(tokenHash)
  assert.equal(calls, 2)
  assert.equal(history.items.length, 2)
  assert.equal(history.items.at(-1).kwh, 11.6)
  assert.equal(history.items.at(-1).recharged, false)
})

test('mobile notifications send once and re-arm after a recharge', async () => {
  const tokenHash = hashMobileToken('F'.repeat(48))
  await saveMobileWatch(tokenHash, '奉贤', '5', '213', 15, true, 'ExponentPushToken[test]', {
    provider: async (...args) => power(...args, 20)
  })
  await db.run(
    'UPDATE snapshots SET created_at=? WHERE room_key=?',
    new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    '奉贤:5:213'
  )
  const notifications = []
  const poll = kwh => pollWatches({
    powerProvider: async (...args) => power(...args, kwh),
    mobileSendNotification: async (_pushToken, _watch, value) => notifications.push(value)
  })

  await poll(10)
  await poll(10)
  await poll(20)
  await poll(10)

  assert.deepEqual(notifications, [10, 10])
  assert.equal((await db.get('SELECT alerted FROM mobile_watches WHERE token_hash=?', tokenHash)).alerted, 1)
})

test('stale mobile watches are removed so abandoned rooms stop being polled', async () => {
  const tokenHash = hashMobileToken('G'.repeat(48))
  await saveMobileWatch(tokenHash, '奉贤', '5', '214', 15, false, undefined, {
    provider: async (...args) => power(...args, 20)
  })
  await db.run(
    'UPDATE mobile_watches SET updated_at=? WHERE token_hash=?',
    new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    tokenHash
  )

  assert.equal(await cleanupMobileWatches(30), 1)
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM mobile_watches WHERE token_hash=?', tokenHash)).count, 0)
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots WHERE room_key=?', '奉贤:5:214')).count, 0)
})

test('mobile devices receive a published update independently of room monitoring', async () => {
  const tokenHash = hashMobileToken('H'.repeat(48))
  await registerMobileDevice(tokenHash, {
    appVersion: '1.1.0',
    appVersionCode: 2,
    pushToken: 'ExponentPushToken[device]'
  })

  const notifications = []
  const result = await publishMobileUpdate({
    version: '1.2.0',
    versionCode: 3,
    downloadUrl: 'https://github.com/peppa486/ecust-dorm-power/releases/latest',
    releaseNotes: '加入版本更新提醒。',
    sha256: 'A'.repeat(64)
  }, {
    mobileSendUpdateNotification: async (pushToken, update) => {
      notifications.push({ pushToken, version: update.version })
    }
  })

  assert.deepEqual(notifications, [{ pushToken: 'ExponentPushToken[device]', version: '1.2.0' }])
  assert.equal(result.notified, 1)
  assert.equal(result.failed, 0)
  assert.equal((await getMobileUpdate()).version, '1.2.0')
})

test('stale mobile devices are removed', async () => {
  const tokenHash = hashMobileToken('I'.repeat(48))
  await registerMobileDevice(tokenHash, { appVersion: '1.1.0', appVersionCode: 2 })
  await db.run(
    'UPDATE mobile_devices SET last_seen_at=? WHERE token_hash=?',
    new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
    tokenHash
  )

  assert.equal(await cleanupMobileDevices(90), 1)
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM mobile_devices WHERE token_hash=?', tokenHash)).count, 0)
})
