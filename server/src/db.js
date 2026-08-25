import fs from 'node:fs'
import path from 'node:path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

let dbPromise

async function migrate(db) {
  await db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    PRAGMA synchronous=NORMAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      openid TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS watches (
      openid TEXT PRIMARY KEY,
      campus TEXT NOT NULL,
      building TEXT NOT NULL,
      room TEXT NOT NULL,
      threshold REAL NOT NULL DEFAULT 15,
      credits INTEGER NOT NULL DEFAULT 0,
      alerted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_key TEXT NOT NULL,
      campus TEXT NOT NULL,
      building TEXT NOT NULL,
      room TEXT NOT NULL,
      kwh REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_openid ON sessions(openid);
    CREATE INDEX IF NOT EXISTS idx_snapshots_room_time ON snapshots(room_key, created_at DESC);
  `)

  const columns = await db.all('PRAGMA table_info(sessions)')
  if (!columns.some(column => column.name === 'expires_at')) {
    await db.exec('ALTER TABLE sessions ADD COLUMN expires_at INTEGER')
    await db.run('UPDATE sessions SET expires_at=? WHERE expires_at IS NULL', Date.now() - 1)
  }
  await db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)')
}

export async function getDb() {
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    const file = process.env.DB_PATH || './data/power.sqlite'
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const db = await open({ filename: file, driver: sqlite3.Database })
    await migrate(db)
    return db
  })()
  return dbPromise
}

export async function closeDb() {
  if (!dbPromise) return
  const db = await dbPromise
  await db.close()
  dbPromise = null
}
