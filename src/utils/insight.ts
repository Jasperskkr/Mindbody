import psychology from '../../knowledge/psychology.json'
import tcm from '../../knowledge/tcm.json'
import type { ConversationMode, DailyContext, DailyInsight, InsightPerspective, KnowledgeCard, MicroAction } from '../types/insight'
import { contextFacts, metricIds } from './daily-context'

export const knowledgeCards = [...psychology, ...tcm] as KnowledgeCard[]
export const microActions: MicroAction[] = [
  { id: 'notice', title: '给此刻的感受起个名字', description: '用一个自己觉得贴切的词描述当下，可以随时停止，不必改变它。' },
  { id: 'pause', title: '留一分钟安静的空隙', description: '在安全、舒适的位置稍作停顿，留意周围。不舒服时就停止。' },
  { id: 'prepare', title: '为休息做一个小准备', description: '选择收起屏幕或整理休息环境中的一件小事，由自己决定何时做。' },
]

export function retrieveCards(context: DailyContext, mode: ConversationMode, question = '', cards = knowledgeCards): KnowledgeCard[] {
  if (!context.today) return []
  const tags = metricIds.filter((id) => context.today![id] !== null)
  return cards.filter((card) => card.review.status === 'source_checked' && (mode === 'combined' || card.domain === mode))
    .map((card) => ({ card, score: card.tags.filter((tag) => tags.includes(tag as typeof tags[number])).length
      + card.keywords.filter((word) => question.includes(word)).length * 2 }))
    .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id))
    .slice(0, 4).map(({ card }) => card)
}

export function localInsight(context: DailyContext): DailyInsight {
  const cards = retrieveCards(context, 'combined')
  const perspectives: InsightPerspective[] = (['psychology', 'tcm'] as const).map((domain) => {
    const selected = cards.find((card) => card.domain === domain)
    return { domain, title: domain === 'psychology' ? '心理学视角' : '中医理论视角',
      text: selected?.content ?? '暂无匹配的已审核知识，不强行解释。', citationIds: selected ? [selected.id] : [],
      uncertainty: selected?.uncertainty ?? '当前检索没有结果。' }
  })
  return { schemaVersion: 1, date: context.date, status: context.today ? 'local_preview' : 'empty', perspectives,
    reply: contextFacts(context).join('\n'), notice: '本地教育预览 · 未调用 AI、未发送数据。两种视角独立呈现，不能互相推导。', help: null }
}

/** 网络响应也不可信：仅允许已审核原文和本次候选引用，拒绝自由生成的健康结论。 */
export function validateInsight(input: unknown, context: DailyContext, mode: ConversationMode, candidates: KnowledgeCard[]): DailyInsight {
  const result = input as DailyInsight
  if (!result || result.schemaVersion !== 1 || result.date !== context.date
    || !['mock', 'llm', 'fallback', 'blocked', 'empty'].includes(result.status)
    || typeof result.reply !== 'string' || typeof result.notice !== 'string'
    || !(result.help === null || typeof result.help === 'string') || !Array.isArray(result.perspectives)) throw new Error('服务返回格式不正确，已保留本地预览。')
  const domains = mode === 'combined' ? ['psychology', 'tcm'] : [mode]
  if (new Set(result.perspectives.map((item) => item.domain)).size !== result.perspectives.length) throw new Error('洞察视角重复。')
  if (result.status !== 'blocked' && result.status !== 'empty' && result.perspectives.length !== domains.length) throw new Error('洞察视角不完整。')
  for (const perspective of result.perspectives) {
    if (!domains.includes(perspective.domain) || !Array.isArray(perspective.citationIds) || perspective.citationIds.length > 1) throw new Error('洞察视角或引用不正确。')
    if (perspective.citationIds.length) {
      const card = candidates.find((item) => item.id === perspective.citationIds[0] && item.domain === perspective.domain)
      if (!card || perspective.text !== card.content || perspective.uncertainty !== card.uncertainty) throw new Error('引用或解释未通过校验，已拒绝显示。')
    } else if (perspective.text !== '暂无匹配的已审核知识，不强行解释。') throw new Error('无出处的解释已被拒绝。')
  }
  const dangerous = /你(?:患有|属于|就是)|诊断为|建议服用|服用.{0,12}(?:克|毫克)|停药|治疗方案|长期趋势|PHQ.?9|GAD.?7|气虚证|肝郁证/i
  if (dangerous.test(`${result.reply} ${result.notice} ${result.help ?? ''}`)) throw new Error('服务输出超出健康教育范围，已拒绝显示。')
  if (/\d/.test(result.reply)) throw new Error('服务回复不应生成记录数字，统计请查看程序计算结果。')
  return result
}
