const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createRuntime, memoryStorage } = require('./helpers.cjs')
const run = createRuntime({})
const { knowledgeCards, knowledgeHash, retrieveCards, validateInsight, localInsight } = run.load('src/utils/insight.ts')
const { buildDailyContext } = run.load('src/utils/daily-context.ts')
const context = buildDailyContext([{ date:'2026-11-19', mood:4, createdAt:'2026-11-19T00:00:00Z', updatedAt:'2026-11-19T00:00:00Z' }], '2026-11-19')

test('per-domain Top-K retains TCM despite many psychology cards and excludes lifecycle/review failures', () => {
  const psy = knowledgeCards.find(card => card.domain === 'psychology')
  const corpus = [...knowledgeCards, ...Array.from({length:30}, (_,i)=>({...psy,id:`PSY-TEST-${i}`,keywords:['测试']})),
    {...psy,id:'PSY-ARCHIVED',lifecycle:'archived'}, {...psy,id:'PSY-REJECTED',review:{...psy.review,status:'rejected'}}]
  const result = retrieveCards(context,'combined','测试',corpus,{psychology:3,tcm:1})
  assert.equal(result.filter(card=>card.domain==='psychology').length,3)
  assert.equal(result.filter(card=>card.domain==='tcm').length,1)
  assert.ok(result.every(card=>!['PSY-ARCHIVED','PSY-REJECTED'].includes(card.id)))
  assert.deepEqual(retrieveCards(context,'combined','',[]),[])
  assert.throws(()=>retrieveCards(context,'combined','',corpus,{psychology:0,tcm:1}))
})

test('mismatched service knowledge hash prevents health POST before explicit consent', async () => {
  let posts = 0,gets = 0
  const info = {schemaVersion:1,defaultMode:'mock',llmEnabled:false,providerHost:null,model:null,storesHealthData:false,knowledgeHash:'0'.repeat(64)}
  const runtime = createRuntime({request(options) { options.method==='POST'?posts++:gets++; options.success({statusCode:200,data:info}) }})
  await assert.rejects(runtime.load('src/services/insight-api.ts').loadServiceInfo(),/知识库版本不一致/)
  assert.equal(gets,1)
  assert.equal(posts,0)
  const response = {...localInsight(context),status:'mock',knowledgeHash:'0'.repeat(64),reply:'固定测试回复'}
  assert.throws(()=>validateInsight(response,context,'combined',retrieveCards(context,'combined')),/版本不一致/)
})

test('knowledge version and authorization snapshot travel with existing insight payload without new health fields', async () => {
  let sent
  const input = {context,mode:'combined',serviceMode:'mock',question:'',consent:{granted:true,scope:'daily-summary-and-question-v1',providerHost:null,model:null}}
  const runtime = createRuntime({request(options){sent=options.data;options.success({statusCode:200,data:{...localInsight(context),status:'mock',reply:'固定测试回复'}})}})
  await runtime.load('src/services/insight-api.ts').requestInsight(input)
  assert.equal(sent.knowledgeHash,knowledgeHash)
  assert.equal(sent.context,context)
  assert.ok(knowledgeCards.every(card=>card.sourceId&&card.professionalReview.status==='not_reviewed'))
})
