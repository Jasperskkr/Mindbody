<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
const props = defineProps<{ title: string; message: string; confirmLabel: string; busy: boolean }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const cancelButton = ref<unknown>(null)
const confirmButton = ref<unknown>(null)

// H5 聚焦取消按钮；其他端没有 focus 方法时不调用浏览器专用 API。
function focusButton(button: unknown) {
  const target = button as { $el?: { focus?: () => void }; focus?: () => void } | null
  const element = target?.$el ?? target
  element?.focus?.()
}
function cancel() { if (!props.busy) emit('cancel') }
function confirm() { if (!props.busy) emit('confirm') }
onMounted(() => { void nextTick(() => focusButton(cancelButton.value)) })
</script>

<template>
  <view class="confirmation-mask" @click.self="cancel" @keydown.esc.stop.prevent="cancel">
    <view class="confirmation" role="alertdialog" aria-modal="true" :aria-label="title" aria-describedby="confirm-message">
      <text class="title">{{ title }}</text>
      <text id="confirm-message" class="message">{{ message }}</text>
      <view class="actions">
        <button ref="cancelButton" class="cancel" role="button" tabindex="0" :disabled="busy"
          @click="cancel" @keyup.enter.stop.prevent="cancel" @keydown.space.prevent @keyup.space.stop.prevent="cancel"
          @keydown.tab.stop.prevent="focusButton(confirmButton)"
        >取消</button>
        <button ref="confirmButton" class="confirm" role="button" tabindex="0" :disabled="busy"
          @click="confirm" @keyup.enter.stop.prevent="confirm" @keydown.space.prevent @keyup.space.stop.prevent="confirm"
          @keydown.tab.stop.prevent="focusButton(cancelButton)"
        >{{ busy ? '正在处理…' : confirmLabel }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.confirmation-mask { position: fixed; inset: 0; z-index: 100; background: #26382988; display: flex; align-items: center; justify-content: center; padding: 20px; }
.confirmation { width: 100%; max-width: 420px; border-radius: 20px; padding: 24px; background: #fffdf7; box-shadow: 0 14px 50px #22332233; }
.title, .message { display: block; }
.title { font-size: 20px; font-weight: 600; color: #465a40; }
.message { color: #727965; font-size: 13px; margin-top: 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
.actions { display: flex; gap: 12px; margin-top: 24px; }
.actions button { flex: 1; min-width: 0; padding: 12px 8px; min-height: 44px; border-radius: 10px; cursor: pointer; font-size: 13px; }
.actions button { margin: 0; }
.actions button::after { border: 0; }
.cancel { background: #e9efdf; color: #455e3a; }
.confirm { background: #f6e8de; color: #985339; }
</style>
