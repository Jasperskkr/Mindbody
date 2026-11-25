<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import HistoryRecordCard from '../../components/HistoryRecordCard.vue'
import ConfirmAction from '../../components/ConfirmAction.vue'
import HealthTrendChart from '../../components/HealthTrendChart.vue'
import type { DailyRecord, TrendDays } from '../../types/health'
import { deleteAllDailyRecords, deleteDailyRecord, listDailyRecords } from '../../storage/daily-records'
import { serializeRecordExport } from '../../utils/record-export'
import { downloadJsonFile } from '../../platform/export-json'
import { getLocalDateKey } from '../../utils/date'
import { buildHealthTrends } from '../../utils/trend-analysis'

const records = ref<DailyRecord[]>([])
const loading = ref(true)
const readError = ref('')
const expandedDate = ref('')
const activeTab = ref<'records' | 'trends'>('records')
const selectedDays = ref<TrendDays>(7)
const trendEndDate = ref(getLocalDateKey())
const trends = computed(() => buildHealthTrends(records.value, selectedDays.value, trendEndDate.value))
const exporting = ref(false)
const mutating = ref(false)
const feedback = ref('')
const feedbackKind = ref<'success' | 'error'>('success')
type Deletion = { kind: 'single'; date: string } | { kind: 'all'; stage: 1 | 2 }
const pendingDeletion = ref<Deletion | null>(null)
const busy = computed(() => loading.value || exporting.value || mutating.value)
const confirmation = computed(() => {
  const pending = pendingDeletion.value
  if (pending?.kind === 'single') return { title: '删除这一天的记录？', message: `将删除 ${pending.date} 的记录，删除后无法恢复。其他日期不受影响。`, label: '确认删除', key: pending.date }
  if (pending?.kind === 'all' && pending.stage === 2) return { title: '最后确认：不可恢复', message: '确定永久清空 MindBody 的全部本地记录吗？请先确认已保存需要的 JSON 备份。此操作不可恢复。', label: '永久清空', key: 'all-2' }
  return { title: '清空全部记录？', message: '这将删除 MindBody 的全部本地记录，不影响其他应用。下一步还需再次确认。', label: '继续确认', key: 'all-1' }
})
let requestId = 0

async function refreshRecords(): Promise<boolean> {
  const currentRequest = ++requestId
  loading.value = true
  trendEndDate.value = getLocalDateKey()
  readError.value = ''
  records.value = []
  try {
    const loaded = await listDailyRecords()
    if (currentRequest === requestId) records.value = loaded
    return currentRequest === requestId
  } catch (error) {
    if (currentRequest === requestId) readError.value = error instanceof Error ? error.message : '读取历史记录失败，请重试。'
    return false
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

onShow(() => { void refreshRecords() })

function requestDelete(date: string) {
  if (busy.value || readError.value || !records.value.some((record) => record.date === date)) return
  feedback.value = ''
  pendingDeletion.value = { kind: 'single', date }
}
function requestClearAll() {
  if (busy.value || readError.value || !records.value.length) return
  feedback.value = ''
  pendingDeletion.value = { kind: 'all', stage: 1 }
}
function cancelDeletion() { if (!mutating.value) pendingDeletion.value = null }

async function confirmDeletion() {
  const pending = pendingDeletion.value
  if (!pending || busy.value) return
  if (pending.kind === 'all' && pending.stage === 1) {
    pendingDeletion.value = { kind: 'all', stage: 2 }
    return
  }
  mutating.value = true
  feedback.value = ''
  try {
    const removed = pending.kind === 'single' ? await deleteDailyRecord(pending.date) : await deleteAllDailyRecords()
    const refreshed = await refreshRecords()
    feedbackKind.value = refreshed ? 'success' : 'error'
    feedback.value = refreshed
      ? (pending.kind === 'single' ? (removed ? `已删除 ${pending.date} 的记录。` : '该记录已不存在，列表已更新。') : `已清空 ${removed} 条记录。`)
      : '删除请求已执行，但重新读取失败，暂时无法确认当前状态。请重新读取。'
  } catch (error) {
    feedbackKind.value = 'error'
    feedback.value = error instanceof Error ? error.message : '删除失败，请重新读取后重试。'
    await refreshRecords()
  } finally {
    expandedDate.value = ''
    pendingDeletion.value = null
    mutating.value = false
  }
}

async function exportRecords() {
  if (busy.value || readError.value) return
  exporting.value = true
  feedback.value = ''
  try {
    // 导出重新查询完整存储，不能把页面中的旧列表当成完整备份。
    const latest = await listDailyRecords()
    const json = serializeRecordExport(latest)
    await downloadJsonFile(`mindbody-records-${getLocalDateKey()}.json`, json)
    feedbackKind.value = 'success'
    feedback.value = `已发起 JSON 下载，共 ${latest.length} 条记录。请确认浏览器已保存文件。`
  } catch (error) {
    feedbackKind.value = 'error'
    feedback.value = error instanceof Error ? error.message : '导出失败，请重试。'
  } finally {
    exporting.value = false
  }
}
function toggleRecord(date: string) { expandedDate.value = expandedDate.value === date ? '' : date }
function goHome() { uni.reLaunch({ url: '/pages/index/index', fail: () => uni.showToast({ title: '无法返回首页，请重试。', icon: 'none' }) }) }
function openRecord() { uni.navigateTo({ url: '/pages/record/index', fail: () => uni.showToast({ title: '无法打开记录页，请重试。', icon: 'none' }) }) }
</script>

<template>
  <view class="history-page">
    <view class="page-nav">
      <button class="back" role="button" tabindex="0" @click="goHome" @keyup.enter.stop.prevent="goHome" @keydown.space.prevent @keyup.space.stop.prevent="goHome">← 返回首页</button>
      <text class="brand">MindBody</text>
    </view>
    <view class="intro">
      <text class="eyebrow">YOUR OWN RHYTHM</text>
      <text class="page-title" role="heading" aria-level="1">回看，慢慢了解自己。</text>
      <text class="subtitle">记录每一天，也给没有记录的日子留白。</text>
    </view>
    <view class="tabs" role="tablist" aria-label="历史视图">
      <button role="tab" tabindex="0" :aria-selected="activeTab === 'records'" :class="{ selected: activeTab === 'records' }" @click="activeTab = 'records'" @keyup.enter.stop.prevent="activeTab = 'records'" @keydown.space.prevent @keyup.space.stop.prevent="activeTab = 'records'">记录</button>
      <button role="tab" tabindex="0" :aria-selected="activeTab === 'trends'" :class="{ selected: activeTab === 'trends' }" @click="activeTab = 'trends'" @keyup.enter.stop.prevent="activeTab = 'trends'" @keydown.space.prevent @keyup.space.stop.prevent="activeTab = 'trends'">趋势</button>
    </view>
    <view v-if="loading" class="message" role="status">正在读取本地记录…</view>
    <view v-else-if="readError" class="message error" role="alert">
      <text>暂时无法显示完整历史</text><text>{{ readError }}</text>
      <button class="action" role="button" tabindex="0" @click="refreshRecords" @keyup.enter.stop.prevent="refreshRecords" @keydown.space.prevent @keyup.space.stop.prevent="refreshRecords">重新读取</button>
    </view>
    <view v-else-if="activeTab === 'trends'" role="tabpanel" aria-label="趋势">
      <view class="range-buttons" role="group" aria-label="趋势时间范围">
        <button v-for="days in ([7, 30] as const)" :key="days" role="button" tabindex="0" :aria-pressed="selectedDays === days" :class="{ selected: selectedDays === days }" @click="selectedDays = days" @keyup.enter.stop.prevent="selectedDays = days" @keydown.space.prevent @keyup.space.stop.prevent="selectedDays = days">最近 {{ days }} 天</button>
      </view>
      <text class="range-caption">{{ trends.startDate }} 至 {{ trends.endDate }} · {{ trends.recordCount }} 天有记录</text>
      <text v-if="!trends.recordCount" class="trend-empty" role="status">这段时间还没有记录。无数据的日子会留白。</text>
      <view class="trend-grid"><HealthTrendChart v-for="series in trends.series" :key="`${selectedDays}-${series.id}`" :series="series" /></view>
      <text class="trend-note">平均值只计算该项已填写的日子。图表用于观察，不生成健康评分或医疗判断，也不说明变化的原因。</text>
    </view>
    <view v-else-if="!records.length" class="message empty" role="status">
      <text class="empty-title">还没有记录，今天可以是一小步。</text>
      <text>从任意一项感受开始，不必填写所有内容。</text>
      <button class="action" role="button" tabindex="0" @click="openRecord" @keyup.enter.stop.prevent="openRecord" @keydown.space.prevent @keyup.space.stop.prevent="openRecord">记录今天</button>
    </view>
    <view v-else role="tabpanel" aria-label="记录">
      <view class="list-heading"><text>全部记录 · {{ records.length }} 天</text><text>日期从近到远</text></view>
      <view class="history-list">
        <HistoryRecordCard v-for="record in records" :key="record.date" :record="record" :expanded="expandedDate === record.date" :disabled="busy" @toggle="toggleRecord(record.date)" @remove="requestDelete(record.date)" />
      </view>
    </view>
    <view class="management">
      <text class="management-title" role="heading" aria-level="2">管理我的数据</text>
      <text class="management-note">JSON 可保存完整记录。导出文件含个人信息，请自行妥善保管。</text>
      <button class="export-button" role="button" tabindex="0" :disabled="busy || !!readError" @click="exportRecords" @keyup.enter.stop.prevent="exportRecords" @keydown.space.prevent @keyup.space.stop.prevent="exportRecords">{{ exporting ? '正在导出…' : '导出全部记录 JSON' }}</button>
      <view class="danger-zone">
        <text>永久删除 · 不可恢复</text>
        <button class="clear-button" role="button" tabindex="0" :disabled="busy || !!readError || !records.length" @click="requestClearAll" @keyup.enter.stop.prevent="requestClearAll" @keydown.space.prevent @keyup.space.stop.prevent="requestClearAll">清空全部记录</button>
      </view>
    </view>
    <view v-if="feedback" class="feedback" :class="feedbackKind" :role="feedbackKind === 'error' ? 'alert' : 'status'" aria-live="polite">{{ feedback }}</view>
    <text class="footer">只在本机保存 · 用于自我观察，不提供诊断或治疗建议</text>
    <ConfirmAction v-if="pendingDeletion" :key="confirmation.key" :title="confirmation.title" :message="confirmation.message" :confirm-label="confirmation.label" :busy="mutating" @cancel="cancelDeletion" @confirm="confirmDeletion" />
  </view>
</template>

<style scoped>
.history-page { max-width: 1050px; margin: 0 auto; padding: calc(24px + env(safe-area-inset-top)) 32px calc(32px + env(safe-area-inset-bottom)); }
.history-page button { margin: 0; }
.history-page button::after { border: 0; }
.page-nav, .list-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.back { padding: 10px 0; background: transparent; color: #526a48; font-size: 13px; min-height: 44px; cursor: pointer; }
.brand { font-size: 21px; font-weight: 650; letter-spacing: -.5px; }
.intro { margin: 34px 0 28px; }
.eyebrow, .page-title, .subtitle, .message text, .footer { display: block; }
.eyebrow { font-size: 10px; letter-spacing: 2px; color: #7c886f; }
.page-title { font-size: 29px; font-weight: 600; margin: 9px 0; }
.subtitle { font-size: 13px; color: #78836d; }
.message { padding: 26px; background: #fffefa; border: 1px solid #e4e8da; border-radius: 20px; color: #66775c; overflow-wrap: anywhere; }
.message text + text { margin-top: 10px; }
.error { background: #fbf1e9; color: #925e43; }
.empty-title { font-size: 18px; color: #405a3c; }
.action { margin: 18px 0 0; padding: 12px 20px; min-height: 44px; border-radius: 11px; background: #48664b; color: #fff; font-size: 13px; cursor: pointer; }
.list-heading { font-size: 12px; color: #75806d; margin-bottom: 15px; }
.history-list { display: grid; gap: 16px; grid-template-columns: repeat(2,minmax(0,1fr)); align-items: start; }
.footer { text-align: center; color: #808975; font-size: 10px; margin-top: 30px; }
.management { padding: 22px; margin-top: 28px; border: 1px solid #dde3d2; border-radius: 18px; background: #f0f3e8; }
.management-title, .management-note { display: block; }
.management-title { font-size: 16px; font-weight: 600; }
.management-note { font-size: 12px; color: #758067; margin: 8px 0 16px; }
.export-button, .clear-button { padding: 11px 16px; min-height: 44px; border-radius: 10px; font-size: 12px; cursor: pointer; }
.export-button { background: #e1e9d6; color: #486140; }
.danger-zone { margin-top: 22px; padding-top: 18px; border-top: 1px solid #dfe3d5; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 11px; color: #986849; }
.clear-button { background: #f6e9df; color: #955439; }
.feedback { border-radius: 12px; padding: 16px; margin-top: 16px; font-size: 13px; overflow-wrap: anywhere; }
.feedback.success { background: #e9efdf; color: #486140; }
.feedback.error { background: #f9ece3; color: #915235; }
.tabs { display: flex; gap: 8px; padding: 5px; background: #e9eddf; border-radius: 13px; margin-bottom: 22px; max-width: 320px; }
.tabs button { flex: 1; padding: 10px; min-height: 44px; border-radius: 9px; background: transparent; color: #768369; cursor: pointer; font-size: 13px; }
.tabs button.selected { background: #fffdf7; color: #405f3a; box-shadow: 0 2px 5px #3344220a; }
.range-buttons { display: flex; gap: 10px; }
.range-buttons button { border: 1px solid #dbe2cf; background: #f4f6ee; color: #6a795c; border-radius: 10px; padding: 10px 16px; min-height: 44px; font-size: 12px; cursor: pointer; }
.range-buttons button.selected { background: #e2ead6; border-color: #b8c7a5; color: #45613c; }
.range-caption, .trend-note, .trend-empty { display: block; font-size: 11px; color: #7a856d; margin: 16px 0; }
.trend-empty { padding: 14px; background: #edf2e5; border-radius: 10px; }
.trend-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; align-items: start; }
button[disabled] { opacity: .55; cursor: default; }
@media (max-width: 720px) { .history-page { padding-left: 20px; padding-right: 20px; } .history-list, .trend-grid { grid-template-columns: minmax(0,1fr); } .page-title { font-size: 25px; } }
@media (max-width: 360px) { .history-page { padding-left: 15px; padding-right: 15px; } .page-title { font-size: 22px; } }
</style>
