const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vue = require('vue')
const { parse, compileScript } = require('vue/compiler-sfc')

// 运行真实首页 setup，只替换本地存储和生命周期，不访问浏览器健康记录。
function createHome(storage) {
  let show
  function evaluate(source, base) {
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    const module = { exports: {} }
    const localRequire = (specifier) => {
      if (specifier === 'vue') return vue
      if (specifier === '@dcloudio/uni-app') return { onShow(handler) { show = handler } }
      if (specifier.endsWith('/storage/daily-records')) return storage
      const file = path.resolve(base, `${specifier}.ts`)
      return evaluate(fs.readFileSync(file, 'utf8'), path.dirname(file))
    }
    new Function('require', 'module', 'exports', 'uni', outputText)(localRequire, module, module.exports, {})
    return module.exports
  }
  const filename = path.resolve(__dirname, '../src/pages/index/index.vue')
  const descriptor = parse(fs.readFileSync(filename, 'utf8'), { filename }).descriptor
  const script = compileScript(descriptor, { id: 'home-page-test' }).content
  const component = evaluate(script, path.dirname(filename)).default
  const page = component.setup({}, { expose() {} })
  const { toDailyOverview } = evaluate(
    fs.readFileSync(path.resolve(__dirname, '../src/utils/daily-overview.ts'), 'utf8'),
    path.resolve(__dirname, '../src/utils'),
  )
  return { page, show: () => show(), toDailyOverview }
}

const stamp = '2026-11-19T00:00:00.000Z'
const syntheticRecord = (fields = {}) => ({ date: '2026-11-19', ...fields, createdAt: stamp, updatedAt: stamp })

test('empty overview has no default scores or sleep unit', () => {
  const { toDailyOverview } = createHome({})
  const overview = toDailyOverview(null)
  assert.equal(overview.metrics.length, 4)
  assert.ok(overview.metrics.every((metric) => metric.value === '未填写'))
  assert.equal(overview.metrics.find((metric) => metric.id === 'sleep').unit, undefined)
  assert.equal(overview.bodyNote, '未填写')
})

test('overview preserves zero and missing fields, shares scale direction, and does not mutate input', () => {
  const { toDailyOverview } = createHome({})
  const input = Object.freeze(syntheticRecord({ mood: 1, stress: 5, sleepHours: 0 }))
  const overview = toDailyOverview(input)
  assert.deepEqual(overview.metrics.map((metric) => metric.value), ['很低落', '0', '未填写', '很强'])
  assert.equal(overview.metrics[1].unit, 'h')
  assert.match(overview.metrics[0].detail, /1 \/ 5 · 越高越愉快/)
  assert.match(overview.metrics[3].detail, /5 \/ 5 · 越高压力越强/)
  assert.equal(overview.bodyNote, '未填写')
  assert.equal(Object.hasOwn(input, 'energy'), false)
  const complete = toDailyOverview(syntheticRecord({ mood: 5, energy: 1, stress: 1, bodyNote: 'synthetic note only' }))
  assert.deepEqual(complete.metrics.map((metric) => metric.value), ['很愉快', '未填写', '很疲惫', '很放松'])
  assert.equal(complete.bodyNote, 'synthetic note only')
})

test('onShow loads only local today and reloads the saved record when returning', async () => {
  const date = new Date()
  const todayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  let saved = null
  const calls = []
  const { page, show } = createHome({
    async loadDailyRecord(key) { calls.push(key); return saved },
  })
  show()
  assert.equal(page.loading.value, true)
  await Promise.resolve()
  assert.equal(page.overviewStatus.value, '尚未记录')
  saved = syntheticRecord({ date: todayKey, mood: 4, sleepHours: 7.5 })
  show()
  await Promise.resolve()
  assert.deepEqual(calls, [todayKey, todayKey])
  assert.equal(page.overviewStatus.value, '今日记录')
  assert.equal(page.overview.value.metrics[0].value, '较愉快')
  assert.equal(page.overview.value.metrics[1].value, '7.5')
  assert.equal(page.overview.value.metrics[2].value, '未填写')
})

test('read failure clears stale content, remains distinct from empty storage, and supports retry', async () => {
  let failRead = false
  const { page } = createHome({
    async loadDailyRecord() {
      if (failRead) throw new Error('虚构读取失败：请重试')
      return syntheticRecord({ energy: 5 })
    },
  })
  await page.refreshOverview()
  assert.equal(page.record.value.energy, 5)
  failRead = true
  await page.refreshOverview()
  assert.equal(page.overviewStatus.value, '读取失败')
  assert.match(page.readError.value, /读取失败/)
  assert.equal(page.record.value, null)
  assert.equal(page.loading.value, false)
  failRead = false
  await page.refreshOverview()
  assert.equal(page.overviewStatus.value, '今日记录')
  assert.equal(page.readError.value, '')
})

test('an older pending read cannot overwrite a newer result or its loading state', async () => {
  const pending = []
  const { page } = createHome({
    loadDailyRecord() { return new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  })
  const old = page.refreshOverview()
  const newer = page.refreshOverview()
  pending[0].resolve(syntheticRecord({ mood: 1 }))
  await old
  assert.equal(page.loading.value, true)
  assert.equal(page.record.value, null)
  pending[1].resolve(syntheticRecord({ mood: 5 }))
  await newer
  assert.equal(page.overview.value.metrics[0].value, '很愉快')
  assert.equal(page.loading.value, false)
  const obsolete = page.refreshOverview()
  const latest = page.refreshOverview()
  pending[3].resolve(syntheticRecord({ energy: 4 }))
  await latest
  pending[2].reject(new Error('obsolete synthetic failure'))
  await obsolete
  assert.equal(page.record.value.energy, 4)
  assert.equal(page.readError.value, '')
  assert.equal(page.overviewStatus.value, '今日记录')
})
