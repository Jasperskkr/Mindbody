// 跨语言契约测试：只有虚构数据，不读取浏览器或真实记录。
const fs = require('node:fs')
const assert = require('node:assert/strict')
const { createRuntime } = require('../../tests/helpers.cjs')
const runtime = createRuntime({})
const { buildDailyContext } = runtime.load('src/utils/daily-context.ts')
const { retrieveCards, validateInsight } = runtime.load('src/utils/insight.ts')
const stamp = '2027-01-02T00:00:00.000Z'
const record = (date, fields) => ({ date, ...fields, createdAt: stamp, updatedAt: stamp })
if (process.argv[2] === 'build') {
  const cases = [[], [record('2027-01-02', { sleepHours: 0 })], [
    record('2026-12-31', { mood: 2, sleepHours: 7.5 }),
    record('2027-01-01', { mood: 4, bodyNote: 'synthetic note excluded' }),
    record('2027-01-02', { mood: 3, sleepHours: 0 }),
  ]]
  process.stdout.write(JSON.stringify(cases.map((records) => ({
    context: buildDailyContext(records, '2027-01-02'), mode: 'combined', serviceMode: 'mock', question: '',
    consent: { granted: true, scope: 'daily-summary-and-question-v1', providerHost: null, model: null },
  }))))
} else {
  const pairs = JSON.parse(fs.readFileSync(0, 'utf8'))
  for (const { request, response } of pairs) {
    assert.equal(validateInsight(response, request.context, request.mode,
      retrieveCards(request.context, request.mode, request.question)), response)
  }
  process.stdout.write('contract verified')
}
