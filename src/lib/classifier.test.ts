import { describe, expect, it } from 'vitest'
import { analyzeLocally, detectKnowledgePoints, detectSubject } from './classifier'

describe('local classifier', () => {
  it('detects the three supported subjects', () => {
    expect(detectSubject('解方程 2x + 3 = 9')).toBe('数学')
    expect(detectSubject('Choose the correct verb: He has lived here since 2020.')).toBe('英语')
    expect(detectSubject('阅读下面文言文，解释加点词')).toBe('语文')
  })

  it('extracts knowledge points', () => {
    expect(detectKnowledgePoints('数学', '一次方程求未知数')).toContain('方程与不等式')
    expect(detectKnowledgePoints('英语', '现在完成时 since')).toContain('动词时态')
  })

  it('falls back to local analysis without remote AI', () => {
    const result = analyzeLocally({
      subject: '数学',
      title: '',
      question: '解方程 2x+3=9',
      studentAnswer: 'x=2',
      correctAnswer: 'x=3',
      source: '校内练习',
      grade: '六年级',
      errorHint: '计算时粗心看错符号',
    })
    expect(result.subject).toBe('数学')
    expect(result.mistakeType).toBe('粗心失误')
    expect(result.variants).toHaveLength(2)
  })
})
