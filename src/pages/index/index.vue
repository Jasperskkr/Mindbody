<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { DailyRecord } from '../../types/health'
import { loadDailyRecord } from '../../storage/daily-records'
import { formatLocalDate, getLocalDateKey } from '../../utils/date'
import { toDailyOverview } from '../../utils/daily-overview'

const today = ref(formatLocalDate(new Date()))
const record = ref<DailyRecord | null>(null)
const loading = ref(true)
const readError = ref('')
const overview = computed(() => toDailyOverview(record.value))
const overviewStatus = computed(() => {
  if (loading.value) return '读取中'
  if (readError.value) return '读取失败'
  return record.value ? '今日记录' : '尚未记录'
})
let requestId = 0

async function refreshOverview() {
  // 页面重新显示时重新读同一份存储；过期的异步结果不能覆盖较新的结果。
  const currentRequest = ++requestId
  const date = new Date()
  today.value = formatLocalDate(date)
  loading.value = true
  readError.value = ''
  record.value = null
  try {
    const loaded = await loadDailyRecord(getLocalDateKey(date))
    if (currentRequest === requestId) record.value = loaded
  } catch (error) {
    if (currentRequest === requestId) {
      readError.value = error instanceof Error ? error.message : '读取今天的记录失败，请重试。'
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

onShow(() => {
  void refreshOverview()
})

function openRecord() {
  uni.navigateTo({
    url: '/pages/record/index',
    fail: () => uni.showToast({ title: '暂时无法打开记录页，请重试。', icon: 'none' }),
  })
}

function showTrendsPlaceholder() {
  uni.showModal({
    title: '慢慢看见自己的节奏',
    content: '历史趋势将在后续阶段加入。当前可以先在每日记录页填写并保存当天感受。',
    showCancel: false,
    confirmText: '知道了',
    confirmColor: '#47634c',
  })
}
</script>

<template>
  <view class="home">
    <view class="topbar">
      <view class="brand">
        <view class="brand-mark" aria-hidden="true">
          <view class="leaf leaf-left" />
          <view class="leaf leaf-right" />
        </view>
        <text class="brand-name">MindBody</text>
      </view>
      <view class="demo-badge">
        <view class="badge-dot" />
        <text>本地记录</text>
      </view>
    </view>

    <view class="intro">
      <text class="eyebrow">一 日 一 记，关 照 自 己</text>
      <text class="greeting" role="heading" aria-level="1">今天，也听听自己的声音。</text>
      <text class="today">{{ today }}</text>
    </view>

    <view class="dashboard">
      <view class="overview-card">
        <view class="section-head">
          <view>
            <text class="section-kicker">DAILY CHECK-IN</text>
            <text class="section-title" role="heading" aria-level="2">今日状态概览</text>
          </view>
          <text class="sample-label">{{ overviewStatus }}</text>
        </view>

        <view v-if="loading" class="overview-message" role="status">正在读取今天的记录…</view>
        <view v-else-if="readError" class="overview-message overview-error" role="alert">
          <text class="overview-error-title">暂时无法显示今日记录</text>
          <text>{{ readError }}</text>
          <button
            class="overview-retry"
            role="button"
            tabindex="0"
            @click="refreshOverview"
            @keyup.enter.stop.prevent="refreshOverview"
            @keydown.space.prevent
            @keyup.space.stop.prevent="refreshOverview"
          >重新读取</button>
        </view>
        <view v-else>
          <text v-if="!record" class="empty-overview" role="status">今天还没有记录，点击「每日记录」留下第一条。</text>
          <view class="metrics">
            <view
              v-for="metric in overview.metrics"
              :key="metric.id"
              class="metric"
              :class="`tone-${metric.tone}`"
            >
              <view class="metric-top">
                <text class="metric-label">{{ metric.label }}</text>
                <text class="metric-symbol" aria-hidden="true">{{ metric.symbol }}</text>
              </view>
              <text class="metric-value">
                {{ metric.value }}<text v-if="metric.unit" class="metric-unit"> {{ metric.unit }}</text>
              </text>
              <text class="metric-detail">{{ metric.detail }}</text>
            </view>
          </view>

          <view class="body-note">
            <view class="body-note-dot" />
            <view class="body-note-copy">
              <text class="body-note-label">身体感受</text>
              <text class="body-note-value">{{ overview.bodyNote }}</text>
            </view>
          </view>
        </view>
        <text class="overview-caption">每一种状态都值得被看见，不必给自己打分。</text>
      </view>

      <view class="side-column">
        <view class="record-card">
          <view class="record-copy">
            <text class="section-kicker">A MOMENT FOR YOURSELF</text>
            <text class="record-title" role="heading" aria-level="2">
              留一点时间，<text class="line-break">给此刻的自己。</text>
            </text>
            <text class="record-description">记下感受，从了解自己开始。</text>
          </view>
          <view class="pebble-art" aria-hidden="true">
            <view class="pebble pebble-one" />
            <view class="pebble pebble-two" />
            <view class="pebble pebble-three" />
            <view class="pebble-ground" />
          </view>
          <!-- H5 的 uni-button 是自定义元素，因此显式补充键盘操作和按钮语义。 -->
          <button
            class="record-button"
            role="button"
            tabindex="0"
            @click="openRecord"
            @keyup.enter.stop.prevent="openRecord"
            @keydown.space.prevent
            @keyup.space.stop.prevent="openRecord"
          >
            <text>每日记录</text>
            <text class="button-arrow" aria-hidden="true">↗</text>
          </button>
          <text class="record-footnote">只保存在此设备 · 随时记下一点感受</text>
        </view>

        <view class="quiet-reminder">
          <text class="reminder-mark" aria-hidden="true">“</text>
          <view>
            <text class="reminder-title">不急着改变，先慢慢了解。</text>
            <text class="reminder-copy">你不需要每天都保持最好的状态。</text>
          </view>
        </view>
      </view>
    </view>

    <view class="explore-section">
      <view class="explore-heading">
        <text class="section-title" role="heading" aria-level="2">慢慢了解，慢慢靠近</text>
        <text class="explore-subtitle">为日常多一点觉察</text>
      </view>
      <view class="entry-grid">
        <button
          class="entry-card trend-entry"
          role="button"
          tabindex="0"
          @click="showTrendsPlaceholder"
          @keyup.enter.stop.prevent="showTrendsPlaceholder"
          @keydown.space.prevent
          @keyup.space.stop.prevent="showTrendsPlaceholder"
        >
          <view class="entry-icon trend-icon" aria-hidden="true">
            <view class="bar bar-one" />
            <view class="bar bar-two" />
            <view class="bar bar-three" />
            <view class="bar bar-four" />
          </view>
          <view class="entry-copy">
            <text class="entry-title">历史趋势</text>
            <text class="entry-description">在记录里，看见自己的节奏</text>
          </view>
          <text class="entry-arrow" aria-hidden="true">↗</text>
        </button>
        <button class="entry-card weekly-entry" role="button" disabled aria-disabled="true">
          <view class="entry-icon weekly-icon" aria-hidden="true">✧</view>
          <view class="entry-copy">
            <view class="weekly-title">
              <text class="entry-title">AI 周报</text>
              <text class="soon-label">即将开放</text>
            </view>
            <text class="entry-description">未来，把一周的感受串起来</text>
          </view>
        </button>
      </view>
    </view>

    <view class="footer">
      <view class="footer-divider" />
      <text class="footer-brand">MindBody · 身心之间，留一处空间</text>
      <text class="footer-note">用于健康记录与自我观察，不提供疾病诊断或治疗建议。</text>
      <text class="footer-demo">概览来自今天已保存的本地记录；未填写的项目保持空缺。</text>
    </view>
  </view>
</template>

<style scoped>
.home {
  max-width: 1120px;
  margin: 0 auto;
  padding: calc(28px + env(safe-area-inset-top)) 40px calc(28px + env(safe-area-inset-bottom));
}

.topbar, .brand, .demo-badge, .section-head, .metric-top, .body-note, .record-button, .quiet-reminder, .explore-heading, .entry-card, .weekly-title {
  display: flex;
  align-items: center;
}

.topbar, .section-head, .metric-top, .record-button, .explore-heading {
  justify-content: space-between;
}

.brand {
  gap: 11px;
}

.brand-mark {
  width: 30px;
  height: 32px;
  position: relative;
}

.leaf {
  position: absolute;
  background: #587258;
  width: 14px;
  height: 24px;
  top: 4px;
}

.leaf-left {
  left: 0;
  border-radius: 15px 2px 15px 2px;
  transform: rotate(-25deg);
}

.leaf-right {
  right: 0;
  border-radius: 2px 15px 2px 15px;
  transform: rotate(25deg);
  background: #9da98b;
}

.brand-name {
  font-size: 25px;
  font-weight: 650;
  letter-spacing: -0.9px;
}

.demo-badge {
  gap: 7px;
  color: #62705e;
  font-size: 11px;
  border: 1px solid #dce1d3;
  border-radius: 20px;
  padding: 5px 11px;
}

.badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #82936c;
}

.intro {
  margin: 43px 0 28px;
}

.eyebrow, .greeting, .today, .section-kicker, .section-title, .metric-value, .metric-detail, .overview-caption, .record-title, .record-description, .record-footnote, .reminder-title, .reminder-copy, .entry-title, .entry-description, .footer-brand, .footer-note, .footer-demo {
  display: block;
}

.eyebrow {
  font-size: 10px;
  color: #75806f;
  margin-bottom: 9px;
}

.greeting {
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.5px;
  line-height: 1.5;
}

.today {
  font-size: 12px;
  color: #788173;
  margin-top: 10px;
}

.dashboard {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 22px;
  align-items: start;
}

.overview-card {
  background: #fffefa;
  border: 1px solid #e6e8de;
  border-radius: 23px;
  padding: 25px;
}

.section-kicker {
  font-size: 9px;
  letter-spacing: 1.9px;
  color: #7a866d;
  margin-bottom: 4px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
}

.sample-label {
  font-size: 10px;
  background: #f0f2e9;
  color: #6a775e;
  padding: 4px 9px;
  border-radius: 6px;
}

.overview-message, .empty-overview {
  display: block;
  margin-top: 18px;
  padding: 14px;
  border-radius: 12px;
  background: #f2f5ea;
  color: #617154;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.overview-error {
  background: #faf0e8;
  color: #895437;
}

.overview-error-title {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
}

.overview-retry {
  margin: 14px 0 0;
  padding: 10px;
  min-height: 44px;
  border-radius: 9px;
  background: #e5ebda;
  color: #465f3a;
  cursor: pointer;
}

.overview-retry::after {
  border: 0;
}

.overview-retry:focus-visible {
  outline: 3px solid #a56b34;
  outline-offset: 3px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 22px;
}

.metric {
  border-radius: 15px;
  padding: 15px 16px 14px;
}

.tone-sage {
  background: #edf2e8;
}

.tone-lavender {
  background: #efedf5;
}

.tone-sand {
  background: #f6efdf;
}

.tone-peach {
  background: #f7ece4;
}

.metric-label {
  font-size: 13px;
  color: #5d685b;
}

.metric-symbol {
  font-size: 24px;
  line-height: 1;
  color: #728468;
}

.tone-lavender .metric-symbol {
  color: #9185a7;
}

.tone-sand .metric-symbol {
  color: #ad9157;
}

.tone-peach .metric-symbol {
  color: #ad886c;
}

.metric-value {
  font-size: 25px;
  font-weight: 600;
  margin-top: 8px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.metric-unit {
  font-size: 14px;
  font-weight: 400;
}

.metric-detail {
  font-size: 11px;
  color: #70786a;
  margin-top: 2px;
}

.body-note {
  gap: 9px;
  background: #f7f8f1;
  border-radius: 11px;
  padding: 13px 12px;
  margin-top: 15px;
  font-size: 12px;
}

.body-note-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #98a28a;
}

.body-note-copy {
  flex: 1;
  min-width: 0;
}

.body-note-label {
  margin-right: 11px;
  color: #77816f;
}

.body-note-value {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.overview-caption {
  text-align: center;
  color: #7c8475;
  font-size: 11px;
  margin-top: 19px;
}

.side-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.record-card {
  border-radius: 23px;
  background: #e7ecdc;
  padding: 26px 25px 18px;
  position: relative;
  overflow: hidden;
}

.record-copy {
  position: relative;
  z-index: 1;
}

.record-card .section-kicker {
  font-size: 8px;
  letter-spacing: 1.4px;
}

.record-title {
  font-size: 25px;
  font-weight: 500;
  line-height: 1.6;
  margin-top: 14px;
  letter-spacing: 0.5px;
}

.line-break {
  display: block;
}

.record-description {
  font-size: 12px;
  color: #67755e;
  margin-top: 12px;
}

.pebble-art {
  position: absolute;
  right: 15px;
  top: 80px;
  width: 100px;
  height: 134px;
  opacity: 0.85;
}

.pebble {
  position: absolute;
  left: 50%;
  transform: translateX(-50%) rotate(-6deg);
  border: 1px solid rgba(255, 255, 255, 0.25);
  z-index: 1;
  box-shadow: inset -7px -7px 16px rgba(49, 67, 36, 0.06);
}

.pebble-one {
  top: 17px;
  width: 43px;
  height: 30px;
  border-radius: 48% 56% 43% 49%;
  background: #b7c1a3;
  transform: translateX(-30%) rotate(12deg);
}

.pebble-two {
  top: 44px;
  width: 68px;
  height: 35px;
  border-radius: 45% 53% 44% 50%;
  background: #c7ceb6;
}

.pebble-three {
  top: 76px;
  width: 91px;
  height: 39px;
  border-radius: 48% 48% 42% 46%;
  background: #abb89a;
  transform: translateX(-50%) rotate(3deg);
}

.pebble-ground {
  position: absolute;
  bottom: 12px;
  width: 100px;
  height: 9px;
  border-radius: 50%;
  background: #cdd5bd;
  filter: blur(4px);
}

.record-button {
  width: 100%;
  border-radius: 12px;
  background: #466248;
  color: #fffef7;
  font-size: 13px;
  padding: 13px 17px;
  margin-top: 31px;
  position: relative;
  z-index: 1;
  cursor: pointer;
}

.record-button:active {
  background: #354f38;
}

.button-arrow {
  font-size: 21px;
  line-height: 1;
}

.record-footnote {
  font-size: 10px;
  text-align: center;
  color: #68775f;
  margin-top: 10px;
}

.quiet-reminder {
  gap: 13px;
  padding: 7px 10px;
}

.reminder-mark {
  font-family: Georgia, serif;
  color: #b3bea4;
  font-size: 44px;
  line-height: 1;
}

.reminder-title {
  font-size: 12px;
  color: #596952;
}

.reminder-copy {
  font-size: 11px;
  color: #7e8775;
  margin-top: 3px;
}

.explore-section {
  margin-top: 31px;
}

.explore-heading .section-title {
  font-size: 16px;
}

.explore-subtitle {
  font-size: 10px;
  color: #7b8472;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 15px;
}

.entry-card {
  gap: 16px;
  padding: 22px;
  border-radius: 17px;
  background: #fffefa;
  border: 1px solid #e3e7db;
  text-align: left;
  width: 100%;
}

.trend-entry {
  cursor: pointer;
}

.trend-entry:active {
  background: #f0f3e9;
}

.entry-icon {
  width: 43px;
  height: 43px;
  background: #f0f3e8;
  border-radius: 12px;
  flex-shrink: 0;
}

.trend-icon {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 4px;
  padding: 11px;
}

.bar {
  width: 4px;
  background: #7c956e;
  border-radius: 2px;
}

.bar-one {
  height: 9px;
}

.bar-two {
  height: 15px;
}

.bar-three {
  height: 12px;
}

.bar-four {
  height: 21px;
}

.entry-copy {
  flex: 1;
  min-width: 0;
}

.entry-title {
  color: #3a4f3b;
  font-size: 14px;
  font-weight: 500;
}

.entry-description {
  font-size: 11px;
  color: #7a8371;
  margin-top: 4px;
}

.entry-arrow {
  color: #8a977b;
  font-size: 20px;
}

.weekly-entry[disabled] {
  background: #f0f2eb;
  color: #7d8576;
  border-color: #e5e8de;
  opacity: 1;
}

.weekly-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 29px;
  color: #8b937f;
  background: #e6eadf;
}

.weekly-entry .entry-title {
  color: #626d59;
}

.weekly-title {
  gap: 8px;
  flex-wrap: wrap;
}

.soon-label {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid #d4dacb;
  border-radius: 5px;
  color: #647058;
}

.footer {
  text-align: center;
  margin-top: 32px;
}

.footer-divider {
  width: 30px;
  height: 1px;
  background: #ccd3bf;
  margin: 0 auto 15px;
}

.footer-brand {
  font-size: 10px;
  letter-spacing: 1px;
  color: #6f7c65;
}

.footer-note {
  font-size: 10px;
  color: #7c8476;
  margin-top: 7px;
}

.footer-demo {
  font-size: 10px;
  color: #7c8476;
  margin-top: 3px;
}

@media (min-width: 900px) {
  .record-card {
    min-height: 335px;
  }
  .record-button {
    margin-top: 47px;
  }
}

@media (max-width: 720px) {
  .home {
    padding: calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));
  }
  .brand-name {
    font-size: 23px;
  }
  .intro {
    margin-top: 32px;
    margin-bottom: 23px;
  }
  .greeting {
    font-size: 25px;
  }
  .dashboard {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
  .overview-card {
    padding: 21px 18px;
    border-radius: 20px;
  }
  .metric {
    padding: 14px;
  }
  .record-card {
    padding: 23px 22px 17px;
    border-radius: 20px;
  }
  .record-title {
    font-size: 24px;
  }
  .pebble-art {
    top: 38px;
    right: 25px;
  }
  .record-button {
    margin-top: 24px;
  }
  .quiet-reminder {
    padding-left: 14px;
  }
  .explore-section {
    margin-top: 25px;
  }
  .entry-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .entry-card {
    padding: 18px;
  }
  .footer {
    margin-top: 28px;
  }
}

@media (max-width: 360px) {
  .home {
    padding-left: 15px;
    padding-right: 15px;
  }
  .greeting {
    font-size: 22px;
  }
  .explore-subtitle {
    display: none;
  }
  .metric {
    padding: 12px;
  }
  .metric-detail {
    font-size: 10px;
  }
  .pebble-art {
    right: 10px;
    opacity: 0.55;
  }
}
</style>
