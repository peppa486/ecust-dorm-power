import crypto from 'node:crypto'
import axios from 'axios'
import { getDb } from './db.js'

const SESSION_DAYS = 30

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function loginWithCode(code) {
  if (typeof code !== 'string' || !code.trim() || code.length > 512) throw new Error('缺少微信登录 code')
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appid || !secret) {
    const error = new Error('服务端尚未配置微信登录')
    error.statusCode = 503
    error.expose = true
    throw error
  }

  let data
  try {
    ({ data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: { appid, secret, js_code: code, grant_type: 'authorization_code' },
      timeout: 10000
    }))
  } catch (cause) {
    const error = new Error('微信登录服务暂时不可用')
    error.statusCode = 503
    error.expose = true
    error.cause = cause
    throw error
  }
  if (!data.openid) {
    const error = new Error(data.errmsg || '微信登录失败')
    error.statusCode = 400
    error.expose = true
    throw error
  }

  const db = await getDb()
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  await db.run('DELETE FROM sessions WHERE openid=? OR expires_at<?', data.openid, Date.now())
  await db.run('INSERT INTO sessions(token,openid,expires_at) VALUES(?,?,?)', hashToken(token), data.openid, expiresAt)
  return { token, expiresAt }
}

export async function requireUser(req, res, next) {
  try {
    const raw = req.headers.authorization || ''
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : ''
    if (!token) return res.status(401).json({ error: '未登录' })
    const db = await getDb()
    const tokenHash = hashToken(token)
    const row = await db.get('SELECT openid,expires_at FROM sessions WHERE token=?', tokenHash)
    if (!row || !row.expires_at || row.expires_at <= Date.now()) {
      if (row) await db.run('DELETE FROM sessions WHERE token=?', tokenHash)
      return res.status(401).json({ error: '登录已失效' })
    }
    req.openid = row.openid
    next()
  } catch (error) {
    next(error)
  }
}

export async function cleanupSessions() {
  const db = await getDb()
  await db.run('DELETE FROM sessions WHERE expires_at IS NULL OR expires_at<?', Date.now())
}
