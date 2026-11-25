import type { DailyRecord, DailyRecordInput, StorageErrorCode } from '../types/health'
import { isLocalDateKey } from '../utils/date'
import { validateDailyRecord, validateRecordInput } from '../utils/record-validation'

const STORAGE_PREFIX = 'mindbody:daily-record:v1:'
const READ_ERROR = '读取本地记录失败，请重试。为保护已有记录，读取成功前暂时不能保存。'

export class DailyRecordStorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
    public readonly date?: string,
    public readonly deletedCount = 0,
  ) {
    super(message)
    this.name = 'DailyRecordStorageError'
  }
}

function storageKey(date: string): string {
  if (!isLocalDateKey(date)) {
    throw new DailyRecordStorageError('INVALID_DATE', '记录日期不正确，请检查记录日期后重试。', date)
  }
  return `${STORAGE_PREFIX}${date}`
}

async function storageKeys(): Promise<string[]> {
  // 只枚举键以定位本应用记录，不读取其他应用的值。
  return new Promise<string[]>((resolve, reject) => {
    uni.getStorageInfo({
      success: (result) => resolve(result.keys),
      fail: reject,
    })
  }).catch(() => { throw new DailyRecordStorageError('READ_FAILED', READ_ERROR) })
}

async function readStoredRecord(date: string): Promise<DailyRecord> {
  const raw = await new Promise<unknown>((resolve, reject) => {
    uni.getStorage({
      key: storageKey(date),
      success: (result) => resolve(result.data),
      fail: reject,
    })
  }).catch(() => { throw new DailyRecordStorageError('READ_FAILED', `${date}：${READ_ERROR}`, date) })

  try {
    if (typeof raw !== 'string') throw new Error()
    const envelope = JSON.parse(raw)
    if (envelope?.version !== 1) throw new Error()
    const result = validateDailyRecord(envelope.record)
    if (!result.ok || result.value.date !== date) throw new Error()
    return result.value
  } catch {
    throw new DailyRecordStorageError('CORRUPT_RECORD', `${date}：本地记录格式异常，原数据未改动。请勿清理浏览器数据。`, date)
  }
}

export async function loadDailyRecord(date: string): Promise<DailyRecord | null> {
  const key = storageKey(date)
  if (!(await storageKeys()).includes(key)) return null
  return readStoredRecord(date)
}

export async function saveDailyRecord(input: DailyRecordInput): Promise<DailyRecord> {
  const result = validateRecordInput(input)
  if (!result.ok) throw new DailyRecordStorageError('INVALID_RECORD', result.message)

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
    throw new DailyRecordStorageError('WRITE_FAILED', '保存失败，输入内容仍保留在页面。请检查本地存储空间或浏览器权限后重试。', record.date)
  })
  return record
}

export async function listDailyRecords(): Promise<DailyRecord[]> {
  const dates = (await storageKeys()).filter((key) => key.startsWith(STORAGE_PREFIX)).map((key) => {
    const date = key.slice(STORAGE_PREFIX.length)
    storageKey(date) // 专用前缀下的非法键必须报错，不能悄悄漏掉。
    return date
  }).sort().reverse()
  return Promise.all(dates.map(readStoredRecord))
}

export async function deleteDailyRecord(date: string): Promise<boolean> {
  const key = storageKey(date)
  if (await loadDailyRecord(date) === null) return false
  // 只删除指定的、已校验的专用键；绝不调用 clearStorage。
  try {
    await new Promise<void>((resolve, reject) => {
      uni.removeStorage({ key, success: () => resolve(), fail: reject })
    })
    if ((await storageKeys()).includes(key)) throw new Error()
    return true
  } catch {
    throw new DailyRecordStorageError('DELETE_FAILED', `${date}：删除失败或无法确认删除结果，请重新读取记录后重试。`, date)
  }
}

export async function deleteAllDailyRecords(): Promise<number> {
  // 全部预检成功才开始删除；预检失败时不触碰任何一条记录。
  const records = await listDailyRecords()
  let deletedCount = 0
  try {
    for (const record of records) {
      const current = await loadDailyRecord(record.date)
      if (current && JSON.stringify(current) !== JSON.stringify(record)) {
        throw new Error('记录在操作期间发生变化，已停止继续删除。')
      }
      if (await deleteDailyRecord(record.date)) deletedCount += 1
    }
    if ((await listDailyRecords()).length !== 0) throw new Error('发现操作期间新增的记录，请重新读取后再决定是否删除。')
    return deletedCount
  } catch (error) {
    const reason = error instanceof Error ? error.message : '请重试。'
    throw new DailyRecordStorageError('DELETE_FAILED', `清空未完成，已确认删除 ${deletedCount} 条。${reason} 请重新读取当前状态。`, undefined, deletedCount)
  }
}
