const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createRuntime } = require('./helpers.cjs')
const stamp = '2026-11-19T00:00:00.000Z'
const record = (fields) => ({ date: '2026-11-19', ...fields, createdAt: stamp, updatedAt: stamp })

test('JSON export parses back with every defined field, timestamp, zero and absence intact', () => {
  const { serializeRecordExport } = createRuntime({}).load('src/utils/record-export.ts')
  const input = [Object.freeze(record({ date: '2026-11-18', sleepHours: 0 })), Object.freeze(record({ mood: 5, stress: 1, energy: 2, bodyNote: 'synthetic export fixture' }))]
  const parsed = JSON.parse(serializeRecordExport(input, stamp))
  assert.deepEqual(parsed, { schemaVersion: 1, exportedAt: stamp, records: [input[1], input[0]] })
  assert.equal(Object.hasOwn(parsed.records[1], 'energy'), false)
  assert.equal(input[0].date, '2026-11-18')
  assert.deepEqual(JSON.parse(serializeRecordExport([], stamp)).records, [])
})

test('invalid or duplicate records and invalid export times abort export instead of omitting content', () => {
  const { serializeRecordExport } = createRuntime({}).load('src/utils/record-export.ts')
  for (const broken of [record({ mood: 9 }), record({ createdAt: 'bad', energy: 4 }), record({ date: '2026-02-30', mood: 4 })]) {
    assert.throws(() => serializeRecordExport([record({ mood: 4 }), broken]), /导出失败/)
  }
  assert.throws(() => serializeRecordExport([record({ mood: 4 }), record({ mood: 3 })]), /重复/)
  assert.throws(() => serializeRecordExport([], 'bad'), /时间/)
})

test('H5 adapter reports blocked or unavailable download and cleans up its temporary objects', async () => {
  const unsupported = createRuntime({}).load('src/platform/export-json.ts')
  await assert.rejects(unsupported.downloadJsonFile('test.json', '{}'), /导出失败/)
  let removed = false, revoked = false
  const adapter = createRuntime({}, {}, {
    document: { body: { appendChild() {} }, createElement() { return { click() { throw new Error('synthetic blocked download') }, remove() { removed = true } } } },
    URL: { createObjectURL() { return 'blob:synthetic' }, revokeObjectURL() { revoked = true } },
  }).load('src/platform/export-json.ts')
  await assert.rejects(adapter.downloadJsonFile('test.json', '{}'), /导出失败/)
  assert.equal(removed, true)
  assert.equal(revoked, true)
})
