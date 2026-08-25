import test from 'node:test'
import assert from 'node:assert/strict'
import { Semaphore } from '../src/semaphore.js'

test('semaphore caps concurrent work', async () => {
  const semaphore = new Semaphore(2)
  let active = 0
  let peak = 0
  const jobs = Array.from({ length: 6 }, (_, index) => semaphore.use(async () => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active -= 1
    return index
  }))
  assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4, 5])
  assert.equal(peak, 2)
})
