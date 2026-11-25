import type { DailyContext, DailyInsight, ConversationMode, InsightRequest, ServiceInfo } from '../types/insight'
import { knowledgeHash, retrieveCards, validateInsight } from '../utils/insight'

export const INSIGHT_API_ORIGIN = 'http://127.0.0.1:8000'

function request<T>(path: string, data?: InsightRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({ url: `${INSIGHT_API_ORIGIN}${path}`, method: data === undefined ? 'GET' : 'POST', data,
      timeout: 25000, header: { 'Content-Type': 'application/json' },
      success: (response) => response.statusCode === 200 ? resolve(response.data as T)
        : reject(new Error(response.statusCode === 409 ? '服务的知识库或模型配置已变化，请重新加载并授权。'
          : response.statusCode === 503 ? '知识服务需构建并重启，当前未生成新回应；本地预览仍可阅读。' : '洞察服务拒绝请求，请重新读取数据并检查授权。')),
      fail: () => reject(new Error('无法连接本机洞察服务，或等待超时。本地预览仍可使用，请检查服务是否启动。')),
    })
  })
}

/** 此 GET 没有记录、查询或用户信息，只有点击准备调用时才发出。 */
export async function loadServiceInfo(): Promise<ServiceInfo> {
  const info = await request<ServiceInfo>('/api/insight/info')
  if (info.schemaVersion !== 1 || info.defaultMode !== 'mock' || info.storesHealthData !== false
    || typeof info.llmEnabled !== 'boolean' || (info.llmEnabled && (!info.providerHost || !info.model))) throw new Error('服务配置格式异常，暂不发送记录。')
  if (info.knowledgeHash !== knowledgeHash) throw new Error('知识库版本不一致，请重新加载网页并重启 API；未发送记录。')
  return info
}

export async function requestInsight(input: InsightRequest): Promise<DailyInsight> {
  // 在请求函数中再次检查，避免 UI 外的调用遗漏授权。
  if (input.consent?.granted !== true || input.consent.scope !== 'daily-summary-and-question-v1') throw new Error('尚未授权，未发送任何记录。')
  if (!input.context.today) throw new Error('没有今日记录，未发送数据。')
  if (input.knowledgeHash !== undefined && input.knowledgeHash !== knowledgeHash) throw new Error('授权摘要中的知识版本已过期，未发送记录。')
  const response = await request<unknown>('/api/insight', { ...input, knowledgeHash })
  return validateInsight(response, input.context, input.mode, retrieveCards(input.context, input.mode, input.question))
}

export function consentPreview(context: DailyContext, mode: ConversationMode, question: string): string {
  return JSON.stringify({ context, mode, question }, null, 2)
}
