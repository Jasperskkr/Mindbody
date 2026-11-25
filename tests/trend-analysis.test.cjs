const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createRuntime } = require('./helpers.cjs')
const { buildHealthTrends } = createRuntime({}).load('src/utils/trend-analysis.ts')
const stamp = '2026-11-19T00:00:00.000Z'
const record = (date, fields = {}) => Object.freeze({ date, ...fields, createdAt: stamp, updatedAt: stamp })

test('empty and one-day trends keep missing values null and do not invent scores', () => {
  const empty = buildHealthTrends([], 7, '2027-01-02')
  assert.equal(empty.startDate, '2026-12-27')
  assert.equal(empty.recordCount, 0)
  for (const series of empty.series) {
    assert.equal(series.count, 0)
    assert.equal(series.average, null)
    assert.ok(series.points.every((point) => point.value === null))
  }
  const single = buildHealthTrends([record('2027-01-02', { sleepHours: 0 })], 7, '2027-01-02')
  assert.equal(single.recordCount, 1)
  assert.equal(single.series[0].count, 0)
  assert.equal(single.series[3].count, 1)
  assert.equal(single.series[3].average, 0)
  assert.equal(single.series[3].points.at(-1).value, 0)
})

test('7/30-day windows use calendar days, exclude future/outside days, and count each metric separately', () => {
  const records = Object.freeze([
    record('2026-12-03', { mood: 5 }), // 30 天之前
    record('2026-12-04', { mood: 1 }), // 30 天第一天
    record('2026-12-27', { mood: 2, stress: 5, sleepHours: 0 }),
    record('2026-12-29', { energy: 1, sleepHours: 8 }),
    record('2027-01-02', { mood: 4, stress: 1 }),
    record('2027-01-03', { mood: 5 }), // 未来
  ])
  const week = buildHealthTrends(records, 7, '2027-01-02')
  assert.equal(week.recordCount, 3)
  assert.equal(week.series[0].average, 3)
  assert.equal(week.series[0].count, 2)
  assert.equal(week.series[1].average, 3)
  assert.equal(week.series[2].count, 1)
  assert.equal(week.series[3].average, 4)
  assert.equal(week.series[3].points[1].value, null)
  assert.deepEqual(week.series[0].points.map((point) => point.date), ['2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02'])
  const month = buildHealthTrends(records, 30, '2027-01-02')
  assert.equal(month.startDate, '2026-12-04')
  assert.equal(month.recordCount, 4)
  assert.equal(month.series[0].average, 7 / 3)
  assert.equal(month.series[0].points.length, 30)
  assert.match(month.series[1].direction, /越高压力越强/)
})

test('leap month, month rollover and invalid input are handled explicitly', () => {
  assert.equal(buildHealthTrends([], 7, '2028-03-03').startDate, '2028-02-26')
  assert.throws(() => buildHealthTrends([], 8, '2026-11-19'), /范围/)
  assert.throws(() => buildHealthTrends([], 7, '2026-02-30'), /范围/)
  assert.throws(() => buildHealthTrends([record('2026-11-19', { mood: 8 })], 7), /无法计算/)
  assert.throws(() => buildHealthTrends([record('2026-11-19', { mood: 4 }), record('2026-11-19', { energy: 4 })], 7), /重复/)
})
