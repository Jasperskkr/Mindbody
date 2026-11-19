import type { DailyOverview } from '../types/health'

// 全部为虚构示例。请勿用真实健康记录替换后提交到 Git。
export const mockOverview: DailyOverview = {
  metrics: [
    { id: 'mood', label: '情绪', value: '平静', detail: '给感受留一点空间', symbol: '◡', tone: 'sage' },
    { id: 'sleep', label: '睡眠', value: '7.5', detail: '小时 · 昨晚睡眠', symbol: '☾', tone: 'lavender' },
    { id: 'energy', label: '精力', value: '还不错', detail: '按照自己的节奏', symbol: '☀', tone: 'sand' },
    { id: 'stress', label: '压力', value: '轻微', detail: '此刻的主观感受', symbol: '≈', tone: 'peach' },
  ],
  bodyNote: '肩颈有一点紧绷',
}
