const { test } = require('node:test')
const assert = require('node:assert/strict')
const { memoryStorage, createRuntime } = require('./helpers.cjs')

const stamp = '2026-11-19T00:00:00.000Z'
const record = (date, fields) => ({ date, ...fields, createdAt: stamp, updatedAt: stamp })
const runtime = createRuntime({})
const { buildDailyContext, contextFacts } = runtime.load('src/utils/daily-context.ts')
const { retrieveCards, localInsight, validateInsight, knowledgeCards } = runtime.load('src/utils/insight.ts')

test('daily context preserves missing versus zero and excludes notes/timestamps/outside records', () => {
  const input = [record('2026-11-19', { sleepHours: 0, bodyNote: 'synthetic private note must not leave browser' }), record('2026-11-01', { mood: 2 })]
  const context = buildDailyContext(input, '2026-11-19')
  assert.equal(context.today.sleepHours, 0)
  assert.equal(context.today.energy, null)
  assert.equal(context.window.metrics.sleepHours.count, 1)
  assert.equal(context.window.metrics.sleepHours.average, 0)
  assert.equal(context.window.metrics.sleepHours.change, null)
  assert.equal(context.samples.length, 1)
  assert.doesNotMatch(JSON.stringify(context), /private note|bodyNote|createdAt|updatedAt/)
  assert.ok(contextFacts(context).every((fact) => fact.includes('不描述变化')))
})

test('empty/today missing/multiple days contexts have precise computed facts and no invented long trend', () => {
  assert.equal(buildDailyContext([], '2026-11-19').today, null)
  const missingToday = buildDailyContext([record('2026-11-18', { energy: 3 })], '2026-11-19')
  assert.equal(missingToday.today, null)
  assert.equal(localInsight(missingToday).status, 'empty')
  const context = buildDailyContext([record('2026-11-19', { sleepHours: 0 }), record('2026-11-17', { sleepHours: 8, energy: 4 })], '2026-11-19')
  assert.deepEqual(context.window.metrics.sleepHours, { count: 2, average: 4, first: 8, last: 0, change: -8 })
  assert.equal(context.window.metrics.energy.count, 1)
  assert.equal(context.window.metrics.energy.change, null)
  assert.match(contextFacts(context)[3], /不是长期趋势/)
})

test('knowledge retrieval respects independent domains, checked status and no-match fallback', () => {
  const context = buildDailyContext([record('2026-11-19', { mood: 4 })], '2026-11-19')
  assert.ok(retrieveCards(context, 'psychology').every((card) => card.domain === 'psychology'))
  assert.ok(retrieveCards(context, 'tcm').every((card) => card.domain === 'tcm'))
  assert.equal(new Set(knowledgeCards.map((card) => card.id)).size, knowledgeCards.length)
  for (const card of knowledgeCards) {
    assert.equal(card.review.status, 'source_checked')
    assert.match(card.source.url, /^https:\/\//)
    assert.ok(card.uncertainty && card.source.locator && card.review.scope)
  }
  assert.deepEqual(retrieveCards(context, 'combined', '', []), [])
  assert.deepEqual(retrieveCards(context, 'combined', '', knowledgeCards.map((card) => ({
    ...card, review: { ...card.review, status: 'draft' },
  }))), [])
  const noteOnly = buildDailyContext([record('2026-11-19', { bodyNote: 'synthetic note only' })], '2026-11-19')
  assert.equal(noteOnly.today.mood, null)
})

test('service response validator rejects nonexistent, wrong-domain, forged text and dangerous reply', () => {
  const context = buildDailyContext([record('2026-11-19', { mood: 4, sleepHours: 0 })], '2026-11-19')
  const candidates = retrieveCards(context, 'combined')
  const good = { ...localInsight(context), status: 'mock', reply: '你愿意描述当时的感受吗？', notice: 'Mock 本机演示' }
  assert.equal(validateInsight(good, context, 'combined', candidates), good)
  for (const alter of [
    (value) => { value.perspectives[0].citationIds = ['FAKE'] },
    (value) => { value.perspectives[0].text = '未经审核的新解释' },
    (value) => { value.perspectives[0].citationIds = [candidates.find((card) => card.domain === 'tcm').id] },
    (value) => { value.reply = '你诊断为抑郁症' },
    (value) => { value.reply = '你这周的分数是5' },
  ]) {
    const forged = structuredClone(good); alter(forged)
    assert.throws(() => validateInsight(forged, context, 'combined', candidates))
  }
})

test('without consent API makes zero requests; granted request sends only minimal context', async () => {
  let calls = 0, sent
  const context = buildDailyContext([record('2026-11-19', { mood: 4, bodyNote: 'synthetic hidden note' })], '2026-11-19')
  const api = createRuntime({ request(options) { calls++; sent = options.data; options.success({ statusCode: 200, data: { ...localInsight(context), status: 'mock', reply: '如果愿意，可以继续描述此刻最想被理解的感受；也可以停在这里。', notice: 'Mock' } }) } }).load('src/services/insight-api.ts')
  const input = { context, mode: 'combined', serviceMode: 'mock', question: '', consent: { granted: false, scope: 'daily-summary-and-question-v1' } }
  await assert.rejects(api.requestInsight(input), /尚未授权/)
  assert.equal(calls, 0)
  input.consent = { granted: true, scope: 'daily-summary-and-question-v1', providerHost: null, model: null }
  await api.requestInsight(input)
  assert.equal(calls, 1)
  assert.doesNotMatch(JSON.stringify(sent), /hidden note|bodyNote|createdAt/)
})

test('page complete mock flow requires fresh explicit consent, switches domains, and selects only one action', async () => {
  const memory = memoryStorage()
  let infoCalls = 0, postCalls = 0
  const overrides = { 'src/services/insight-api.ts': {
    INSIGHT_API_ORIGIN: 'http://127.0.0.1:8000', consentPreview: JSON.stringify,
    async loadServiceInfo() { infoCalls++; return { schemaVersion: 1, llmEnabled: false, providerHost: null, model: null } },
    async requestInsight(input) { postCalls++; return { ...localInsight(input.context), status: 'mock', reply: '虚构测试回应', notice: 'Mock' } },
  } }
  const run = createRuntime(memory.uni, overrides)
  const storage = run.load('src/storage/daily-records.ts')
  const { getLocalDateKey } = run.load('src/utils/date.ts')
  const page = run.page('src/pages/insight/index.vue')
  await page.show()
  assert.equal(page.state.context.value.today, null)
  await page.state.prepareRequest()
  assert.equal(infoCalls, 0)
  await storage.saveDailyRecord({ date: getLocalDateKey(), mood: 4, sleepHours: 0 })
  await page.show()
  assert.equal(page.state.insight.value.status, 'local_preview')
  assert.equal(postCalls, 0)
  await page.state.prepareRequest()
  assert.equal(infoCalls, 1)
  assert.equal(postCalls, 0)
  page.state.cancelConsent()
  await page.state.authorizeAndSend()
  assert.equal(postCalls, 0)
  page.state.question.value = 'synthetic follow-up'
  await page.state.prepareRequest()
  await page.state.authorizeAndSend()
  assert.equal(postCalls, 1)
  assert.equal(page.state.conversation.value.messages.length, 2)
  assert.equal(page.state.consentRequest.value, null)
  page.state.selectMode('tcm')
  assert.equal(page.state.conversation.value.messages.length, 0)
  page.state.selectAction('notice'); page.state.selectAction('pause')
  assert.equal(page.state.selectedAction.value, 'pause')
  page.state.selectAction('pause')
  assert.equal(page.state.selectedAction.value, '')
  await page.state.prepareRequest()
  page.hide()
  assert.equal(page.state.consentRequest.value, null)
  assert.equal((await storage.listDailyRecords()).length, 1)
})

test('insight page distinguishes storage failure and service failure and preserves local preview', async () => {
  const memory = memoryStorage()
  const run = createRuntime(memory.uni, { 'src/services/insight-api.ts': {
    consentPreview: JSON.stringify,
    async loadServiceInfo() { throw new Error('synthetic offline') },
  } })
  const page = run.page('src/pages/insight/index.vue')
  memory.state.readFailure = true
  await page.show()
  assert.ok(page.state.error.value)
  assert.equal(page.state.context.value, null)
  memory.state.readFailure = false
  await run.load('src/storage/daily-records.ts').saveDailyRecord({
    date: run.load('src/utils/date.ts').getLocalDateKey(), sleepHours: 0,
  })
  await page.show()
  assert.equal(page.state.error.value, '')
  await page.state.prepareRequest()
  assert.match(page.state.feedback.value, /synthetic offline/)
  assert.equal(page.state.insight.value.status, 'local_preview')
  assert.equal(page.state.consentRequest.value, null)
})

test('leaving page invalidates an outstanding authorized response', async () => {
  const memory = memoryStorage()
  let finish
  const run = createRuntime(memory.uni, { 'src/services/insight-api.ts': {
    consentPreview: JSON.stringify,
    async loadServiceInfo() { return { llmEnabled: false } },
    requestInsight() { return new Promise((resolve) => { finish = resolve }) },
  } })
  await run.load('src/storage/daily-records.ts').saveDailyRecord({
    date: run.load('src/utils/date.ts').getLocalDateKey(), mood: 4,
  })
  const page = run.page('src/pages/insight/index.vue')
  await page.show()
  await page.state.prepareRequest()
  const pending = page.state.authorizeAndSend()
  page.hide()
  await page.show()
  finish({ ...localInsight(page.state.context.value), status: 'mock' })
  await pending
  assert.equal(page.state.insight.value.status, 'local_preview')
  assert.equal(page.state.conversation.value.messages.length, 0)
  assert.equal(page.state.sending.value, false)
})
