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
    CREATE TABLE IF NOT EXISTS mobile_watches (
      token_hash TEXT PRIMARY KEY,
      campus TEXT NOT NULL,
      building TEXT NOT NULL,
      room TEXT NOT NULL,
      threshold REAL NOT NULL DEFAULT 15,
      notifications_enabled INTEGER NOT NULL DEFAULT 0,
      alerted INTEGER NOT NULL DEFAULT 0,
      push_token TEXT,
      push_provider TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS mobile_devices (
      token_hash TEXT PRIMARY KEY,
      push_token TEXT,
      push_provider TEXT,
      app_version TEXT NOT NULL,
      app_version_code INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_mobile_devices_seen ON mobile_devices(last_seen_at);
    CREATE TABLE IF NOT EXISTS mobile_updates (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version TEXT NOT NULL,
      version_code INTEGER NOT NULL,
      download_url TEXT NOT NULL,
      release_notes TEXT NOT NULL DEFAULT '',
      force_update INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT,
      published_at TEXT NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_mobile_watches_room ON mobile_watches(campus, building, room);
    CREATE INDEX IF NOT EXISTS idx_snapshots_room_time ON snapshots(room_key, created_at DESC);
  `)
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
