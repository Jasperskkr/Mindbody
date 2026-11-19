const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vue = require('vue')
const { parse, compileScript } = require('vue/compiler-sfc')

// 编译真实页面的 setup 代码，替换存储与路由，检查页面如何处理失败。
function createPage(storage) {
  const filename = path.resolve(__dirname, '../src/pages/record/index.vue')
  const descriptor = parse(fs.readFileSync(filename, 'utf8'), { filename }).descriptor
  const script = compileScript(descriptor, { id: 'record-page-test' }).content
  function evaluate(source, base) {
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    const module = { exports: {} }
    const localRequire = (specifier) => {
      if (specifier === 'vue') return vue
      if (specifier === '@dcloudio/uni-app') return { onLoad() {} }
      if (specifier.endsWith('.vue')) return {}
      if (specifier.endsWith('/storage/daily-records')) return storage
      const file = path.resolve(base, `${specifier}.ts`)
      return evaluate(fs.readFileSync(file, 'utf8'), path.dirname(file))
    }
    new Function('require', 'module', 'exports', 'uni', outputText)(localRequire, module, module.exports, {})
    return module.exports
  }
  const component = evaluate(script, path.dirname(filename)).default
  return component.setup({}, { expose() {} })
}

test('page blocks saving on initial read failure and can retry safely', async () => {
  let failRead = true
  let writes = 0
  const page = createPage({
    async loadDailyRecord() {
      if (failRead) throw new Error('虚构读取失败：请重试')
      return null
    },
    async saveDailyRecord() { writes += 1 },
  })
  await page.readRecord()
  assert.match(page.readError.value, /读取失败/)
  assert.equal(page.busy.value, true)
  await page.saveRecord()
  assert.equal(writes, 0)
  failRead = false
  await page.readRecord()
  assert.equal(page.readError.value, '')
  assert.equal(page.busy.value, false)
})

test('page keeps entered values and shows write failure rather than success', async () => {
  const page = createPage({
    async loadDailyRecord() { return null },
    async saveDailyRecord() { throw new Error('虚构保存失败：空间不足') },
  })
  await page.readRecord()
  page.form.sleepHours = '7.5'
  page.form.bodyNote = 'synthetic page test only'
  await vue.nextTick()
  await page.saveRecord()
  assert.match(page.feedback.value, /保存失败/)
  assert.equal(page.feedbackKind.value, 'error')
  assert.equal(page.form.sleepHours, '7.5')
  assert.equal(page.form.bodyNote, 'synthetic page test only')
  assert.equal(page.saving.value, false)
  assert.equal(page.savedRecord.value, null)
})

test('page distinguishes successful save, unsaved changes, and invalid empty submission', async () => {
  let writes = 0
  const page = createPage({
    async loadDailyRecord() { return null },
    async saveDailyRecord(input) {
      writes += 1
      return { ...input, createdAt: '2026-11-19T00:00:00.000Z', updatedAt: '2026-11-19T00:00:00.000Z' }
    },
  })
  await page.readRecord()
  await page.saveRecord()
  assert.match(page.feedback.value, /至少填写/)
  assert.equal(writes, 0)
  page.form.sleepHours = '0'
  await vue.nextTick()
  await page.saveRecord()
  assert.equal(page.savedRecord.value.sleepHours, 0)
  assert.equal(page.feedbackKind.value, 'success')
  assert.match(page.feedback.value, /已保存/)
  page.form.sleepHours = '8'
  await vue.nextTick()
  assert.equal(page.feedback.value, '')
  page.date.value = '2000-01-01'
  await page.saveRecord()
  assert.match(page.feedback.value, /日期已变化/)
  assert.equal(writes, 1)
})
