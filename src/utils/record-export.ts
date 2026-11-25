import type { DailyRecord, RecordExport } from '../types/health'
import { validateDailyRecord } from './record-validation'

export function createRecordExport(records: readonly DailyRecord[], exportedAt = new Date().toISOString()): RecordExport {
  if (!Number.isFinite(Date.parse(exportedAt))) throw new Error('导出时间格式不正确。')
  const dates = new Set<string>()
  const checked = records.map((record) => {
    const result = validateDailyRecord(record)
    if (!result.ok) throw new Error(`导出失败：存在不完整或损坏记录。${result.message}`)
    if (dates.has(result.value.date)) throw new Error('导出失败：同一天出现重复记录。')
    dates.add(result.value.date)
    return result.value
  }).sort((a, b) => b.date.localeCompare(a.date))
  return { schemaVersion: 1, exportedAt, records: checked }
}

export function serializeRecordExport(records: readonly DailyRecord[], exportedAt?: string): string {
  return JSON.stringify(createRecordExport(records, exportedAt), null, 2)
}
