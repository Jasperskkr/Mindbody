// 自动生成：pnpm knowledge:build；请勿手工修改。
import type { KnowledgeCard, KnowledgeDomain } from '../types/insight'
export function rankKnowledge(cards: KnowledgeCard[], tags: string[], question: string, domains: KnowledgeDomain[], topK: Record<KnowledgeDomain, number>): KnowledgeCard[] {
  return domains.flatMap(domain => cards.filter(card => card.domain === domain && card.lifecycle === 'active' && card.review.status === 'source_checked' && card.professionalReview.status !== 'rejected')
    .map(card => ({ card, score: (card.tags.filter(tag => tags.includes(tag)).length + (2 * card.keywords.filter(word => question.includes(word)).length)) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0))
    .slice(0, topK[domain]).map(item => item.card))
}
