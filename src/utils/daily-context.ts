import type { DailyRecord, TrendMetricId } from '../types/health'
import type { DailyContext, InsightMetrics, MetricSummary } from '../types/insight'
import { buildHealthTrends } from './trend-analysis'
import { getLocalDateKey } from './date'

export const metricIds: TrendMetricId[] = ['mood', 'stress', 'energy', 'sleepHours']
export const metricNames = { mood: '情绪', stress: '压力', energy: '精力', sleepHours: '睡眠' }

export function buildDailyContext(records: readonly DailyRecord[], date = getLocalDateKey()): DailyContext {
  const trends = buildHealthTrends(records, 7, date) // 复用已有校验与日历窗口。
  const values = (record: DailyRecord): InsightMetrics => ({
    mood: record.mood ?? null, stress: record.stress ?? null,
    energy: record.energy ?? null, sleepHours: record.sleepHours ?? null,
  })
  const today = records.find((record) => record.date === date)
  const metrics = Object.fromEntries(trends.series.map((series) => {
    const filled = series.points.flatMap((point) => point.value === null ? [] : [point.value])
    const first = filled[0] ?? null
    const last = filled.at(-1) ?? null
    return [series.id, {
      count: series.count, average: series.average, first, last,
      change: filled.length < 2 ? null : last! - first!,
    } satisfies MetricSummary]
  })) as Record<TrendMetricId, MetricSummary>
  return {
    schemaVersion: 1, date, today: today ? values(today) : null,
    samples: records.filter((record) => record.date >= trends.startDate && record.date <= date)
      .map((record) => ({ date: record.date, values: values(record) })).sort((a, b) => a.date.localeCompare(b.date)),
    window: { startDate: trends.startDate, endDate: date, days: 7, recordCount: trends.recordCount, metrics },
  }
}

export function contextFacts(context: DailyContext): string[] {
  if (!context.today) return ['今天还没有记录，暂不生成今日洞察。']
  return metricIds.map((id) => {
    const value = context.today![id]
    const unit = id === 'sleepHours' ? '小时' : '分（1–5）'
    const summary = context.window.metrics[id]
    const history = summary.count < 2 ? '填写不足两天，不描述变化。'
      : `近7天填写${summary.count}天，平均${summary.average!.toFixed(1)}，首末差${summary.change! > 0 ? '+' : ''}${summary.change!.toFixed(1)}；不是长期趋势，也不能说明原因。`
    return `${metricNames[id]}：${value === null ? '未填写' : `${value} ${unit}`}。${history}`
  })
}
