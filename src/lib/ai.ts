import type { AiAnalysis, AiSettings, ErrorDraft } from '../types'

const analysisSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string', enum: ['语文', '数学', '英语'] },
    title: { type: 'string' },
    knowledgePoints: { type: 'array', items: { type: 'string' } },
    mistakeType: {
      type: 'string',
      enum: ['概念不清', '审题偏差', '方法不熟', '计算失误', '表达不规范', '知识遗忘', '粗心失误'],
    },
    rootCause: { type: 'string' },
    explanation: { type: 'string' },
    correctSolution: { type: 'string' },
    improvementAdvice: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          hint: { type: 'string' },
        },
        required: ['question', 'answer', 'hint'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'subject',
    'title',
    'knowledgePoints',
    'mistakeType',
    'rootCause',
    'explanation',
    'correctSolution',
    'improvementAdvice',
    'tags',
    'variants',
  ],
  additionalProperties: false,
} as const

function extractOutputText(payload: unknown): string {
  const response = payload as {
    output_text?: string
    output?: Array<{ content?: Array<{ type?: string; text?: string; refusal?: string }> }>
  }
  if (response.output_text) return response.output_text
  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.refusal) throw new Error(`AI 拒绝分析：${content.refusal}`)
      if (content.type === 'output_text' && content.text) return content.text
    }
  }
  throw new Error('AI 未返回可解析的分析结果')
}

export async function analyzeWithAi(
  draft: ErrorDraft,
  settings: AiSettings,
  apiKey: string,
): Promise<AiAnalysis> {
  if (!settings.endpoint.trim()) throw new Error('请先填写 AI 接口地址')
  if (!apiKey.trim()) throw new Error('请在本次会话中填写 API Key')

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)
  const text = [
    `指定学科：${draft.subject}`,
    `年级：${draft.grade}`,
    `题目标题：${draft.title || '未填写'}`,
    `原题：${draft.question || '题目见图片'}`,
    `学生答案：${draft.studentAnswer || '未填写'}`,
    `正确答案：${draft.correctAnswer || '未填写'}`,
    `学生自述原因：${draft.errorHint || '未填写'}`,
  ].join('\n')

  const content: Array<Record<string, string>> = [{ type: 'input_text', text }]
  if (draft.imageDataUrl) content.push({ type: 'input_image', image_url: draft.imageDataUrl })

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        input: [
          {
            role: 'system',
            content:
              '你是熟悉上海初中课程与中考要求的错题分析教师。只基于题目信息分析，不虚构教材出处。定位学生第一次出错的位置，语言适合初中生；给出2道难度递进且有明确答案的同类变式题。若信息不足，在相应字段明确写出需要补充什么。',
          },
          { role: 'user', content },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'shanghai_middle_school_error_analysis',
            strict: true,
            schema: analysisSchema,
          },
        },
        max_output_tokens: 5000,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300)
      throw new Error(`AI 接口请求失败（${response.status}）：${detail}`)
    }
    return JSON.parse(extractOutputText(await response.json())) as AiAnalysis
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI 分析超时，请检查网络或稍后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
