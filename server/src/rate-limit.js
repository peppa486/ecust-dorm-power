export function createRateLimit({ windowMs = 60_000, max = 60 } = {}) {
  const buckets = new Map()
  let calls = 0

  return function rateLimit(req, res, next) {
    const now = Date.now()
    const key = req.ip || 'unknown'
    const item = buckets.get(key)
    const bucket = !item || now - item.start >= windowMs ? { start: now, count: 0 } : item
    bucket.count += 1
    buckets.set(key, bucket)

    calls += 1
    if (calls % 500 === 0) {
      for (const [bucketKey, value] of buckets) {
        if (now - value.start >= windowMs * 2) buckets.delete(bucketKey)
      }
    }

    if (bucket.count > max) return res.status(429).json({ error: '请求太频繁，请稍后再试' })
    next()
  }
}
