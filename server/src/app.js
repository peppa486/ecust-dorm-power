import express from 'express'
import helmet from 'helmet'
import { buildingOptions } from './buildings.js'
import { loginWithCode, requireUser } from './auth.js'
import { createRateLimit } from './rate-limit.js'
import {
  addSubscriptionCredit,
  getHistory,
  getWatch,
  queryPower,
  removeWatch,
  saveWatch
} from './service.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 0))
  app.use(helmet())
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', createRateLimit({ max: Number(process.env.RATE_LIMIT_PER_MINUTE || 60) }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.get('/api/client-config', (_req, res) => {
    res.json({ lowPowerTemplateId: process.env.WECHAT_LOW_POWER_TEMPLATE_ID || '' })
  })

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

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      res.json(await loginWithCode(req.body?.code))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/watch', requireUser, async (req, res, next) => {
    try {
      res.json({ watch: await getWatch(req.openid) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/watch', requireUser, async (req, res, next) => {
    try {
      const campus = String(req.body?.campus || '')
      const building = String(req.body?.building || '')
      const room = String(req.body?.room || '')
      res.json({ watch: await saveWatch(req.openid, campus, building, room, req.body?.threshold) })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/watch', requireUser, async (req, res, next) => {
    try {
      await removeWatch(req.openid)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/watch/subscription', requireUser, async (req, res, next) => {
    try {
      const expected = process.env.WECHAT_LOW_POWER_TEMPLATE_ID || ''
      if (!expected || req.body?.templateId !== expected) throw new Error('订阅模板不匹配')
      res.json({ watch: await addSubscriptionCredit(req.openid, req.body?.threshold) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/history', requireUser, async (req, res, next) => {
    try {
      res.json(await getHistory(req.openid))
    } catch (error) {
      next(error)
    }
  })

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

  app.use((error, _req, res, _next) => {
    const message = error?.message || '服务器异常'
    const isClientError = /不支持|格式|缺少|未配置|未设置|没有设置|还没有|请先|不匹配/.test(message)
    if (!isClientError) console.error(error)
    res.status(isClientError ? 400 : 502).json({ error: message })
  })

  return app
}
