const { test } = require('node:test')
const assert = require('node:assert/strict')
const { memoryStorage, createRuntime } = require('./helpers.cjs')

test('history onShow reloads actual records, expands details, and recovers after read failure', async () => {
  const memory = memoryStorage()
  const runtime = createRuntime(memory.uni)
  const storage = runtime.load('src/storage/daily-records.ts')
  const history = runtime.page('src/pages/history/index.vue')
  await history.show()
  assert.deepEqual(history.state.records.value, [])
  await storage.saveDailyRecord({ date: '2026-11-19', sleepHours: 0 })
  await storage.saveDailyRecord({ date: '2026-11-18', mood: 4 })
  await history.show()
  assert.deepEqual(history.state.records.value.map((record) => record.date), ['2026-11-19', '2026-11-18'])
  history.state.toggleRecord('2026-11-19')
  assert.equal(history.state.expandedDate.value, '2026-11-19')
  history.state.toggleRecord('2026-11-19')
  assert.equal(history.state.expandedDate.value, '')
  memory.state.readFailure = true
  await history.show()
  assert.match(history.state.readError.value, /读取/)
  assert.deepEqual(history.state.records.value, [])
  memory.state.readFailure = false
  assert.equal(await history.state.refreshRecords(), true)
  assert.equal(history.state.records.value.length, 2)
})

test('history ignores a slower old result and an old error while a newer request is pending', async () => {
  const requests = []
  const runtime = createRuntime({}, {
    'src/storage/daily-records.ts': {
      listDailyRecords() { return new Promise((resolve, reject) => requests.push({ resolve, reject })) },
    },
  })
  const { state } = runtime.page('src/pages/history/index.vue')
  const old = state.refreshRecords()
  const latest = state.refreshRecords()
  const latestRecord = { date: '2026-11-19', sleepHours: 0 }
  requests[1].resolve([latestRecord])
  assert.equal(await latest, true)
  requests[0].resolve([{ date: '2026-11-18', mood: 4 }])
  assert.equal(await old, false)
  assert.deepEqual(state.records.value, [latestRecord])

  const oldFailure = state.refreshRecords()
  const pending = state.refreshRecords()
  requests[2].reject(new Error('synthetic old failure'))
  await oldFailure
  assert.equal(state.loading.value, true)
  assert.equal(state.readError.value, '')
  requests[3].resolve([])
  assert.equal(await pending, true)
  assert.deepEqual(state.records.value, [])
  assert.equal(state.loading.value, false)
})
