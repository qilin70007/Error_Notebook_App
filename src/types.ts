export type Subject = '语文' | '数学' | '英语'

export type MistakeType =
  | '概念不清'
  | '审题偏差'
  | '方法不熟'
  | '计算失误'
  | '表达不规范'
  | '知识遗忘'
  | '粗心失误'

export interface VariantQuestion {
  question: string
  answer: string
  hint: string
}

export interface ErrorItem {
  id: string
  subject: Subject
  title: string
  question: string
  imageDataUrl?: string
  studentAnswer: string
  correctAnswer: string
  source: string
  grade: string
  knowledgePoints: string[]
  mistakeType: MistakeType
  rootCause: string
  explanation: string
  correctSolution: string
  improvementAdvice: string
  variants: VariantQuestion[]
  tags: string[]
  mastered: boolean
  reviewCount: number
  correctCount: number
  createdAt: string
  updatedAt: string
  lastReviewedAt?: string
  analysisMode: 'local' | 'ai'
}

export interface ErrorDraft {
  subject: Subject | '智能判断'
  title: string
  question: string
  imageDataUrl?: string
  studentAnswer: string
  correctAnswer: string
  source: string
  grade: string
  errorHint: string
}

export interface AiAnalysis {
  subject: Subject
  title: string
  knowledgePoints: string[]
  mistakeType: MistakeType
  rootCause: string
  explanation: string
  correctSolution: string
  improvementAdvice: string
  tags: string[]
  variants: VariantQuestion[]
}

export interface AiSettings {
  enabled: boolean
  endpoint: string
  model: string
}

export type ViewKey = 'home' | 'notebook' | 'redo' | 'settings'

export const SUBJECTS: Subject[] = ['语文', '数学', '英语']

export const MISTAKE_TYPES: MistakeType[] = [
  '概念不清',
  '审题偏差',
  '方法不熟',
  '计算失误',
  '表达不规范',
  '知识遗忘',
  '粗心失误',
]
