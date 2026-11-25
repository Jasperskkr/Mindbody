const { test } = require('node:test')
const assert = require('node:assert/strict')
const { memoryStorage, createRuntime, keyFor } = require('./helpers.cjs')

async function setup(download = async () => {}) {
  const memory = memoryStorage()
  const runtime = createRuntime(memory.uni, { 'src/platform/export-json.ts': { downloadJsonFile: download } })
  const storage = runtime.load('src/storage/daily-records.ts')
  for (const date of ['2026-11-18', '2026-11-19']) await storage.saveDailyRecord({ date, sleepHours: 0 })
  const history = runtime.page('src/pages/history/index.vue')
  await history.show()
  return { ...memory, storage, history: history.state }
}

test('canceling single delete or either bulk confirmation leaves every stored byte unchanged', async () => {
  const { history, data, deletes } = await setup()
  const before = [...data]
  history.requestDelete('2026-11-19')
  assert.match(history.confirmation.value.message, /2026-11-19/)
  history.cancelDeletion()
  await history.confirmDeletion()
  history.requestClearAll()
  history.cancelDeletion()
  history.requestClearAll()
  await history.confirmDeletion()
  assert.equal(history.pendingDeletion.value.stage, 2)
  assert.match(history.confirmation.value.message, /不可恢复/)
  assert.deepEqual([...data], before)
  history.cancelDeletion()
  await history.confirmDeletion()
  assert.deepEqual([...data], before)
  assert.deepEqual(deletes, [])
})

test('confirmed single and bulk deletion reload actual records, retaining unrelated storage', async () => {
  const { history, data } = await setup()
  data.set('other-app', 'keep')
  history.requestDelete('2026-11-19')
  await history.confirmDeletion()
  assert.deepEqual(history.records.value.map((record) => record.date), ['2026-11-18'])
  history.requestClearAll()
  await history.confirmDeletion()
  assert.equal(data.size, 2)
  await history.confirmDeletion()
  assert.deepEqual(history.records.value, [])
  assert.equal(data.get('other-app'), 'keep')
  assert.equal(history.feedbackKind.value, 'success')
})

test('delete failure shows error and refreshes the actual remaining list', async () => {
  const { history, state, data } = await setup()
  state.deleteFailure = keyFor('2026-11-19')
  const before = [...data]
  history.requestDelete('2026-11-19')
  await history.confirmDeletion()
  assert.equal(history.feedbackKind.value, 'error')
  assert.match(history.feedback.value, /删除失败/)
  assert.equal(history.records.value.length, 2)
  assert.deepEqual([...data], before)
})

test('export rereads all records, validates downloaded JSON, and reports corrupt storage or adapter failure', async () => {
  const downloads = []
  const { history, storage, data } = await setup(async (filename, json) => downloads.push({ filename, json }))
  await storage.saveDailyRecord({ date: '2026-11-17', mood: 2 }) // 页面未重进，导出也必须读取新记录
  await history.exportRecords()
  assert.equal(downloads.length, 1)
  assert.deepEqual(JSON.parse(downloads[0].json).records, await storage.listDailyRecords())
  data.set(keyFor('2026-11-16'), '{synthetic broken json')
  await history.exportRecords()
  assert.equal(history.feedbackKind.value, 'error')
  assert.match(history.feedback.value, /格式异常/)
  assert.equal(downloads.length, 1)
  const failed = await setup(async () => { throw new Error('虚构导出失败') })
  await failed.history.exportRecords()
  assert.match(failed.history.feedback.value, /导出失败/)
  assert.equal(failed.history.feedbackKind.value, 'error')
})

test('a successful delete followed by failed verification cannot show success', async () => {
  let failRead = false
  const runtime = createRuntime({}, {
    'src/storage/daily-records.ts': {
      async listDailyRecords() { if (failRead) throw new Error('synthetic refresh failure'); return [{ date: '2026-11-19', sleepHours: 0 }] },
      async deleteDailyRecord() { failRead = true; return true },
    },
  })
  const { state: history, show } = runtime.page('src/pages/history/index.vue')
  await show()
  history.requestDelete('2026-11-19')
  await history.confirmDeletion()
  assert.equal(history.feedbackKind.value, 'error')
  assert.match(history.feedback.value, /无法确认/)
  assert.match(history.readError.value, /refresh/)
})
