export class TtlCache {
  constructor(ttlMs, maxEntries = 2000) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this.map = new Map()
  }

  get(key) {
    const item = this.map.get(key)
    if (!item) return null
    if (Date.now() - item.time >= this.ttlMs) {
      this.map.delete(key)
      return null
    }
    this.map.delete(key)
    this.map.set(key, item)
    return item.value
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, { value, time: Date.now() })
    while (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value)
    }
  }
}
