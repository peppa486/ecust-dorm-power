import express from 'express'
import helmet from 'helmet'
import { buildingOptions } from './buildings.js'
import { requireMobile } from './mobile-auth.js'
import { createRateLimit } from './rate-limit.js'
import {
  getMobileHistory,
  getMobileWatch,
  queryPower,
  removeMobileWatch,
  saveMobileWatch
} from './service.js'

export function createApp() {
  const app = express()
  const trustProxy = String(process.env.TRUST_PROXY || '').toLowerCase()
  const trustProxyHops = trustProxy === 'true'
    ? 1
    : Number.isInteger(Number(trustProxy)) && Number(trustProxy) >= 0
      ? Number(trustProxy)
      : 0
  app.set('trust proxy', trustProxyHops)
  app.use(helmet())
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', createRateLimit({ max: Number(process.env.RATE_LIMIT_PER_MINUTE || 60) }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.get('/api/buildings', (req, res, next) => {
    try {
      res.json({ buildings: buildingOptions(String(req.query.campus || '')) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/query', createRateLimit({ max: Number(process.env.RATE_LIMIT_QUERY_PER_MINUTE || 12) }), async (req, res, next) => {
    try {
      const campus = String(req.body?.campus || '')
      const building = String(req.body?.building || '')
      const room = String(req.body?.room || '')
      res.json(await queryPower(campus, building, room))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/mobile/watch', requireMobile, async (req, res, next) => {
    try {
      res.json({ watch: await getMobileWatch(req.mobileTokenHash) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/mobile/watch', createRateLimit({ max: 30 }), requireMobile, async (req, res, next) => {
    try {
      const campus = String(req.body?.campus || '')
      const building = String(req.body?.building || '')
      const room = String(req.body?.room || '')
      const watch = await saveMobileWatch(
        req.mobileTokenHash,
        campus,
        building,
        room,
        req.body?.threshold,
        req.body?.notificationsEnabled,
        req.body?.pushToken
      )
      res.json({ watch })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/mobile/watch', createRateLimit({ max: 30 }), requireMobile, async (req, res, next) => {
    try {
      await removeMobileWatch(req.mobileTokenHash)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/mobile/history', requireMobile, async (req, res, next) => {
    try {
      res.json(await getMobileHistory(req.mobileTokenHash))
    } catch (error) {
      next(error)
    }
  })

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

  app.use((error, _req, res, _next) => {
    const message = error?.message || ''
    const isClientError = /不支持|格式|缺少|未配置|未设置|没有设置|还没有|请先|不匹配/.test(message)
    const statusCode = Number(error?.statusCode) || (isClientError ? 400 : 500)
    const expose = statusCode < 500 || error?.expose
    if (statusCode >= 500) console.error(error)
    res.status(statusCode).json({ error: expose ? error?.message || '服务器异常' : '服务器暂时不可用' })
  })

  return app
}
