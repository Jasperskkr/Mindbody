const { test } = require('node:test')
const assert = require('node:assert/strict')
const { memoryStorage, createRuntime, keyFor } = require('./helpers.cjs')

function setup() {
  const memory = memoryStorage()
  return { ...memory, api: createRuntime(memory.uni).load('src/storage/daily-records.ts') }
}

test('list is date descending across years, preserves missing fields and zero, and ignores unrelated values', async () => {
  const { api, data, reads } = setup()
  data.set('other-app:settings', '{not a record')
  data.set('mindbody:daily-record:v2:future', 'leave untouched')
  assert.deepEqual(await api.listDailyRecords(), [])
  await api.saveDailyRecord({ date: '2026-12-31', sleepHours: 0 })
  await api.saveDailyRecord({ date: '2027-01-02', mood: 5 })
  await api.saveDailyRecord({ date: '2027-01-01', bodyNote: 'synthetic fixture only' })
  const records = await api.listDailyRecords()
  assert.deepEqual(records.map((record) => record.date), ['2027-01-02', '2027-01-01', '2026-12-31'])
  assert.equal(records[2].sleepHours, 0)
  assert.equal(Object.hasOwn(records[2], 'mood'), false)
  assert.ok(reads.every((key) => key.startsWith('mindbody:daily-record:v1:')))
})

test('invalid dedicated date keys report INVALID_DATE without deleting or silently omitting them', async () => {
  const { api, data, deletes } = setup()
  data.set(keyFor('2026-02-30'), 'synthetic bad key')
  await assert.rejects(api.listDailyRecords(), { code: 'INVALID_DATE' })
  await assert.rejects(api.deleteAllDailyRecords(), { code: 'INVALID_DATE' })
  await assert.rejects(api.deleteDailyRecord('bad'), { code: 'INVALID_DATE' })
  assert.equal(deletes.length, 0)
  assert.equal(data.size, 1)
})

test('corrupt JSON aborts the complete list and bulk preflight without any mutation', async () => {
  const { api, data, deletes } = setup()
  await api.saveDailyRecord({ date: '2026-11-19', mood: 4 })
  data.set(keyFor('2026-11-18'), '{synthetic broken json')
  const before = [...data]
  await assert.rejects(api.listDailyRecords(), { code: 'CORRUPT_RECORD', date: '2026-11-18' })
  await assert.rejects(api.deleteAllDailyRecords(), { code: 'CORRUPT_RECORD' })
  await assert.rejects(api.deleteDailyRecord('2026-11-18'), { code: 'CORRUPT_RECORD' })
  assert.deepEqual([...data], before)
  assert.deepEqual(deletes, [])
})

test('single delete is idempotent, keeps other dates and unrelated keys, and validates actual removal', async () => {
  const { api, data, state } = setup()
  data.set('other-app', 'preserve')
  await api.saveDailyRecord({ date: '2026-11-18', energy: 1 })
  const today = await api.saveDailyRecord({ date: '2026-11-19', sleepHours: 0 })
  assert.equal(await api.deleteDailyRecord('2026-11-18'), true)
  assert.equal(await api.deleteDailyRecord('2026-11-18'), false)
  assert.deepEqual(await api.loadDailyRecord('2026-11-19'), today)
  assert.equal(data.get('other-app'), 'preserve')
  state.silentDelete = true
  await assert.rejects(api.deleteDailyRecord('2026-11-19'), { code: 'DELETE_FAILED' })
  assert.deepEqual(await api.loadDailyRecord('2026-11-19'), today)
})

test('bulk delete only removes validated v1 records and returns confirmed count', async () => {
  const { api, data } = setup()
  data.set('other-app', 'preserve')
  data.set('mindbody:daily-record:v2:any', 'preserve')
  await api.saveDailyRecord({ date: '2026-11-18', mood: 1 })
  await api.saveDailyRecord({ date: '2026-11-19', sleepHours: 0 })
  assert.equal(await api.deleteAllDailyRecords(), 2)
  assert.deepEqual(await api.listDailyRecords(), [])
  assert.equal(data.get('other-app'), 'preserve')
  assert.equal(data.get('mindbody:daily-record:v2:any'), 'preserve')
  assert.equal(await api.deleteAllDailyRecords(), 0)
})

test('partial bulk failure reports confirmed count and leaves remaining records readable', async () => {
  const { api, data, state } = setup()
  for (const date of ['2026-11-17', '2026-11-18', '2026-11-19']) await api.saveDailyRecord({ date, mood: 2 })
  state.deleteFailure = keyFor('2026-11-18')
  await assert.rejects(api.deleteAllDailyRecords(), (error) => error.code === 'DELETE_FAILED' && error.deletedCount === 1)
  assert.equal(data.has(keyFor('2026-11-19')), false)
  assert.deepEqual((await api.listDailyRecords()).map((record) => record.date), ['2026-11-18', '2026-11-17'])
})

test('read and remove failures preserve data and provide typed errors', async () => {
  const { api, data, state } = setup()
  await api.saveDailyRecord({ date: '2026-11-19', mood: 4 })
  const before = [...data]
  state.readFailure = true
  await assert.rejects(api.listDailyRecords(), { code: 'READ_FAILED' })
  await assert.rejects(api.deleteAllDailyRecords(), { code: 'READ_FAILED' })
  state.readFailure = false
  state.getFailure = true
  await assert.rejects(api.listDailyRecords(), { code: 'READ_FAILED' })
  state.getFailure = false
  state.throwDelete = true
  await assert.rejects(api.deleteDailyRecord('2026-11-19'), { code: 'DELETE_FAILED' })
  assert.deepEqual([...data], before)
})

test('bulk deletion stops for changed records and detects newly added records without deleting them', async () => {
  const memory = memoryStorage()
  const api = createRuntime(memory.uni).load('src/storage/daily-records.ts')
  const original = await api.saveDailyRecord({ date: '2026-11-19', mood: 2 })
  const changed = { ...original, mood: 5 }
  const read = memory.uni.getStorage
  let reads = 0
  memory.uni.getStorage = (options) => {
    if (++reads === 2) memory.data.set(keyFor(original.date), JSON.stringify({ version: 1, record: changed }))
    read(options)
  }
  await assert.rejects(api.deleteAllDailyRecords(), (error) => error.code === 'DELETE_FAILED' && error.deletedCount === 0)
  assert.deepEqual(await api.loadDailyRecord(original.date), changed)
  assert.deepEqual(memory.deletes, [])

  const other = setup()
  const saved = await other.api.saveDailyRecord({ date: '2026-11-19', sleepHours: 0 })
  const added = { ...saved, date: '2026-11-18' }
  // 在一次已授权测试删除后模拟另一页面新增，仅验证不会顺带删除新记录。
  const remove = other.uni.removeStorage
  other.uni.removeStorage = (options) => {
    remove(options)
    other.data.set(keyFor(added.date), JSON.stringify({ version: 1, record: added }))
  }
  await assert.rejects(other.api.deleteAllDailyRecords(), (error) => error.code === 'DELETE_FAILED' && error.deletedCount === 1)
  assert.deepEqual(await other.api.listDailyRecords(), [added])
})
