import crypto from 'node:crypto'

const MOBILE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/

export function hashMobileToken(token) {
  if (typeof token !== 'string' || !MOBILE_TOKEN_PATTERN.test(token)) {
    const error = new Error('设备标识格式不正确')
    error.statusCode = 401
    error.expose = true
    throw error
  }
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function requireMobile(req, res, next) {
  try {
    const header = req.headers['x-mobile-token']
    const token = Array.isArray(header) ? header[0] : header
    req.mobileTokenHash = hashMobileToken(token)
    next()
  } catch {
    res.status(401).json({ error: '移动设备未登记' })
  }
}
