export type KnowledgeDomain = 'psychology' | 'tcm'
export type KnowledgeReviewStatus = 'draft' | 'source_checked' | 'rejected'
export interface SourceDocument {
  id: string
  version: number
  title: string
  publisher: string
  url: string
  domains: KnowledgeDomain[]
  documentType: 'public_health_guidance' | 'traditional_text' | 'terminology_standard' | 'research_paper'
  lifecycle: 'active' | 'archived'
  verification: { status: 'unverified' | 'source_checked'; checkedAt: string | null; note: string }
  authorization: { status: 'unknown' | 'permitted' | 'restricted'; license: string | null; allowedUses: ('metadata' | 'original_summary' | 'excerpt' | 'full_text')[]; note: string }
}
export interface KnowledgeCard {
  id: string
  domain: KnowledgeDomain
  version: number
  lifecycle: 'active' | 'archived'
  title: string
  tags: string[]
  keywords: string[]
  content: string
  uncertainty: string
  evidenceType: 'public_health_guidance' | 'terminology_standard' | 'traditional_text' | 'modern_research'
  contentOrigin: 'original_summary' | 'licensed_excerpt'
  sourceId: string
  sourceVersion: number
  sourceLocator: string
  review: { status: KnowledgeReviewStatus; checkedAt: string | null; scope: string; version: number }
  professionalReview: { status: 'not_reviewed' | 'approved' | 'rejected'; reviewer: string | null; qualification: string | null; reviewedAt: string | null; note: string }
  /** 发布器根据 sourceId 生成的兼容展示字段，编辑时禁止手工复制。 */
  source: { title: string; publisher: string; url: string; locator: string }
}
/** 只预留契约；本版不切分外部全文，不生成 Embedding。 */
export interface KnowledgeChunk {
  id: string
  domain: KnowledgeDomain
  sourceId: string
  sourceVersion: number
  cardIds: string[]
  version: number
  locator: string
  text: string
  contentHash: string
  lifecycle: 'draft' | 'active' | 'archived'
  embeddingModel: string | null
}
