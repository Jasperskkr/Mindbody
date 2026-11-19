import { scaleLabels } from '../data/scales'
import type { DailyOverview, DailyRecord, OverviewMetric } from '../types/health'

/** 只把已读取的记录转换成展示文字，不保存数据，不推断健康结论。 */
export function toDailyOverview(record: DailyRecord | null): DailyOverview {
  const scaleMetric = (
    id: 'mood' | 'energy' | 'stress',
    label: string,
    symbol: string,
    tone: OverviewMetric['tone'],
    direction: string,
  ): OverviewMetric => {
    const score = record?.[id]
    return {
      id, label, symbol, tone,
      value: score === undefined ? '未填写' : scaleLabels[id][score - 1],
      detail: score === undefined ? '可在每日记录中补充' : `${score} / 5 · ${direction}`,
    }
  }

  const hours = record?.sleepHours
  return {
    metrics: [
      scaleMetric('mood', '情绪', '◡', 'sage', '越高越愉快'),
      {
        id: 'sleep', label: '睡眠', symbol: '☾', tone: 'lavender',
        value: hours === undefined ? '未填写' : String(hours),
        unit: hours === undefined ? undefined : 'h',
        detail: hours === undefined ? '可在每日记录中补充' : '小时 · 昨晚睡眠',
      },
      scaleMetric('energy', '精力', '☀', 'sand', '越高越充沛'),
      scaleMetric('stress', '压力', '≈', 'peach', '越高压力越强'),
    ],
    bodyNote: record?.bodyNote ?? '未填写',
  }
}
