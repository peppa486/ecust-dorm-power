import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILDINGS, buildingLabel, buildingOptions, normalizeRoom, roomKey, validateRoom } from '../src/buildings.js'

test('building map contains known ECUST ids', () => {
  assert.equal(BUILDINGS.奉贤['5'], '27')
  assert.equal(BUILDINGS.徐汇['1'], '64')
  assert.equal(BUILDINGS.徐汇['南区4A'], '68')
  assert.equal(Object.keys(BUILDINGS.奉贤).length, 29)
  assert.equal(Object.keys(BUILDINGS.徐汇).length, 32)
})

test('building options preserve value and readable label', () => {
  const options = buildingOptions('徐汇')
  assert.deepEqual(options.find(item => item.value === '晨园'), { value: '晨园', label: '晨园公寓' })
  assert.equal(buildingLabel('奉贤', '5'), '5号楼')
})

test('room validation normalizes letters and rejects unsafe values', () => {
  assert.equal(validateRoom('徐汇', '南区4A', ' a12 '), 'A12')
  assert.equal(normalizeRoom(' 202 '), '202')
  assert.equal(roomKey('奉贤', '5', ' 202 '), '奉贤:5:202')
  assert.throws(() => validateRoom('奉贤', '99', '202'), /楼栋/)
  assert.throws(() => validateRoom('奉贤', '5', '../2'), /寝室号/)
  assert.throws(() => validateRoom('奉贤', '5', '--'), /寝室号/)
})
