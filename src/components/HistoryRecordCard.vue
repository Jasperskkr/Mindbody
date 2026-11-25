<script setup lang="ts">
import { computed } from 'vue'
import type { DailyRecord } from '../types/health'
import { toDailyOverview } from '../utils/daily-overview'

const props = defineProps<{ record: DailyRecord; expanded: boolean; disabled: boolean }>()
const emit = defineEmits<{ toggle: []; remove: [] }>()
const overview = computed(() => toDailyOverview(props.record))
</script>

<template>
  <view class="history-card">
    <view class="card-heading">
      <text class="record-date" role="heading" aria-level="2">{{ record.date }}</text>
      <button
        class="detail-button" role="button" :aria-expanded="expanded" :disabled="disabled"
        :aria-label="`${expanded ? '收起' : '查看'} ${record.date} 详情`" tabindex="0"
        @click="emit('toggle')" @keyup.enter.stop.prevent="emit('toggle')"
        @keydown.space.prevent @keyup.space.stop.prevent="emit('toggle')"
      >{{ expanded ? '收起详情 ↑' : '查看详情 ↓' }}</button>
    </view>
    <view class="history-metrics">
      <view v-for="metric in overview.metrics" :key="metric.id" class="history-metric">
        <text class="label">{{ metric.label }}</text>
        <text class="value">{{ metric.value }}{{ metric.unit ? ' 小时' : '' }}</text>
      </view>
    </view>
    <text class="note" :class="{ collapsed: !expanded }">身体感受：{{ overview.bodyNote }}</text>
    <view v-if="expanded" class="details">
      <text v-for="metric in overview.metrics" :key="metric.id" class="detail-line">{{ metric.label }}：{{ metric.detail }}</text>
      <text class="timestamp">首次保存：{{ record.createdAt }}</text>
      <text class="timestamp">最近更新：{{ record.updatedAt }}</text>
      <button
        class="delete-button" role="button" :disabled="disabled" tabindex="0"
        :aria-label="`删除 ${record.date} 的记录`"
        @click="emit('remove')" @keyup.enter.stop.prevent="emit('remove')"
        @keydown.space.prevent @keyup.space.stop.prevent="emit('remove')"
      >删除此记录</button>
    </view>
  </view>
</template>

<style scoped>
.history-card { padding: 22px; border: 1px solid #e2e7d9; border-radius: 19px; background: #fffefa; min-width: 0; }
.history-card button { margin: 0; }
.history-card button::after { border: 0; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.record-date { font-size: 17px; font-weight: 600; }
.detail-button { background: transparent; color: #526b48; font-size: 12px; padding: 8px 0; min-height: 44px; cursor: pointer; }
.history-metrics { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin: 16px 0; }
.label, .value, .note, .detail-line, .timestamp { display: block; overflow-wrap: anywhere; }
.label { color: #78816f; font-size: 11px; }
.value { color: #3a553f; font-size: 15px; margin-top: 3px; }
.note { padding: 12px; background: #f4f6ee; border-radius: 10px; color: #65725c; white-space: pre-wrap; font-size: 12px; }
.note.collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.details { border-top: 1px solid #e9ece2; margin-top: 16px; padding-top: 14px; }
.detail-line { color: #68765d; font-size: 12px; margin: 4px 0; }
.timestamp { font-size: 10px; color: #7d8575; margin-top: 8px; }
.delete-button { margin: 16px 0 0; padding: 10px 16px; color: #95553f; background: #f8eee7; border-radius: 10px; font-size: 12px; min-height: 44px; cursor: pointer; }
@media (max-width: 440px) { .history-card { padding: 17px; } .history-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); } }
</style>
