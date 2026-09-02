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

function readBearerToken(req) {
  const header = req.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

export function requireMobileUpdateAdmin(req, res, next) {
  const expected = process.env.MOBILE_UPDATE_ADMIN_TOKEN
  const provided = readBearerToken(req)
  const valid = typeof expected === 'string'
    && expected.length > 0
    && provided.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))

  if (!valid) {
    res.status(expected ? 401 : 503).json({
      error: expected ? '更新推送鉴权失败' : '更新推送尚未配置'
    })
    return
  }
  next()
}
