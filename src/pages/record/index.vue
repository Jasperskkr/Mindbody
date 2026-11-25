<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ScaleField from '../../components/ScaleField.vue'
import { scaleLabels } from '../../data/scales'
import type { DailyRecord, DailyRecordForm } from '../../types/health'
import { loadDailyRecord, saveDailyRecord } from '../../storage/daily-records'
import { formatLocalDate, getLocalDateKey } from '../../utils/date'
import { BODY_NOTE_MAX_LENGTH, parseRecordForm } from '../../utils/record-validation'

const date = ref(getLocalDateKey())
const dateLabel = ref(formatLocalDate(new Date()))
const form = reactive<DailyRecordForm>({ sleepHours: '', bodyNote: '' })
const savedRecord = ref<DailyRecord | null>(null)
const loading = ref(true)
const saving = ref(false)
const readError = ref('')
const feedback = ref('')
const feedbackKind = ref<'success' | 'error'>('success')
const busy = computed(() => loading.value || saving.value || !!readError.value)

// 改动后清除旧的“已保存”提示；实际保存的内容不会随输入自动改写。
watch(form, () => { feedback.value = '' })

async function readRecord() {
  loading.value = true
  readError.value = ''
  feedback.value = ''
  date.value = getLocalDateKey()
  dateLabel.value = formatLocalDate(new Date())
  try {
    const record = await loadDailyRecord(date.value)
    savedRecord.value = record
    Object.assign(form, {
      mood: record?.mood,
      stress: record?.stress,
      energy: record?.energy,
      sleepHours: record?.sleepHours === undefined ? '' : String(record.sleepHours),
      bodyNote: record?.bodyNote ?? '',
    })
  } catch (error) {
    readError.value = error instanceof Error ? error.message : '读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

onShow(() => { void readRecord() })

async function saveRecord() {
  if (busy.value) return
  feedback.value = ''
  feedbackKind.value = 'error'
  if (date.value !== getLocalDateKey()) {
    feedback.value = '日期已变化，请刷新或重新进入记录页后填写今天的状态。'
    return
  }

  const result = parseRecordForm(form, date.value)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  saving.value = true
  try {
    savedRecord.value = await saveDailyRecord(result.value)
    feedbackKind.value = 'success'
    feedback.value = '已保存到本机。刷新或重新打开此页面后，仍可读取。'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '保存失败，输入内容仍保留，请重试。'
  } finally {
    saving.value = false
  }
}

function goHome() {
  // 刷新后页面栈可能只有记录页，直接指定首页比依赖浏览器历史更可靠。
  uni.reLaunch({
    url: '/pages/index/index',
    fail: () => uni.showToast({ title: '暂时无法返回首页，请重试。', icon: 'none' }),
  })
}
</script>

<template>
  <view class="record-page">
    <view class="page-nav">
      <button
        class="back-button" role="button" tabindex="0"
        @click="goHome" @keyup.enter.stop.prevent="goHome"
        @keydown.space.prevent @keyup.space.stop.prevent="goHome"
      >← 返回首页</button>
      <text class="brand">MindBody</text>
    </view>

    <view class="page-intro">
      <text class="eyebrow">A MOMENT FOR YOURSELF</text>
      <text class="page-title" role="heading" aria-level="1">记下今天的自己</text>
      <text class="date">{{ dateLabel }}</text>
      <text class="intro-copy">不必填满每一项，留下你愿意记录的感受。</text>
    </view>

    <view v-if="loading" class="message-card" role="status">正在读取今天的本地记录…</view>
    <view v-else-if="readError" class="message-card error-card" role="alert">
      <text class="message-title">暂时无法读取</text>
      <text>{{ readError }}</text>
      <button
        class="retry-button" role="button" tabindex="0"
        @click="readRecord" @keyup.enter.stop.prevent="readRecord"
        @keydown.space.prevent @keyup.space.stop.prevent="readRecord"
      >重新读取</button>
    </view>

    <view v-else class="form-card">
      <view class="form-heading">
        <view>
          <text class="form-title">每日身心记录</text>
          <text class="form-subtitle">{{ savedRecord ? '已读取今天的记录，可补充后再次保存。' : '今天还没有记录，从任意一项开始。' }}</text>
        </view>
        <text class="local-badge">本地保存</text>
      </view>

      <ScaleField
        v-model="form.mood" title="情绪" direction="1 很低落 → 5 很愉快，分数越高情绪越愉快。"
        :labels="scaleLabels.mood" :disabled="busy"
      />
      <ScaleField
        v-model="form.stress" title="压力" direction="1 很放松 → 5 很强，分数越高压力越强。"
        :labels="scaleLabels.stress" :disabled="busy"
      />
      <ScaleField
        v-model="form.energy" title="精力" direction="1 很疲惫 → 5 很充沛，分数越高精力越充沛。"
        :labels="scaleLabels.energy" :disabled="busy"
      />

      <view class="text-field">
        <view class="field-heading"><text class="field-title">睡眠时长</text><text class="optional">可跳过</text></view>
        <text class="field-description">记录昨晚的睡眠，0–24 小时，允许小数。</text>
        <view class="sleep-input-wrap">
          <input
            v-model="form.sleepHours" class="sleep-input" type="text" inputmode="decimal"
            aria-label="睡眠时长（小时）" placeholder="例如 7.5" :maxlength="20" :disabled="busy"
          />
          <text class="input-unit">小时</text>
        </view>
        <text class="empty-hint">留空表示未填写；填写 0 表示睡眠为 0 小时。</text>
      </view>

      <view class="text-field body-field">
        <view class="field-heading"><text class="field-title">身体感受</text><text class="optional">可跳过</text></view>
        <text class="field-description">用自己的话记录此刻，不需要判断原因。</text>
        <textarea
          v-model="form.bodyNote" class="body-input" aria-label="身体感受"
          placeholder="例如：今天散步后，身体感觉轻松了一些。"
          :maxlength="BODY_NOTE_MAX_LENGTH" :disabled="busy" :auto-height="true"
        />
        <text class="character-count">{{ form.bodyNote.length }} / {{ BODY_NOTE_MAX_LENGTH }}</text>
      </view>

      <view v-if="feedback" class="feedback" :class="feedbackKind" :role="feedbackKind === 'error' ? 'alert' : 'status'" aria-live="polite">
        {{ feedback }}
      </view>
      <button
        class="save-button" role="button" :tabindex="busy ? -1 : 0" :disabled="busy" :loading="saving"
        @click="saveRecord" @keyup.enter.stop.prevent="saveRecord"
        @keydown.space.prevent @keyup.space.stop.prevent="saveRecord"
      >{{ saving ? '正在保存…' : '保存今天的记录' }}</button>
      <text class="save-hint">至少填写一项即可。再次保存会更新今天的记录。</text>
    </view>

    <view class="privacy-note">
      <text class="privacy-title">这份记录，留在你身边。</text>
      <text>保存只写入当前浏览器或设备；身心洞察仅在你另行明确授权后传输必要摘要。清理浏览器数据或更换浏览器后，记录可能无法找回；本地存储未加密。</text>
      <text class="overview-note">保存成功后返回首页，即可在今日概览中看到这份记录。</text>
    </view>
  </view>
</template>

<style scoped>
.record-page {
  max-width: 720px;
  margin: 0 auto;
  padding: calc(24px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom));
}

.page-nav, .field-heading, .form-heading, .sleep-input-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.back-button {
  margin: 0;
  padding: 8px 0;
  background: transparent;
  color: #536b48;
  min-height: 44px;
  font-size: 13px;
  cursor: pointer;
}

.brand {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.5px;
}

.page-intro {
  margin: 30px 0 24px;
}

.eyebrow, .page-title, .date, .intro-copy, .form-title, .form-subtitle, .field-description, .empty-hint, .character-count, .save-hint, .privacy-note text, .message-title {
  display: block;
}

.eyebrow {
  font-size: 10px;
  letter-spacing: 1.8px;
  color: #758268;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  margin-top: 9px;
}

.date {
  color: #6d7964;
  font-size: 12px;
  margin-top: 7px;
}

.intro-copy {
  color: #65725e;
  font-size: 13px;
  margin-top: 16px;
}

.form-card, .message-card {
  background: #fffefa;
  border: 1px solid #e3e7d9;
  border-radius: 22px;
  padding: 26px;
}

.form-heading {
  align-items: flex-start;
  padding-bottom: 2px;
}

.form-title {
  font-size: 18px;
  font-weight: 600;
}

.form-subtitle {
  font-size: 12px;
  color: #6b775f;
  margin-top: 7px;
}

.local-badge {
  flex-shrink: 0;
  background: #edf2e5;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10px;
  color: #5d714f;
}

.text-field {
  padding-top: 23px;
}

.field-title {
  font-size: 17px;
  font-weight: 600;
}

.optional {
  font-size: 11px;
  color: #74806a;
}

.field-description {
  color: #68735f;
  font-size: 12px;
  margin-top: 6px;
}

.sleep-input-wrap {
  background: #f5f6ef;
  border: 1px solid #dce2d2;
  border-radius: 12px;
  padding: 12px 14px;
  margin-top: 14px;
}

.sleep-input {
  flex: 1;
  min-width: 0;
  font-size: 17px;
  height: 28px;
}

.input-unit {
  color: #6a775f;
  font-size: 13px;
}

.empty-hint {
  font-size: 11px;
  color: #707b66;
  margin-top: 8px;
}

.body-input {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 112px;
  background: #f5f6ef;
  border: 1px solid #dce2d2;
  border-radius: 12px;
  padding: 14px;
  font-size: 14px;
  line-height: 1.7;
  margin-top: 14px;
}

.character-count {
  text-align: right;
  font-size: 11px;
  color: #707b66;
  margin-top: 6px;
}

.feedback {
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  margin-top: 20px;
  overflow-wrap: anywhere;
}

.success {
  color: #3b5a30;
  background: #eaf2e2;
}

.error, .error-card {
  color: #895437;
  background: #faf0e8;
}

.save-button {
  margin-left: 0;
  margin-right: 0;
  width: 100%;
  background: #466248;
  color: #fffef7;
  padding: 14px 18px;
  border-radius: 12px;
  font-size: 15px;
  margin-top: 22px;
  min-height: 52px;
  cursor: pointer;
}

.save-button[disabled] {
  background: #c3cdb9;
  color: #43523c;
}

.save-hint {
  text-align: center;
  color: #6f7b64;
  font-size: 11px;
  margin-top: 11px;
}

.privacy-note {
  margin: 24px 7px 0;
  color: #707c66;
  font-size: 12px;
  line-height: 1.9;
}

.privacy-title {
  color: #526a47;
  font-size: 13px;
  margin-bottom: 6px;
}

.overview-note {
  margin-top: 8px;
}

.message-card {
  font-size: 13px;
}

.message-title {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 9px;
}

.retry-button {
  margin-left: 0;
  margin-right: 0;
  background: #e5ebda;
  color: #465f3a;
  margin-top: 18px;
  min-height: 44px;
  padding: 10px;
  border-radius: 9px;
  cursor: pointer;
}

.back-button::after, .save-button::after, .retry-button::after {
  border: 0;
}

.back-button:focus-visible, .save-button:focus-visible, .retry-button:focus-visible {
  outline: 3px solid #a56b34;
  outline-offset: 4px;
}

.sleep-input-wrap:focus-within, .body-input:focus-within {
  border-color: #5d7c50;
}

@media (max-width: 420px) {
  .record-page {
    padding-left: 16px;
    padding-right: 16px;
  }
  .form-card, .message-card {
    padding: 20px 16px;
    border-radius: 18px;
  }
  .page-title {
    font-size: 25px;
  }
  .form-heading {
    gap: 8px;
  }
}
</style>
