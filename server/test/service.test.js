import test, { after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecust-dorm-service-'))
process.env.DB_PATH = path.join(tempDir, 'power.sqlite')

const { closeDb, getDb } = await import('../src/db.js')
const {
  addSubscriptionCredit,
  getHistory,
  pollWatches,
  queryPower,
  removeWatch,
  saveWatch,
  storeSnapshot
} = await import('../src/service.js')
const { WeChatSendError } = await import('../src/wechat.js')

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
  await db.exec('DELETE FROM watches; DELETE FROM snapshots; DELETE FROM sessions;')
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

test('same-room watchers share one snapshot and cleanup happens after the last removal', async () => {
  const provider = async (campus, building, room) => power(campus, building, room, 20)
  await saveWatch('user-1', '奉贤', '5', '205', 15, { provider })
  await saveWatch('user-2', '奉贤', '5', '205', 15, { provider })

  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots')).count, 1)
  await removeWatch('user-1')
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots')).count, 1)
  await removeWatch('user-2')
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots')).count, 0)
})

test('changing rooms preserves history for another watcher', async () => {
  const provider = async (campus, building, room) => power(campus, building, room, 20)
  await saveWatch('user-1', '奉贤', '5', '206', 15, { provider })
  await saveWatch('user-2', '奉贤', '5', '206', 15, { provider })
  await saveWatch('user-1', '奉贤', '5', '207', 15, { provider })

  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots WHERE room_key=?', '奉贤:5:206')).count, 1)
  await removeWatch('user-2')
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots WHERE room_key=?', '奉贤:5:206')).count, 0)
  await removeWatch('user-1')
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM snapshots WHERE room_key=?', '奉贤:5:207')).count, 0)
})

test('polling one room notifies all watchers and prevents re-entry', async () => {
  const provider = async (campus, building, room) => {
    await new Promise(resolve => setTimeout(resolve, 15))
    return power(campus, building, room, 10)
  }
  await saveWatch('user-1', '徐汇', '3', '301', 15, { provider: async (...args) => power(...args, 20) })
  await saveWatch('user-2', '徐汇', '3', '301', 15, { provider: async (...args) => power(...args, 20) })
  await db.run('UPDATE watches SET credits=1,alerted=0 WHERE campus=? AND building=? AND room=?', '徐汇', '3', '301')

  let calls = 0
  const notifications = []
  const sendNotification = async (openid) => {
    notifications.push(openid)
  }
  const countingProvider = async (...args) => {
    calls += 1
    return provider(...args)
  }
  await Promise.all([
    pollWatches({ powerProvider: countingProvider, sendNotification }),
    pollWatches({ powerProvider: countingProvider, sendNotification })
  ])

  assert.equal(calls, 1)
  assert.deepEqual(notifications.sort(), ['user-1', 'user-2'])
  const rows = await db.all('SELECT credits,alerted FROM watches ORDER BY openid')
  assert.deepEqual(rows, [{ credits: 0, alerted: 1 }, { credits: 0, alerted: 1 }])
})

test('43101 clears credits while 47003 keeps them', async () => {
  const provider = async (campus, building, room) => power(campus, building, room, 10)
  await saveWatch('user-43101', '奉贤', '5', '208', 15, { provider: async (...args) => power(...args, 20) })
  await db.run('UPDATE watches SET credits=1 WHERE openid=?', 'user-43101')
  await pollWatches({
    powerProvider: provider,
    sendNotification: async () => { throw new WeChatSendError(43101, 'no credit') }
  })
  assert.equal((await db.get('SELECT credits FROM watches WHERE openid=?', 'user-43101')).credits, 0)

  await clearData()
  await saveWatch('user-47003', '奉贤', '5', '209', 15, { provider: async (...args) => power(...args, 20) })
  await db.run('UPDATE watches SET credits=1 WHERE openid=?', 'user-47003')
  await pollWatches({
    powerProvider: provider,
    sendNotification: async () => { throw new WeChatSendError(47003, 'bad template') }
  })
  assert.equal((await db.get('SELECT credits FROM watches WHERE openid=?', 'user-47003')).credits, 1)
})

test('history is available only for a watched room', async () => {
  await assert.rejects(() => getHistory('missing-user'), /还没有设置/)
  await storeSnapshot(power('奉贤', '5', '210', 12))
  await assert.rejects(() => getHistory('missing-user'), /还没有设置/)
})

test('subscription credit updates the threshold and re-arms an alert', async () => {
  const provider = async (campus, building, room) => power(campus, building, room, 20)
  await saveWatch('user-subscription', '奉贤', '5', '211', 15, { provider })
  await db.run('UPDATE watches SET alerted=1 WHERE openid=?', 'user-subscription')
  const watch = await addSubscriptionCredit('user-subscription', 10)
  assert.equal(watch.threshold, 10)
  assert.equal(watch.credits, 1)
  assert.equal(watch.alerted, 0)
})
