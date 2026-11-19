const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// 使用现有 TypeScript 转译与内存 uni 替身，不读写用户的浏览器或健康记录。
function loadSource(relativePath, storage = {}) {
  const cache = new Map()
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    const localRequire = (specifier) => load(path.resolve(path.dirname(filename), `${specifier}.ts`))
    new Function('require', 'module', 'exports', 'uni', outputText)(localRequire, module, module.exports, storage)
    return module.exports
  }
  return load(path.resolve(__dirname, '..', relativePath))
}

function memoryStorage() {
  const data = new Map()
  const state = { readFailure: false, getFailure: false, writeFailure: false, throwRead: false, throwWrite: false, writes: 0 }
  const uni = {
    getStorageInfo({ success, fail }) {
      if (state.throwRead) throw new Error('Synthetic storage access failure')
      if (state.readFailure) return fail({})
      success({ keys: [...data.keys()] })
    },
    getStorage({ key, success, fail }) {
      if (state.readFailure || state.getFailure) return fail({})
      success({ data: data.get(key) })
    },
    setStorage({ key, data: value, success, fail }) {
      if (state.throwWrite) throw new Error('Synthetic write exception')
      if (state.writeFailure) return fail({})
      data.set(key, value)
      state.writes += 1
      success({})
    },
  }
  return { data, state, api: loadSource('src/storage/daily-records.ts', uni) }
}

const date = '2026-11-19'
const key = `mindbody:daily-record:v1:${date}`
const { parseRecordForm, validateRecordInput } = loadSource('src/utils/record-validation.ts')
const blank = () => ({ sleepHours: '', bodyNote: '' })

test('empty and whitespace-only forms cannot be saved', () => {
  assert.equal(parseRecordForm(blank(), date).ok, false)
  assert.equal(parseRecordForm({ sleepHours: '   ', bodyNote: ' \n ' }, date).ok, false)
})

test('partial form omits missing fields, while zero hours remains valid', () => {
  const partial = parseRecordForm({ ...blank(), mood: 2 }, date)
  assert.deepEqual(partial, { ok: true, value: { date, mood: 2 } })
  assert.deepEqual(parseRecordForm({ ...blank(), sleepHours: '0' }, date), {
    ok: true, value: { date, sleepHours: 0 },
  })
})

test('sleep accepts decimal boundaries and rejects out-of-range or malformed text', () => {
  for (const sleepHours of ['0', '24', '7.5', '.5']) {
    assert.equal(parseRecordForm({ ...blank(), sleepHours }, date).ok, true, sleepHours)
  }
  for (const sleepHours of ['-1', '24.1', '25', 'abc', 'NaN', 'Infinity', '1e1', '0x10', '7,5']) {
    assert.equal(parseRecordForm({ ...blank(), sleepHours }, date).ok, false, sleepHours)
  }
})

test('all three scales require integers from 1 to 5 and do not accept null', () => {
  for (const field of ['mood', 'stress', 'energy']) {
    for (const value of [1, 5]) assert.equal(validateRecordInput({ date, [field]: value }).ok, true)
    for (const value of [0, 6, 2.5, '3', null, NaN]) {
      assert.equal(validateRecordInput({ date, [field]: value }).ok, false)
    }
  }
})

test('date and note validation reject invalid data and trim the synthetic note', () => {
  assert.equal(validateRecordInput({ date: '2026-02-30', mood: 1 }).ok, false)
  assert.equal(validateRecordInput({ date: '2026-2-1', mood: 1 }).ok, false)
  assert.equal(validateRecordInput({ date, bodyNote: 'x'.repeat(501) }).ok, false)
  assert.deepEqual(validateRecordInput({ date, bodyNote: '  synthetic test note  ' }), {
    ok: true, value: { date, bodyNote: 'synthetic test note' },
  })
})

test('date keys use local calendar fields at midnight and year rollover', () => {
  const { getLocalDateKey, isLocalDateKey } = loadSource('src/utils/date.ts')
  assert.equal(getLocalDateKey(new Date(2026, 10, 19, 0, 1)), date)
  assert.equal(getLocalDateKey(new Date(2027, 0, 1, 0, 1)), '2027-01-01')
  assert.equal(isLocalDateKey('2028-02-29'), true)
  assert.equal(isLocalDateKey('2026-02-29'), false)
})

test('first-time empty storage returns null; save and reload preserve missing fields and zero', async () => {
  const { api, data } = memoryStorage()
  assert.equal(await api.loadDailyRecord(date), null)
  const saved = await api.saveDailyRecord({ date, sleepHours: 0 })
  assert.equal(data.has(key), true)
  assert.equal(JSON.parse(data.get(key)).version, 1)
  assert.deepEqual(await api.loadDailyRecord(date), saved)
  assert.equal(Object.hasOwn(saved, 'mood'), false)
  assert.equal(Object.hasOwn(saved, 'bodyNote'), false)
  assert.equal(saved.sleepHours, 0)
  assert.ok(Number.isFinite(Date.parse(saved.createdAt)))
})

test('resave preserves createdAt, replaces cleared fields and leaves other dates untouched', async () => {
  const { api, data } = memoryStorage()
  const createdAt = '2026-11-19T00:00:00.000Z'
  data.set(key, JSON.stringify({ version: 1, record: { date, mood: 4, createdAt, updatedAt: createdAt } }))
  const yesterday = await api.saveDailyRecord({ date: '2026-11-18', energy: 1 })
  const saved = await api.saveDailyRecord({ date, sleepHours: 7.5 })
  assert.equal(saved.createdAt, createdAt)
  assert.equal(Object.hasOwn(saved, 'mood'), false)
  assert.notEqual(saved.updatedAt, createdAt)
  assert.deepEqual(await api.loadDailyRecord('2026-11-18'), yesterday)
})

test('invalid submissions never write to storage', async () => {
  const { api, state } = memoryStorage()
  await assert.rejects(api.saveDailyRecord({ date }), /至少填写/)
  await assert.rejects(api.saveDailyRecord({ date, sleepHours: 25 }), /0–24/)
  assert.equal(state.writes, 0)
})

test('read failure blocks overwrite and preserves existing bytes', async () => {
  const { api, state, data } = memoryStorage()
  await api.saveDailyRecord({ date, mood: 1 })
  const original = data.get(key)
  state.readFailure = true
  await assert.rejects(api.loadDailyRecord(date), /读取本地记录失败/)
  await assert.rejects(api.saveDailyRecord({ date, energy: 3 }), /读取本地记录失败/)
  assert.equal(data.get(key), original)
  assert.equal(state.writes, 1)
})

test('malformed, incompatible or mismatched stored data blocks overwrite', async () => {
  const { api, data, state } = memoryStorage()
  const timestamp = '2026-11-19T00:00:00.000Z'
  for (const raw of [
    '', '{broken', 'null', JSON.stringify({ version: 2 }),
    JSON.stringify({ version: 1, record: { date: '2026-11-18', mood: 2, createdAt: timestamp, updatedAt: timestamp } }),
    JSON.stringify({ version: 1, record: { date, mood: 6, createdAt: timestamp, updatedAt: timestamp } }),
    JSON.stringify({ version: 1, record: { date, mood: 2, createdAt: 'invalid', updatedAt: timestamp } }),
  ]) {
    data.set(key, raw)
    await assert.rejects(api.loadDailyRecord(date), /格式异常/)
    await assert.rejects(api.saveDailyRecord({ date, stress: 2 }), /格式异常/)
    assert.equal(data.get(key), raw)
  }
  assert.equal(state.writes, 0)
})

test('write failure and synchronous storage access errors surface clear messages', async () => {
  const { api, state, data } = memoryStorage()
  await api.saveDailyRecord({ date, energy: 2 })
  const original = data.get(key)
  state.writeFailure = true
  await assert.rejects(api.saveDailyRecord({ date, stress: 5 }), /保存失败/)
  assert.equal(data.get(key), original)
  state.throwRead = true
  await assert.rejects(api.loadDailyRecord(date), /读取本地记录失败/)
  state.throwRead = false
  state.getFailure = true
  await assert.rejects(api.loadDailyRecord(date), /读取本地记录失败/)
  state.getFailure = false
  state.writeFailure = false
  state.throwWrite = true
  await assert.rejects(api.saveDailyRecord({ date, mood: 3 }), /保存失败/)
  assert.equal(data.get(key), original)
})
