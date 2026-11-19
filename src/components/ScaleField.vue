<script setup lang="ts">
import type { ScaleValue } from '../types/health'

const props = defineProps<{
  title: string
  direction: string
  labels: readonly string[]
  modelValue?: ScaleValue
  disabled: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ScaleValue | undefined] }>()
const scores: ScaleValue[] = [1, 2, 3, 4, 5]

function select(value: ScaleValue | undefined) {
  if (!props.disabled) emit('update:modelValue', value)
}
</script>

<template>
  <view class="scale-field">
    <view class="field-heading">
      <text class="field-title" role="heading" aria-level="2">{{ title }}</text>
      <text class="optional">可跳过</text>
    </view>
    <text class="direction">{{ direction }}</text>
    <view class="score-grid" role="group" :aria-label="title">
      <button
        v-for="score in scores"
        :key="score"
        class="score-button"
        :class="{ selected: modelValue === score }"
        role="button"
        :tabindex="disabled ? -1 : 0"
        :disabled="disabled"
        :aria-label="`${title} ${score} ${labels[score - 1]}`"
        :aria-pressed="modelValue === score"
        @click="select(score)"
        @keyup.enter.stop.prevent="select(score)"
        @keydown.space.prevent
        @keyup.space.stop.prevent="select(score)"
      >
        <text class="score-number">{{ score }}</text>
        <text class="score-label">{{ labels[score - 1] }}</text>
      </button>
    </view>
    <view class="selection-footer">
      <text class="selection-hint">{{ modelValue === undefined ? '尚未填写' : `已选 ${modelValue} · ${labels[modelValue - 1]}` }}</text>
      <button
        v-if="modelValue !== undefined"
        class="clear-button"
        role="button"
        :tabindex="disabled ? -1 : 0"
        :disabled="disabled"
        :aria-label="`清空${title}`"
        @click="select(undefined)"
        @keyup.enter.stop.prevent="select(undefined)"
        @keydown.space.prevent
        @keyup.space.stop.prevent="select(undefined)"
      >清空</button>
    </view>
  </view>
</template>

<style scoped>
.scale-field {
  padding: 22px 0;
  border-bottom: 1px solid #e9ece1;
}

.field-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.field-title {
  font-size: 17px;
  font-weight: 600;
}

.optional {
  font-size: 11px;
  color: #74806a;
}

.direction {
  display: block;
  font-size: 12px;
  color: #68735f;
  margin-top: 6px;
}

.score-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.score-button {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 12px 2px;
  border-radius: 12px;
  background: #f3f5ed;
  border: 1px solid #e3e8d8;
  color: #52644b;
  cursor: pointer;
}

.score-button.selected {
  background: #e4eddc;
  border-color: #5d7c50;
  color: #304f29;
}

.score-number, .score-label {
  display: block;
}

.score-number {
  font-size: 22px;
  line-height: 1.3;
  font-weight: 600;
}

.score-label {
  font-size: 12px;
  margin-top: 6px;
}

.selection-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  margin-top: 6px;
}

.selection-hint {
  font-size: 11px;
  color: #6d7865;
}

.clear-button {
  margin: 0;
  background: transparent;
  color: #536c47;
  padding: 6px 10px;
  min-height: 36px;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}

.score-button::after, .clear-button::after {
  border: 0;
}

.score-button:focus-visible, .clear-button:focus-visible {
  outline: 3px solid #a56b34;
  outline-offset: 3px;
}

@media (max-width: 360px) {
  .score-grid {
    gap: 5px;
  }
  .score-label {
    font-size: 10px;
  }
}
</style>
