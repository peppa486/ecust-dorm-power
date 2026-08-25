export class Semaphore {
  constructor(limit) {
    this.limit = Math.max(1, Number(limit) || 1)
    this.active = 0
    this.queue = []
  }

  acquire() {
    if (this.active < this.limit) {
      this.active += 1
      return Promise.resolve(this.releaseHandle())
    }
    return new Promise(resolve => {
      this.queue.push(() => {
        this.active += 1
        resolve(this.releaseHandle())
      })
    })
  }

  releaseHandle() {
    let released = false
    return () => {
      if (released) return
      released = true
      this.active -= 1
      const next = this.queue.shift()
      if (next) next()
    }
  }

  async use(fn) {
    const release = await this.acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }
}
