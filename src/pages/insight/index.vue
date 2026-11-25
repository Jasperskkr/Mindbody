<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import type { DailyContext, DailyInsight, InsightConversation, InsightRequest, InsightServiceMode, ServiceInfo } from '../../types/insight'
import { listDailyRecords } from '../../storage/daily-records'
import { buildDailyContext, contextFacts } from '../../utils/daily-context'
import { knowledgeCards, knowledgeHash, knowledgeSources, localInsight, microActions } from '../../utils/insight'
import { consentPreview, INSIGHT_API_ORIGIN, loadServiceInfo, requestInsight } from '../../services/insight-api'

const context = ref<DailyContext | null>(null)
const insight = ref<DailyInsight | null>(null)
const loading = ref(true)
const sending = ref(false)
const error = ref('')
const feedback = ref('')
const serviceMode = ref<InsightServiceMode>('mock')
const serviceInfo = ref<ServiceInfo | null>(null)
const conversation = ref<InsightConversation>({ mode: 'combined', messages: [] })
const question = ref('')
const selectedAction = ref('')
const consentRequest = ref<InsightRequest | null>(null)
const preview = ref('')
const cancelButton = ref<unknown>(null)
const approveButton = ref<unknown>(null)
const sources = computed(() => knowledgeCards.filter((card) => insight.value?.perspectives.some((view) => view.citationIds.includes(card.id))))
const facts = computed(() => context.value ? contextFacts(context.value) : [])
const modeLabel = { psychology: '心理', tcm: '中医', combined: '综合' }
const evidenceLabel = { public_health_guidance: '公共健康教育材料', terminology_standard: '术语标准', traditional_text: '古代传统理论文本', modern_research: '现代研究证据（需结合研究局限）' }
const statusLabel = { local_preview: '本地教育预览', mock: 'Mock 服务回应', llm: 'AI 辅助选择', fallback: '安全降级模板', blocked: '专业支持引导', empty: '暂无今日记录' }
let revision = 0

async function refresh() {
  const current = ++revision
  loading.value = true
  error.value = ''
  context.value = null
  insight.value = null
  consentRequest.value = null
  conversation.value.messages = []
  selectedAction.value = ''
  question.value = ''
  feedback.value = ''
  try {
    const next = buildDailyContext(await listDailyRecords())
    if (current !== revision) return
    context.value = next
    insight.value = localInsight(next)
  } catch (reason) {
    if (current === revision) error.value = reason instanceof Error ? reason.message : '无法读取记录，请重试。'
  } finally {
    if (current === revision) loading.value = false
  }
}
onShow(() => { void refresh() })
onHide(() => { revision++; consentRequest.value = null; sending.value = false })

async function prepareRequest() {
  if (!context.value?.today || loading.value || sending.value) return
  if (question.value.trim().length > 300) { feedback.value = '问题请控制在 300 字符内。'; return }
  const current = revision
  sending.value = true
  feedback.value = ''
  try {
    const info = await loadServiceInfo()
    if (current !== revision) return
    serviceInfo.value = info
    if (serviceMode.value === 'llm' && !info.llmEnabled) { feedback.value = '真实模型尚未启用。可使用 Mock 或本地预览；未发送记录。'; return }
    const input: InsightRequest = {
      knowledgeHash, context: JSON.parse(JSON.stringify(context.value)), mode: conversation.value.mode, serviceMode: serviceMode.value,
      question: question.value.trim(), consent: { granted: true, scope: 'daily-summary-and-question-v1',
        providerHost: serviceMode.value === 'llm' ? info.providerHost : null, model: serviceMode.value === 'llm' ? info.model : null },
    }
    preview.value = consentPreview(input.context, input.mode, input.question)
    consentRequest.value = input // 快照：确认后只发送预览的这些内容。
    void nextTick(() => focusButton(cancelButton.value))
  } catch (reason) { if (current === revision) feedback.value = reason instanceof Error ? reason.message : '服务不可用，未发送记录。' }
  finally { if (current === revision) sending.value = false }
}
function cancelConsent() { if (!sending.value) consentRequest.value = null }
function focusButton(target: unknown) {
  const button = target as { $el?: { focus?: () => void }; focus?: () => void } | null
  ;(button?.$el ?? button)?.focus?.()
}
async function authorizeAndSend() {
  const input = consentRequest.value
  if (!input || sending.value) return
  const current = revision
  sending.value = true
  feedback.value = ''
  try {
    const response = await requestInsight(input)
    if (current !== revision) return
    insight.value = response
    // 仅保留本页对话，不存储、不自动上传过去聊天；每次仍带经授权摘要。
    if (input.question) conversation.value.messages.push({ role: 'user', content: input.question })
    conversation.value.messages.push({ role: 'assistant', content: response.reply })
    conversation.value.messages = conversation.value.messages.slice(-12)
    question.value = ''
  } catch (reason) {
    if (current === revision) feedback.value = reason instanceof Error ? reason.message : '请求失败，本地预览保留。'
  } finally { if (current === revision) { sending.value = false; consentRequest.value = null } }
}
function selectMode(mode: InsightConversation['mode']) {
  if (sending.value || consentRequest.value) return
  conversation.value = { mode, messages: [] }
  feedback.value = '已切换视角，本页对话已清除；下次调用需重新授权。'
  if (context.value) insight.value = localInsight(context.value)
}
function selectService(mode: InsightServiceMode) { if (!sending.value && !consentRequest.value) serviceMode.value = mode }
function selectAction(id: string) { selectedAction.value = selectedAction.value === id ? '' : id }
function goHome() { uni.reLaunch({ url: '/pages/index/index' }) }
function openRecord() { uni.navigateTo({ url: '/pages/record/index' }) }
</script>

<template>
  <view class="insight-page">
    <view class="nav"><button @click="goHome" role="button" tabindex="0" @keyup.enter.stop.prevent="goHome">← 返回首页</button><text class="brand">MindBody</text></view>
    <text class="eyebrow">TWO PERSPECTIVES, YOUR OWN PACE</text>
    <text class="page-title" role="heading" aria-level="1">从两个视角，认识此刻。</text>
    <text class="intro">心理学与中医理论分别作为教育视角，不互相推导，不作诊断。</text>
    <view v-if="loading" class="panel" role="status">正在读取本地记录…</view>
    <view v-else-if="error" class="panel error" role="alert"><text>{{ error }}</text><button @click="refresh" role="button" tabindex="0" @keyup.enter.stop.prevent="refresh">重新读取</button></view>
    <view v-else-if="!context?.today" class="panel"><text class="title">今天还没有记录。</text><text>留下愿意记录的一项，再从这里回看。已有历史不会被当作今天的数据。</text><button class="primary" @click="openRecord" role="button" tabindex="0" @keyup.enter.stop.prevent="openRecord">记录今天</button></view>
    <view v-else>
      <view class="panel facts"><text class="title" role="heading" aria-level="2">{{ context.date }} · 今日与近七天</text><text v-for="fact in facts" :key="fact" class="fact">{{ fact }}</text><text class="muted">量表：情绪越高越愉快，压力越高越强，精力越高越充沛；缺失不补分。</text></view>
      <text class="badge" role="status">{{ insight ? statusLabel[insight.status] : '' }}</text>
      <text class="notice">{{ insight?.notice }}</text>
      <view class="perspectives">
        <view v-for="view in insight?.perspectives" :key="view.domain" class="panel" :class="view.domain">
          <text class="title" role="heading" aria-level="2">{{ view.title }}</text><text class="content">{{ view.text }}</text>
          <text class="uncertainty">局限：{{ view.uncertainty }}</text><text class="citation">引用：{{ view.citationIds.join('、') || '无匹配来源' }}</text>
        </view>
      </view>
      <view v-if="sources.length" class="panel sources"><text class="title" role="heading" aria-level="2">知识来源</text>
        <view v-for="source in sources" :key="source.id" class="source"><text>{{ source.id }} · {{ source.title }}</text><text class="muted">{{ evidenceLabel[source.evidenceType] }} · {{ source.source.publisher }} · 核对 {{ source.review.checkedAt }}</text><text class="muted">卡片 v{{ source.version }} · {{ source.professionalReview.status === 'approved' ? '已记录专业审核' : '尚未经过专业审核' }} · {{ source.professionalReview.note }}</text><text class="muted">{{ source.review.scope }}</text><text class="muted">{{ knowledgeSources.find(item => item.id === source.sourceId)?.authorization.note }}</text><text class="muted">{{ source.source.title }} / {{ source.source.locator }}</text><text class="source-url" selectable>{{ source.source.url }}</text></view>
      </view>
      <view class="panel conversation"><text class="title" role="heading" aria-level="2">再聊一点</text><text class="muted">MVP 按本次主题选择知识卡与反思问题；不上传过去对话，不能诊断或治疗。对话仅保留在本页，重新进入会清除。</text>
        <view class="choices" role="group" aria-label="对话视角"><button v-for="mode in (['psychology','tcm','combined'] as const)" :key="mode" :aria-pressed="conversation.mode === mode" :class="{ chosen: conversation.mode === mode }" :disabled="sending || !!consentRequest" @click="selectMode(mode)" role="button" tabindex="0" @keyup.enter.stop.prevent="selectMode(mode)">{{ modeLabel[mode] }}</button></view>
        <view class="choices" role="group" aria-label="服务模式"><button :aria-pressed="serviceMode === 'mock'" :class="{ chosen: serviceMode === 'mock' }" :disabled="sending || !!consentRequest" @click="selectService('mock')" role="button" tabindex="0" @keyup.enter.stop.prevent="selectService('mock')">Mock 本机演示</button><button :aria-pressed="serviceMode === 'llm'" :class="{ chosen: serviceMode === 'llm' }" :disabled="sending || !!consentRequest" @click="selectService('llm')" role="button" tabindex="0" @keyup.enter.stop.prevent="selectService('llm')">可选真实 AI</button></view>
        <view v-for="(message,index) in conversation.messages" :key="index" class="message" :class="message.role"><text class="muted">{{ message.role === 'user' ? '你' : '洞察助手' }}</text><text>{{ message.content }}</text></view>
        <view v-if="insight?.help" class="help" role="alert">{{ insight.help }}</view>
        <textarea v-model="question" aria-label="追问内容" placeholder="例如：我想怎样理解今天的感受？请勿输入姓名、联系方式或其他私人身份信息。" :maxlength="300" :disabled="sending || !!consentRequest" :auto-height="true" />
        <text class="muted">{{ question.length }} / 300 · 可留空，仅生成双视角内容。</text>
        <button class="primary" :disabled="sending || !!consentRequest" @click="prepareRequest" role="button" tabindex="0" @keyup.enter.stop.prevent="prepareRequest">{{ sending ? '正在处理…' : '查看传输摘要并准备调用' }}</button>
        <text class="muted">上方本地预览无需服务。此按钮先读取不含健康信息的服务配置，尚不发送记录。</text>
        <text v-if="feedback" class="feedback" role="status">{{ feedback }}</text>
      </view>
      <view class="panel actions"><text class="title" role="heading" aria-level="2">只选一件，按自己的节奏</text><text class="muted">自选微行动，不是处方或疗效承诺。选择只在本页保留，不写进健康记录。</text>
        <button v-for="action in microActions" :key="action.id" :aria-pressed="selectedAction === action.id" :class="{ chosen: selectedAction === action.id }" @click="selectAction(action.id)" role="button" tabindex="0" @keyup.enter.stop.prevent="selectAction(action.id)"><text>{{ action.title }}</text><text class="muted">{{ action.description }}</text></button><text v-if="selectedAction" class="muted" role="status">已选一项；再次点击可取消，也可以什么都不选。</text>
      </view>
    </view>
    <view v-if="consentRequest" class="consent-mask" @keydown.esc.stop.prevent="cancelConsent">
      <view class="consent-panel" role="dialog" aria-modal="true" aria-label="授权本次摘要传输">
        <text class="title">授权本次摘要传输</text><text>目的地：{{ INSIGHT_API_ORIGIN }}（本机 FastAPI）</text><text v-if="consentRequest.serviceMode === 'llm'">再转发至：{{ serviceInfo?.providerHost }} · 模型 {{ serviceInfo?.model }}。网络服务商的数据保留政策由其决定。</text><text v-else>Mock 模式：仅本机处理，不转发外部模型。</text>
        <text>发送内容：今日四项数值、七日数值及统计、本次问题、视角与模式。下方是确切健康摘要；不含身体备注、时间戳或过去对话。</text><text>服务不保存摘要；本次授权仅用于这一次请求。已发送的内容无法撤回。</text>
        <text class="payload" selectable>{{ preview }}</text>
        <view class="choices"><button ref="cancelButton" :disabled="sending" @click="cancelConsent" role="button" tabindex="0" @keyup.enter.stop.prevent="cancelConsent" @keydown.tab.stop.prevent="focusButton(approveButton)">取消，不发送</button><button ref="approveButton" class="primary" :disabled="sending" @click="authorizeAndSend" role="button" tabindex="0" @keyup.enter.stop.prevent="authorizeAndSend" @keydown.tab.stop.prevent="focusButton(cancelButton)">{{ sending ? '正在请求…' : '明确授权并发送本次摘要' }}</button></view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.insight-page { max-width: 1040px; margin: 0 auto; padding: calc(24px + env(safe-area-inset-top)) 24px 40px; }
.insight-page button { margin: 0; min-height: 44px; cursor: pointer; padding: 11px 15px; border-radius: 11px; background: #eaf0e1; color: #486343; font-size: 13px; }
.insight-page button::after { border: 0; }
.nav { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:35px; }
.nav button { background:transparent; padding-left:0; }
.brand { font-size:22px; font-weight:650; }
.eyebrow,.page-title,.intro,.title,.content,.uncertainty,.citation,.fact,.muted,.notice,.source text,.message text,.consent-panel>text,.feedback { display:block; }
.eyebrow { font-size:10px; letter-spacing:1.5px; color:#7b886f; }
.page-title { font-size:29px; margin:10px 0; font-weight:600; }
.intro { font-size:13px; color:#75806c; margin-bottom:26px; }
.panel { padding:24px; border:1px solid #e0e6d6; border-radius:20px; background:#fffefa; margin:0 0 18px; min-width:0; overflow-wrap:anywhere; }
.title { font-size:18px; font-weight:600; margin-bottom:13px; }
.fact { font-size:13px; margin:10px 0; color:#53664a; }
.muted { color:#78836d; font-size:11px; margin:8px 0; line-height:1.8; }
.badge { display:inline-block; padding:4px 9px; background:#e8efdf; border-radius:6px; color:#536d45; font-size:11px; }
.notice { font-size:12px; margin:12px 0 20px; color:#6e7e60; }
.perspectives { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
.psychology { background:#f0f4e9; }.tcm { background:#f7f2e7; }
.content { font-size:14px; line-height:1.9; }.uncertainty { margin:16px 0 8px; font-size:12px; color:#7f7964; }.citation { font-size:11px; color:#5b7350; }
.source+.source { border-top:1px solid #e7ebdf; padding-top:14px; margin-top:14px; }.source { font-size:12px; }.source-url { color:#526c47; overflow-wrap:anywhere; font-size:11px; }
.choices { display:flex; flex-wrap:wrap; gap:10px; margin:15px 0; }.choices button { flex:1; min-width:70px; }.insight-page .chosen { background:#d9e5cc; box-shadow:inset 0 0 0 1px #8ea77c; }
.insight-page .primary { background:#49664a; color:#fffef8; }.conversation>.primary { width:100%; margin-top:14px; }
textarea { display:block; box-sizing:border-box; width:100%; min-height:110px; padding:14px; background:#f4f6ef; border:1px solid #dce3d0; border-radius:12px; font-size:14px; line-height:1.7; }
.message { padding:14px; border-radius:12px; background:#eef3e7; margin:12px 0; white-space:pre-wrap; }.message.user { background:#f5f0e6; }.feedback,.help,.error { padding:13px; background:#f8eee4; border-radius:11px; color:#886044; font-size:13px; }
.actions button { display:block; text-align:left; width:100%; margin:12px 0; }.actions button text { display:block; }
.consent-mask { position:fixed; inset:0; z-index:100; background:#293c2b88; padding:20px; display:flex; align-items:center; justify-content:center; }
.consent-panel { box-sizing:border-box; max-width:660px; width:100%; max-height:90vh; overflow-y:auto; background:#fffdf7; border-radius:20px; padding:24px; font-size:12px; overflow-wrap:anywhere; }.consent-panel>text { margin-bottom:12px; }.payload { white-space:pre-wrap; font-family:monospace; font-size:11px; padding:12px; background:#f0f3e8; max-height:210px; overflow-y:auto; }
button[disabled] { opacity:.55; cursor:default; }
@media(max-width:720px) { .insight-page { padding-left:20px; padding-right:20px; }.perspectives { grid-template-columns:minmax(0,1fr); gap:0; }.page-title { font-size:25px; }.panel { padding:20px; } }
@media(max-width:360px) { .insight-page { padding-left:15px; padding-right:15px; }.page-title { font-size:22px; }.panel { padding:17px; }.consent-panel { padding:17px; } }
</style>
