import test from 'node:test'
import assert from 'node:assert/strict'
import { TtlCache } from '../src/cache.js'

test('cache returns recent value', () => {
  const cache = new TtlCache(1000, 2)
  cache.set('a', 1)
  assert.equal(cache.get('a'), 1)
})

test('cache evicts oldest entry when full', () => {
  const cache = new TtlCache(1000, 2)
  cache.set('a', 1)
  cache.set('b', 2)
  cache.get('a')
  cache.set('c', 3)
  assert.equal(cache.get('b'), null)
  assert.equal(cache.get('a'), 1)
  assert.equal(cache.get('c'), 3)
})
