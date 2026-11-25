<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TrendPoint, TrendSeries } from '../types/health'
const props = defineProps<{ series: TrendSeries }>()
const expanded = ref(false)
const summary = computed(() => `${props.series.label}，${props.series.direction}，${props.series.points.length} 天中填写 ${props.series.count} 天。`)
function barHeight(point: TrendPoint) {
  return `${point.value === null ? 0 : (point.value - props.series.min) / (props.series.max - props.series.min) * 100}%`
}
function showDate(index: number) {
  const last = props.series.points.length - 1
  return index === 0 || index === Math.floor(last / 2) || index === last
}
function toggleValues() { expanded.value = !expanded.value }
</script>

<template>
  <view class="trend-card">
    <view class="heading"><text class="title" role="heading" aria-level="2">{{ series.label }}</text><text class="unit">{{ series.unit }}</text></view>
    <text class="direction">{{ series.direction }}</text>
    <view class="summary"><text>已填 {{ series.count }} / {{ series.points.length }} 天</text><text>已填天平均：{{ series.average === null ? '无数据' : `${series.average.toFixed(1)} ${series.unit}` }}</text></view>
    <view class="chart" role="img" :aria-label="summary">
      <view class="axis" aria-hidden="true"><text>{{ series.max }}</text><text>{{ series.min }}</text></view>
      <view class="plot" aria-hidden="true">
        <view v-for="(point, index) in series.points" :key="point.date" class="column">
          <view v-if="point.value !== null" class="bar" :class="{ floor: point.value === series.min }" :style="{ height: barHeight(point) }" />
          <view v-else class="missing-mark" />
          <text v-if="showDate(index)" class="date-label" :class="{ first: index === 0, last: index === series.points.length - 1 }">{{ point.date.slice(5) }}</text>
        </view>
      </view>
    </view>
    <text class="legend">绿色为已填数值（底部圆点为 {{ series.min }}）；灰色短线为无数据。</text>
    <text v-if="!series.count" class="insufficient">这段时间尚未填写此项，暂时没有趋势数据。</text>
    <text v-else-if="series.count === 1" class="insufficient">仅有 1 天填写，暂不足以观察变化。</text>
    <button class="values-button" role="button" tabindex="0" :aria-expanded="expanded" :aria-label="`${expanded ? '收起' : '查看'}${series.label}逐日数值`" @click="toggleValues" @keyup.enter.stop.prevent="toggleValues" @keydown.space.prevent @keyup.space.stop.prevent="toggleValues">{{ expanded ? '收起逐日数值 ↑' : '查看逐日数值 ↓' }}</button>
    <view v-if="expanded" class="values" role="table" :aria-label="`${series.label}逐日数值`">
      <view class="value-row" role="row"><text role="columnheader">日期</text><text role="columnheader">{{ series.label }}（{{ series.unit }}）</text></view>
      <view v-for="point in series.points" :key="point.date" class="value-row" role="row"><text role="cell">{{ point.date }}</text><text role="cell">{{ point.value === null ? '未填写' : `${point.value} ${series.unit}` }}</text></view>
    </view>
  </view>
</template>

<style scoped>
.trend-card { padding: 22px; border: 1px solid #e0e6d6; border-radius: 19px; background: #fffefa; min-width: 0; }
.trend-card button { margin: 8px 0 0; }
.trend-card button::after { border: 0; }
.heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.title { font-size: 18px; font-weight: 600; color: #3e593e; }
.unit { color: #7b866f; font-size: 11px; }
.direction, .legend, .insufficient { display: block; color: #79826f; font-size: 11px; margin-top: 8px; }
.summary { display: flex; gap: 8px; justify-content: space-between; flex-wrap: wrap; color: #5f7256; font-size: 11px; margin-top: 18px; }
.chart { display: flex; gap: 10px; height: 155px; margin: 20px 0 28px; }
.axis { display: flex; flex-direction: column; justify-content: space-between; color: #8a927e; font-size: 10px; width: 18px; flex-shrink: 0; }
.plot { display: flex; gap: 3px; flex: 1; min-width: 0; border-bottom: 1px solid #ccd5c0; background: repeating-linear-gradient(to top,transparent 0,transparent calc(50% - 1px),#e8eddf calc(50% - 1px),#e8eddf 50%); }
.column { flex: 1; position: relative; min-width: 0; }
.bar { position: absolute; bottom: 0; width: 100%; max-width: 20px; left: 50%; transform: translateX(-50%); background: #9db48a; border-radius: 4px 4px 0 0; min-height: 3px; }
.bar.floor { width: 6px; height: 6px !important; border-radius: 50%; background: #55784a; }
.missing-mark { position: absolute; width: 4px; height: 2px; bottom: 0; left: 50%; transform: translateX(-50%); background: #b9bfaf; }
.date-label { position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 10px; color: #8b937e; }
.date-label.first { left: 0; transform: none; }
.date-label.last { left: auto; right: 0; transform: none; }
.legend { font-size: 10px; }
.insufficient { padding: 10px; border-radius: 8px; background: #f1f4e9; }
.values-button { background: transparent; padding: 11px 0; min-height: 44px; color: #566f49; font-size: 12px; cursor: pointer; margin-top: 8px; }
.values { border-top: 1px solid #e5eadc; font-size: 11px; color: #6e7c61; }
.value-row { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid #eff2e9; padding: 7px 0; overflow-wrap: anywhere; }
@media (max-width: 360px) { .trend-card { padding: 17px; } .plot { gap: 2px; } }
</style>
