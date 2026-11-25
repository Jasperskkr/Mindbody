import type { DailyRecord, HealthTrends, TrendDays, TrendMetricId, TrendSeries } from '../types/health'
import { getLocalDateKey, isLocalDateKey } from './date'
import { validateDailyRecord } from './record-validation'

const definitions: { id: TrendMetricId; label: string; unit: TrendSeries['unit']; direction: string; min: number; max: number }[] = [
  { id: 'mood', label: '情绪', unit: '分', direction: '1 很低落 → 5 很愉快，越高越愉快', min: 1, max: 5 },
  { id: 'stress', label: '压力', unit: '分', direction: '1 很放松 → 5 很强，越高压力越强', min: 1, max: 5 },
  { id: 'energy', label: '精力', unit: '分', direction: '1 很疲惫 → 5 很充沛，越高越充沛', min: 1, max: 5 },
  { id: 'sleepHours', label: '睡眠时长', unit: '小时', direction: '记录昨晚睡眠时长，0–24 小时', min: 0, max: 24 },
]

/** 纯函数：补齐日历轴上的空位，不补健康数值，也不保存计算结果。 */
export function buildHealthTrends(records: readonly DailyRecord[], days: TrendDays, endDate = getLocalDateKey()): HealthTrends {
  if ((days !== 7 && days !== 30) || !isLocalDateKey(endDate)) throw new Error('趋势日期范围不正确。')
  const byDate = new Map<string, DailyRecord>()
  for (const record of records) {
    const result = validateDailyRecord(record)
    if (!result.ok) throw new Error(`无法计算趋势：${result.message}`)
    if (byDate.has(result.value.date)) throw new Error('无法计算趋势：存在重复日期。')
    byDate.set(result.value.date, result.value)
  }
  const dates = Array.from({ length: days }, (_, index) => {
    // 使用日历运算，跨月/年或夏令时不把“一天”固定成 86400000 毫秒。
    const date = new Date(`${endDate}T12:00:00`)
    date.setDate(date.getDate() - (days - 1 - index))
    return getLocalDateKey(date)
  })
  const series = definitions.map((definition): TrendSeries => {
    const points = dates.map((date) => ({ date, value: byDate.get(date)?.[definition.id] ?? null }))
    const values = points.flatMap((point) => point.value === null ? [] : [point.value])
    return {
      ...definition, points, count: values.length,
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    }
  })
  return { days, startDate: dates[0], endDate, recordCount: dates.filter((date) => byDate.has(date)).length, series }
}
