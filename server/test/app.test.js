import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecust-dorm-app-'))
process.env.DB_PATH = path.join(tempDir, 'power.sqlite')
process.env.MOBILE_UPDATE_ADMIN_TOKEN = 'test-update-admin-token'

const { createApp } = await import('../src/app.js')
const { closeDb } = await import('../src/db.js')

const server = createApp().listen(0)
const { port } = server.address()
const baseUrl = `http://127.0.0.1:${port}`

after(async () => {
  await new Promise(resolve => server.close(resolve))
  await closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

test('mobile history rejects requests without a valid device token', async () => {
  const response = await fetch(`${baseUrl}/api/mobile/history`)
  assert.equal(response.status, 401)
})

test('mobile watch endpoint accepts a device token before registration', async () => {
  const response = await fetch(`${baseUrl}/api/mobile/watch`, {
    headers: { 'x-mobile-token': 'A'.repeat(48) }
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { watch: null })
})

test('mobile update endpoint is public and returns no update before the first release', async () => {
  const response = await fetch(`${baseUrl}/api/mobile/update`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { update: null })
})

test('mobile device endpoint records the app version and push registration', async () => {
  const response = await fetch(`${baseUrl}/api/mobile/device`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mobile-token': 'B'.repeat(48)
    },
    body: JSON.stringify({
      appVersion: '1.1.0',
      appVersionCode: 2,
      pushToken: 'ExponentPushToken[app-test]'
    })
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.device.appVersion, '1.1.0')
  assert.equal(body.device.appVersionCode, 2)
  assert.equal(typeof body.device.lastSeenAt, 'string')
})

test('mobile update publishing requires the admin token', async () => {
  const response = await fetch(`${baseUrl}/api/admin/mobile-update`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: '1.2.0',
      versionCode: 3,
      downloadUrl: 'https://github.com/peppa486/ecust-dorm-power/releases/latest'
    })
  })
  assert.equal(response.status, 401)
})
