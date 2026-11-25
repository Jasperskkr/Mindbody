const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createRuntime } = require('../../tests/helpers.cjs')
const { retrieveCards } = createRuntime({}).load('src/utils/insight.ts')
const cases = JSON.parse(fs.readFileSync(0, 'utf8'))
for (const item of cases) {
  assert.deepEqual(retrieveCards(item.context, item.mode, item.question, item.cards, item.topK).map(card => card.id), item.expected)
}
process.stdout.write(`${cases.length} ranking cases verified`)
