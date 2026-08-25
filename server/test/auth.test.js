import test, { after, mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import axios from 'axios'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecust-dorm-auth-'))
process.env.DB_PATH = path.join(tempDir, 'power.sqlite')
process.env.WECHAT_APPID = 'appid'
process.env.WECHAT_SECRET = 'secret'

const { closeDb, getDb } = await import('../src/db.js')
const { cleanupSessions, loginWithCode, requireUser } = await import('../src/auth.js')
const db = await getDb()

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

after(async () => {
  mock.restoreAll()
  await closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

test('creates a hashed session with a 30-day expiry', async () => {
  mock.method(axios, 'get', async () => ({ data: { openid: 'openid-1', session_key: 'session-key' } }))
  const result = await loginWithCode('wx-code')
  const row = await db.get('SELECT token,openid,expires_at FROM sessions WHERE openid=?', 'openid-1')
  assert.equal(row.openid, 'openid-1')
  assert.notEqual(row.token, result.token)
  assert.ok(row.expires_at > Date.now())
  assert.ok(row.expires_at - Date.now() <= 30 * 24 * 60 * 60 * 1000)

  const req = { headers: { authorization: `Bearer ${result.token}` } }
  const res = response()
  let nextCalled = false
  await requireUser(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
  assert.equal(req.openid, 'openid-1')
  mock.restoreAll()
})

test('expired sessions are rejected and removed', async () => {
  mock.method(axios, 'get', async () => ({ data: { openid: 'openid-2' } }))
  const result = await loginWithCode('wx-code-2')
  await db.run('UPDATE sessions SET expires_at=? WHERE openid=?', Date.now() - 1, 'openid-2')

  const res = response()
  await requireUser({ headers: { authorization: `Bearer ${result.token}` } }, res, () => {})
  assert.equal(res.statusCode, 401)
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM sessions WHERE openid=?', 'openid-2')).count, 0)
  mock.restoreAll()
})

test('cleanupSessions removes expired rows', async () => {
  await db.run(
    'INSERT INTO sessions(token,openid,expires_at) VALUES(?,?,?)',
    'expired-hash',
    'openid-expired',
    Date.now() - 1
  )
  await cleanupSessions()
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM sessions WHERE openid=?', 'openid-expired')).count, 0)
})
