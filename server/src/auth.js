import crypto from 'node:crypto'
import axios from 'axios'
import { getDb } from './db.js'

const SESSION_DAYS = 30

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function loginWithCode(code) {
  if (!code) throw new Error('缺少微信登录 code')
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appid || !secret) throw new Error('服务端尚未配置微信登录')

  const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
    params: { appid, secret, js_code: code, grant_type: 'authorization_code' },
    timeout: 10000
  })
  if (!data.openid) throw new Error(data.errmsg || '微信登录失败')

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
