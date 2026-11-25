import type { TrendMetricId } from './health'

export type KnowledgeDomain = 'psychology' | 'tcm'
export type KnowledgeReviewStatus = 'draft' | 'source_checked' | 'rejected'
export type ConversationMode = KnowledgeDomain | 'combined'
export type InsightServiceMode = 'mock' | 'llm'
export type InsightMetrics = Record<TrendMetricId, number | null>
export interface ContextSample { date: string; values: InsightMetrics }
export interface MetricSummary {
  count: number
  average: number | null
  first: number | null
  last: number | null
  change: number | null
}
/** 仅必要的结构化摘要：不包含备注、时间戳或用户标识。 */
export interface DailyContext {
  schemaVersion: 1
  date: string
  today: InsightMetrics | null
  samples: ContextSample[]
  window: { startDate: string; endDate: string; days: 7; recordCount: number; metrics: Record<TrendMetricId, MetricSummary> }
}
export interface KnowledgeCard {
  id: string
  domain: KnowledgeDomain
  title: string
  tags: string[]
  keywords: string[]
  content: string
  uncertainty: string
  evidenceType: 'public_health_guidance' | 'terminology_standard' | 'traditional_text'
  review: { status: KnowledgeReviewStatus; checkedAt: string; scope: string; version: 1 }
  source: { title: string; publisher: string; url: string; locator: string }
}
export interface InsightPerspective {
  domain: KnowledgeDomain
  title: string
  text: string
  citationIds: string[]
  uncertainty: string
}
export interface DailyInsight {
  schemaVersion: 1
  date: string
  status: 'local_preview' | 'mock' | 'llm' | 'fallback' | 'blocked' | 'empty'
  perspectives: InsightPerspective[]
  reply: string
  notice: string
  help: string | null
}
export interface InsightConversation {
  mode: ConversationMode
  messages: { role: 'user' | 'assistant'; content: string }[]
}
export interface MicroAction { id: string; title: string; description: string }
export interface InsightRequest {
  context: DailyContext
  mode: ConversationMode
  serviceMode: InsightServiceMode
  question: string
  consent: { granted: true; scope: 'daily-summary-and-question-v1'; providerHost: string | null; model: string | null }
}
export interface ServiceInfo {
  schemaVersion: 1
  defaultMode: 'mock'
  llmEnabled: boolean
  providerHost: string | null
  model: string | null
  storesHealthData: false
}
