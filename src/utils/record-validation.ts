import type { DailyRecordForm, DailyRecordInput, ScaleValue } from '../types/health'
import { isLocalDateKey } from './date'

export const BODY_NOTE_MAX_LENGTH = 500

type ValidationResult =
  | { ok: true; value: DailyRecordInput }
  | { ok: false; message: string }

/** 同时校验表单提交和本地读出的数据，不能只相信 TypeScript 类型。 */
export function validateRecordInput(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, message: '记录格式不正确。' }
  }

  const source = input as Record<string, unknown>
  if (!isLocalDateKey(source.date)) return { ok: false, message: '记录日期不正确，请重新打开页面。' }
  const value: DailyRecordInput = { date: source.date }

  const scales = { mood: '情绪', stress: '压力', energy: '精力' } as const
  for (const key of ['mood', 'stress', 'energy'] as const) {
    const score = source[key]
    if (score === undefined) continue
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
      return { ok: false, message: `${scales[key]}请选择 1–5 中的一项。` }
    }
    value[key] = score as ScaleValue
  }

  if (source.sleepHours !== undefined) {
    const hours = source.sleepHours
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0 || hours > 24) {
      return { ok: false, message: '睡眠时长请输入 0–24 之间的数字。' }
    }
    value.sleepHours = hours
  }

  if (source.bodyNote !== undefined) {
    if (typeof source.bodyNote !== 'string' || source.bodyNote.length > BODY_NOTE_MAX_LENGTH) {
      return { ok: false, message: `身体感受请控制在 ${BODY_NOTE_MAX_LENGTH} 字以内。` }
    }
    const note = source.bodyNote.trim()
    if (note) value.bodyNote = note
  }

  // 不能用 if (sleepHours) 判断是否填写，否则 0 会被误判为空。
  if (Object.keys(value).length === 1) return { ok: false, message: '至少填写一项，再保存今天的记录。' }
  return { ok: true, value }
}

export function parseRecordForm(form: DailyRecordForm, date: string): ValidationResult {
  const sleep = form.sleepHours.trim()
  if (sleep && !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(sleep)) {
    return { ok: false, message: '睡眠时长请输入 0–24 之间的数字，例如 7.5。' }
  }
  return validateRecordInput({
    date,
    mood: form.mood,
    stress: form.stress,
    energy: form.energy,
    sleepHours: sleep === '' ? undefined : Number(sleep),
    bodyNote: form.bodyNote,
  })
}
