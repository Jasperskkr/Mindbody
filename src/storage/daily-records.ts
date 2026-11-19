import type { DailyRecord, DailyRecordInput } from '../types/health'
import { isLocalDateKey } from '../utils/date'
import { validateRecordInput } from '../utils/record-validation'

const STORAGE_PREFIX = 'mindbody:daily-record:v1:'
const READ_ERROR = '读取本地记录失败，请重试。为保护已有记录，读取成功前暂时不能保存。'
const FORMAT_ERROR = '本地记录格式异常，暂时无法读取。原数据未改动，请勿清理浏览器数据。'

function storageKey(date: string): string {
  if (!isLocalDateKey(date)) throw new Error('记录日期不正确，请重新打开页面。')
  return `${STORAGE_PREFIX}${date}`
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export async function loadDailyRecord(date: string): Promise<DailyRecord | null> {
  const key = storageKey(date)
  // 先区分“没有记录”和“无法读取”。H5 的 getStorageSync 会把部分失败变成空字符串。
  const keys = await new Promise<string[]>((resolve, reject) => {
    uni.getStorageInfo({
      success: (result) => resolve(result.keys),
      fail: () => reject(new Error(READ_ERROR)),
    })
  }).catch(() => { throw new Error(READ_ERROR) })
  if (!keys.includes(key)) return null

  const raw = await new Promise<unknown>((resolve, reject) => {
    uni.getStorage({
      key,
      success: (result) => resolve(result.data),
      fail: () => reject(new Error(READ_ERROR)),
    })
  }).catch(() => { throw new Error(READ_ERROR) })

  try {
    if (typeof raw !== 'string') throw new Error(FORMAT_ERROR)
    const envelope = JSON.parse(raw)
    if (envelope?.version !== 1) throw new Error(FORMAT_ERROR)
    const result = validateRecordInput(envelope.record)
    if (!result.ok || result.value.date !== date) throw new Error(FORMAT_ERROR)
    if (!isTimestamp(envelope.record.createdAt) || !isTimestamp(envelope.record.updatedAt)) {
      throw new Error(FORMAT_ERROR)
    }
    return { ...result.value, createdAt: envelope.record.createdAt, updatedAt: envelope.record.updatedAt }
  } catch {
    throw new Error(FORMAT_ERROR)
  }
}

export async function saveDailyRecord(input: DailyRecordInput): Promise<DailyRecord> {
  const result = validateRecordInput(input)
  if (!result.ok) throw new Error(result.message)

  // 保存前再次读取；读取失败时绝不覆盖，也保留同一天首次保存的 createdAt。
  const existing = await loadDailyRecord(result.value.date)
  const timestamp = new Date().toISOString()
  const record: DailyRecord = {
    ...result.value,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  await new Promise<void>((resolve, reject) => {
    uni.setStorage({
      key: storageKey(record.date),
      data: JSON.stringify({ version: 1, record }),
      success: () => resolve(),
      fail: () => reject(new Error('保存失败，输入内容仍保留在页面。请检查本地存储空间或浏览器权限后重试。')),
    })
  }).catch(() => {
    throw new Error('保存失败，输入内容仍保留在页面。请检查本地存储空间或浏览器权限后重试。')
  })
  return record
}
