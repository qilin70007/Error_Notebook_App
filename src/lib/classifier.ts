import type { AiAnalysis, ErrorDraft, MistakeType, Subject, VariantQuestion } from '../types'

const subjectKeywords: Record<Subject, string[]> = {
  语文: ['文言', '诗歌', '阅读', '作文', '修辞', '病句', '拼音', '成语', '主旨', '人物形象'],
  数学: ['方程', '函数', '几何', '三角形', '圆', '因式', '分式', '概率', '统计', '证明'],
  英语: ['时态', '语法', '阅读理解', '完形', '首字母', '词汇', '句型', '翻译', '作文', '动词'],
}

const knowledgeRules: Record<Subject, Array<[RegExp, string]>> = {
  语文: [
    [/文言|实词|虚词|翻译/, '文言文阅读'],
    [/诗|意象|炼字/, '古诗词鉴赏'],
    [/作文|写作|立意/, '写作'],
    [/病句|成语|拼音|字形/, '语言基础'],
    [/主旨|人物|阅读|作用/, '现代文阅读'],
  ],
  数学: [
    [/方程|等式|未知数/, '方程与不等式'],
    [/函数|坐标|图像|斜率/, '函数与图像'],
    [/三角形|四边形|圆|角|证明/, '几何证明'],
    [/因式|分式|整式|根式/, '代数式'],
    [/概率|统计|平均数|中位数/, '统计与概率'],
  ],
  英语: [
    [/时态|tense|since|already|yesterday/, '动词时态'],
    [/从句|clause|which|that|who/, '复合句'],
    [/完形|cloze/, '完形填空'],
    [/阅读|passage|main idea/, '阅读理解'],
    [/写作|作文|composition/, '英语写作'],
    [/词汇|单词|vocabulary|phrase/, '词汇与搭配'],
  ],
}

export function detectSubject(text: string): Subject {
  const normalized = text.toLowerCase()
  const scores: Record<Subject, number> = { 语文: 0, 数学: 0, 英语: 0 }

  for (const subject of Object.keys(subjectKeywords) as Subject[]) {
    for (const keyword of subjectKeywords[subject]) {
      if (normalized.includes(keyword.toLowerCase())) scores[subject] += 3
    }
  }

  const latinLetters = (normalized.match(/[a-z]/g) ?? []).length
  const mathTokens = (normalized.match(/[0-9=+\-×÷*/^√∠]/g) ?? []).length
  const mathOperators = (normalized.match(/[=+\-×÷*/^√∠]/g) ?? []).length
  if (latinLetters >= 8) scores.英语 += 4
  if (mathTokens >= 3 && mathOperators >= 1) scores.数学 += 4
  if (/下列|作者|段落|赏析|解释加点/.test(normalized)) scores.语文 += 3

  return (Object.entries(scores) as Array<[Subject, number]>).sort((a, b) => b[1] - a[1])[0][0]
}

export function detectKnowledgePoints(subject: Subject, text: string): string[] {
  const matches = knowledgeRules[subject]
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label)
  if (matches.length) return [...new Set(matches)].slice(0, 3)
  return [subject === '语文' ? '综合阅读' : subject === '数学' ? '综合运用' : '综合语言运用']
}

export function detectMistakeType(text: string, subject: Subject): MistakeType {
  if (/粗心|看错|抄错|漏写|符号/.test(text)) return '粗心失误'
  if (/审题|条件|题意|理解错/.test(text)) return '审题偏差'
  if (/忘|不会|没记住/.test(text)) return '知识遗忘'
  if (/步骤|格式|单位|表达/.test(text)) return '表达不规范'
  if (subject === '数学' && /算错|计算/.test(text)) return '计算失误'
  if (/概念|定义|混淆/.test(text)) return '概念不清'
  return '方法不熟'
}

function localVariants(subject: Subject, knowledgePoint: string): VariantQuestion[] {
  const variants: Record<Subject, VariantQuestion[]> = {
    语文: [
      {
        question: `找一道同类“${knowledgePoint}”题，先圈出题干限定词，再用“依据＋结论”作答。`,
        answer: '答案应同时包含文本依据和明确结论，避免只写感受。',
        hint: '先定位原文，再组织答案。',
      },
      {
        question: `把原题换一个设问角度：说明该内容对人物、结构或主旨的作用。`,
        answer: '从内容、结构、主旨中选择与文本匹配的角度作答。',
        hint: '不要套用全部术语，只写有文本依据的作用。',
      },
    ],
    数学: [
      {
        question: `保持“${knowledgePoint}”方法不变，改变原题中的一个数值或条件，重新完整求解。`,
        answer: '按原题的正确方法重新计算，并检查定义域、单位和符号。',
        hint: '先写依据，再代入计算。',
      },
      {
        question: '反向思考：已知原题结论成立，至少写出一个必需条件，并说明理由。',
        answer: '条件应能由所用定理或公式反推得到，理由与条件一一对应。',
        hint: '从最后一步往前倒推。',
      },
    ],
    英语: [
      {
        question: `围绕“${knowledgePoint}”仿写两个句子：一个肯定句，一个疑问句。`,
        answer: '检查主谓一致、时态标志词和动词形式。',
        hint: '先确定时间，再确定谓语形式。',
      },
      {
        question: '把原句的主语改为第三人称单数，并作必要变化。',
        answer: '根据时态调整助动词和实义动词，其他成分保持语义连贯。',
        hint: '特别检查 does/has/is 与动词形式。',
      },
    ],
  }
  return variants[subject]
}

export function analyzeLocally(draft: ErrorDraft): AiAnalysis {
  const combined = [draft.title, draft.question, draft.studentAnswer, draft.correctAnswer, draft.errorHint].join('\n')
  const subject = draft.subject === '智能判断' ? detectSubject(combined) : draft.subject
  const knowledgePoints = detectKnowledgePoints(subject, combined)
  const mistakeType = detectMistakeType(draft.errorHint || combined, subject)
  const firstPoint = knowledgePoints[0]

  return {
    subject,
    title: draft.title.trim() || `${firstPoint}错题`,
    knowledgePoints,
    mistakeType,
    rootCause: draft.errorHint.trim() || `对“${firstPoint}”的判断步骤不够稳定，需要结合原题复盘。`,
    explanation: `本地分析已将本题归入“${firstPoint}”。建议先核对题目条件、所用规则和答案表达，找出第一次出现偏差的位置。`,
    correctSolution: draft.correctAnswer.trim() || '请补充标准答案；也可以配置 AI 后重新分析，生成完整解题过程。',
    improvementAdvice: `建立“条件—方法—检查”三步习惯：圈出条件，写明所用${subject === '数学' ? '公式或定理' : '规则或依据'}，完成后反向检查。`,
    tags: [subject, firstPoint, mistakeType],
    variants: localVariants(subject, firstPoint),
  }
}
