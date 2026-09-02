import 'dotenv/config'
import cron from 'node-cron'
import { createApp } from './app.js'
import { closeDb, getDb } from './db.js'
import { cleanupMobileWatches, cleanupSnapshots, pollWatches } from './service.js'

const port = Number(process.env.PORT || 8787)
await getDb()

const server = createApp().listen(port, '0.0.0.0', () => {
  console.log(`Dorm Power API :${port}`)
})

let polling = false
cron.schedule('7 * * * *', async () => {
  if (polling) return
  polling = true
  try {
    await pollWatches()
  } catch (error) {
    console.error(error)
  } finally {
    polling = false
  }
})
cron.schedule('23 4 * * *', async () => {
  try {
    await cleanupMobileWatches()
    await cleanupSnapshots()
  } catch (error) {
    console.error(error)
  }
})

async function shutdown() {
  await new Promise(resolve => server.close(resolve))
  await closeDb()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
