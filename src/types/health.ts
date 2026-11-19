/** 第一阶段仅描述展示用的模拟数据，不代表医学评估。 */
export interface OverviewMetric {
  id: 'mood' | 'sleep' | 'energy' | 'stress'
  label: string
  value: string
  detail: string
  symbol: string
  tone: 'sage' | 'lavender' | 'sand' | 'peach'
}

export interface DailyOverview {
  metrics: OverviewMetric[]
  bodyNote: string
}
