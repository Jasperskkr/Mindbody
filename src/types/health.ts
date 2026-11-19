/** 概览的展示结构，与原始记录分开，不代表医学评估。 */
export interface OverviewMetric {
  id: 'mood' | 'sleep' | 'energy' | 'stress'
  label: string
  value: string
  unit?: 'h'
  detail: string
  symbol: string
  tone: 'sage' | 'lavender' | 'sand' | 'peach'
}

export interface DailyOverview {
  metrics: OverviewMetric[]
  bodyNote: string
}

export type ScaleValue = 1 | 2 | 3 | 4 | 5

/** 没填的字段保持 undefined；0 小时睡眠是有效记录。 */
export interface DailyRecordInput {
  date: string // 设备本地日期，YYYY-MM-DD
  mood?: ScaleValue // 1 很低落 → 5 很愉快
  stress?: ScaleValue // 1 很放松 → 5 压力很强
  energy?: ScaleValue // 1 很疲惫 → 5 很充沛
  sleepHours?: number // 0–24 小时，允许小数
  bodyNote?: string
}

export interface DailyRecord extends DailyRecordInput {
  createdAt: string // 首次保存时的 ISO 时间
  updatedAt: string // 最近保存时的 ISO 时间
}

/** 输入框先保留字符串，以区分“空白”和数字 0。 */
export interface DailyRecordForm {
  mood?: ScaleValue
  stress?: ScaleValue
  energy?: ScaleValue
  sleepHours: string
  bodyNote: string
}
