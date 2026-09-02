import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecust-dorm-app-'))
process.env.DB_PATH = path.join(tempDir, 'power.sqlite')

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
