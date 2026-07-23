import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileDown,
  Filter,
  Home,
  LoaderCircle,
  Menu,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { analyzeWithAi } from './lib/ai'
import { analyzeLocally } from './lib/classifier'
import {
  downloadBackup,
  loadItems,
  loadSessionApiKey,
  loadSettings,
  parseBackup,
  saveItems,
  saveSessionApiKey,
  saveSettings,
} from './lib/storage'
import type { AiAnalysis, ErrorDraft, ErrorItem, Subject, ViewKey } from './types'
import { MISTAKE_TYPES, SUBJECTS } from './types'

const subjectStyle: Record<Subject, { short: string; className: string }> = {
  语文: { short: '文', className: 'chinese' },
  数学: { short: '数', className: 'math' },
  英语: { short: '英', className: 'english' },
}

const navItems: Array<{ key: ViewKey; label: string; icon: typeof Home }> = [
  { key: 'home', label: '学习概览', icon: Home },
  { key: 'notebook', label: '我的错题', icon: BookOpen },
  { key: 'redo', label: '重做练习', icon: RotateCcw },
  { key: 'settings', label: '设置与备份', icon: Settings },
]

const emptyDraft: ErrorDraft = {
  subject: '智能判断',
  title: '',
  question: '',
  studentAnswer: '',
  correctAnswer: '',
  source: '',
  grade: '七年级',
  errorHint: '',
}

function createItem(draft: ErrorDraft, analysis: AiAnalysis, previous?: ErrorItem, mode: 'local' | 'ai' = 'local'): ErrorItem {
  const now = new Date().toISOString()
  return {
    id: previous?.id ?? crypto.randomUUID(),
    subject: analysis.subject,
    title: analysis.title,
    question: draft.question.trim(),
    imageDataUrl: draft.imageDataUrl,
    studentAnswer: draft.studentAnswer.trim(),
    correctAnswer: draft.correctAnswer.trim() || analysis.correctSolution,
    source: draft.source.trim() || '未填写来源',
    grade: draft.grade,
    knowledgePoints: analysis.knowledgePoints,
    mistakeType: analysis.mistakeType,
    rootCause: analysis.rootCause,
    explanation: analysis.explanation,
    correctSolution: analysis.correctSolution,
    improvementAdvice: analysis.improvementAdvice,
    variants: analysis.variants.slice(0, 3),
    tags: [...new Set(analysis.tags)],
    mastered: previous?.mastered ?? false,
    reviewCount: previous?.reviewCount ?? 0,
    correctCount: previous?.correctCount ?? 0,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    lastReviewedAt: previous?.lastReviewedAt,
    analysisMode: mode,
  }
}

function draftFromItem(item: ErrorItem): ErrorDraft {
  return {
    subject: item.subject,
    title: item.title,
    question: item.question,
    imageDataUrl: item.imageDataUrl,
    studentAnswer: item.studentAnswer,
    correctAnswer: item.correctAnswer,
    source: item.source,
    grade: item.grade,
    errorHint: item.rootCause,
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function App() {
  const [items, setItems] = useState<ErrorItem[]>(loadItems)
  const [settings, setSettings] = useState(loadSettings)
  const [apiKey, setApiKey] = useState(loadSessionApiKey)
  const [view, setView] = useState<ViewKey>('home')
  const [mobileNav, setMobileNav] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ErrorDraft>(emptyDraft)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<Subject | '全部'>('全部')
  const [mistakeFilter, setMistakeFilter] = useState('全部错因')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [redoSubject, setRedoSubject] = useState<Subject | '全部'>('全部')
  const [redoQueue, setRedoQueue] = useState<ErrorItem[]>([])
  const [redoIndex, setRedoIndex] = useState(0)
  const [redoRevealed, setRedoRevealed] = useState(false)
  const backupInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!saveItems(items)) {
      setToast({ text: '本机存储空间不足，请先导出备份并删除过大的题目图片', kind: 'error' })
    }
  }, [items])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveSessionApiKey(apiKey), [apiKey])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...items]
      .filter((item) => subjectFilter === '全部' || item.subject === subjectFilter)
      .filter((item) => mistakeFilter === '全部错因' || item.mistakeType === mistakeFilter)
      .filter((item) => {
        if (!normalized) return true
        return [item.title, item.question, item.source, item.rootCause, ...item.knowledgePoints, ...item.tags]
          .join(' ')
          .toLowerCase()
          .includes(normalized)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [items, query, subjectFilter, mistakeFilter])

  const stats = useMemo(() => {
    const pending = items.filter((item) => !item.mastered).length
    const mastered = items.filter((item) => item.mastered).length
    const reviewed = items.reduce((sum, item) => sum + item.reviewCount, 0)
    const weaknessMap = new Map<string, number>()
    items.filter((item) => !item.mastered).forEach((item) => {
      item.knowledgePoints.forEach((point) => weaknessMap.set(point, (weaknessMap.get(point) ?? 0) + 1))
    })
    const weaknesses = [...weaknessMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    return { pending, mastered, reviewed, weaknesses }
  }, [items])

  const notify = (text: string, kind: 'ok' | 'error' = 'ok') => setToast({ text, kind })

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft)
    setShowEditor(true)
  }

  const openEdit = (item: ErrorItem) => {
    setEditingId(item.id)
    setDraft(draftFromItem(item))
    setShowEditor(true)
  }

  const submitDraft = async () => {
    if (!draft.question.trim() && !draft.imageDataUrl) {
      notify('请填写题目文字或上传题目图片', 'error')
      return
    }
    setIsAnalyzing(true)
    try {
      let analysis: AiAnalysis
      let mode: 'local' | 'ai' = 'local'
      if (settings.enabled && apiKey.trim()) {
        try {
          analysis = await analyzeWithAi(draft, settings, apiKey)
          mode = 'ai'
        } catch (error) {
          analysis = analyzeLocally(draft)
          notify(`在线 AI 暂不可用，已用本地规则完成整理：${error instanceof Error ? error.message : '未知错误'}`, 'error')
        }
      } else {
        analysis = analyzeLocally(draft)
      }

      const previous = editingId ? items.find((item) => item.id === editingId) : undefined
      const saved = createItem(draft, analysis, previous, mode)
      setItems((current) => (previous ? current.map((item) => (item.id === previous.id ? saved : item)) : [saved, ...current]))
      setShowEditor(false)
      setView('notebook')
      setExpandedId(saved.id)
      notify(previous ? '错题已更新并重新整理' : mode === 'ai' ? 'AI 已完成分析与举一反三' : '错题已自动整理')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const reanalyze = async (item: ErrorItem) => {
    if (!settings.enabled || !apiKey.trim()) {
      setView('settings')
      notify('请先开启 AI 并填写本次会话的 API Key', 'error')
      return
    }
    setIsAnalyzing(true)
    try {
      const analysis = await analyzeWithAi(draftFromItem(item), settings, apiKey)
      const updated = createItem(draftFromItem(item), analysis, item, 'ai')
      setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)))
      notify('AI 分析已更新')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'AI 分析失败', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const removeItem = (id: string) => {
    if (!window.confirm('确定删除这道错题吗？此操作无法撤销。')) return
    setItems((current) => current.filter((item) => item.id !== id))
    setSelected((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    notify('错题已删除')
  }

  const exportItems = async () => {
    const target = selected.size ? items.filter((item) => selected.has(item.id)) : filteredItems
    try {
      const { exportRedoDocx } = await import('./lib/exportDocx')
      await exportRedoDocx(target)
      notify(`已导出 ${target.length} 道题的 DOCX 重做卷`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '导出失败', 'error')
    }
  }

  const startRedo = () => {
    const candidates = items.filter((item) => !item.mastered && (redoSubject === '全部' || item.subject === redoSubject))
    if (!candidates.length) {
      notify('当前筛选下没有待复习错题', 'error')
      return
    }
    setRedoQueue([...candidates].sort(() => Math.random() - 0.5).slice(0, 10))
    setRedoIndex(0)
    setRedoRevealed(false)
  }

  const gradeRedo = (correct: boolean) => {
    const current = redoQueue[redoIndex]
    const nextCorrectCount = correct ? current.correctCount + 1 : 0
    const updated = {
      ...current,
      reviewCount: current.reviewCount + 1,
      correctCount: nextCorrectCount,
      mastered: nextCorrectCount >= 2,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setItems((all) => all.map((item) => (item.id === current.id ? updated : item)))
    setRedoQueue((queue) => queue.map((item, index) => (index === redoIndex ? updated : item)))
    if (redoIndex + 1 >= redoQueue.length) {
      setRedoIndex(redoQueue.length)
      notify('本轮重做完成')
    } else {
      setRedoIndex((index) => index + 1)
      setRedoRevealed(false)
    }
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const imported = await parseBackup(file)
      if (!window.confirm(`将导入 ${imported.length} 道错题并覆盖当前数据，是否继续？`)) return
      setItems(imported)
      notify('备份已恢复')
    } catch (error) {
      notify(error instanceof Error ? error.message : '导入失败', 'error')
    }
  }

  const renderHome = () => (
    <div className="page-stack">
      <section className="welcome-panel">
        <div>
          <p className="eyebrow">今天也向前一步</p>
          <h1>把每一次出错，变成下一次得分。</h1>
          <p>自动归类错因、沉淀知识薄弱点，用重做真正关掉一道错题。</p>
        </div>
        <button className="primary large" onClick={openCreate}><Plus size={19} />录入新错题</button>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><span className="stat-icon green"><BookOpen /></span><div><strong>{items.length}</strong><span>错题总数</span></div></article>
        <article className="stat-card"><span className="stat-icon amber"><Clock3 /></span><div><strong>{stats.pending}</strong><span>待复习</span></div></article>
        <article className="stat-card"><span className="stat-icon blue"><CheckCircle2 /></span><div><strong>{stats.mastered}</strong><span>已掌握</span></div></article>
        <article className="stat-card"><span className="stat-icon violet"><RotateCcw /></span><div><strong>{stats.reviewed}</strong><span>累计重做</span></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel subject-overview">
          <div className="panel-heading"><div><p className="eyebrow">科目分布</p><h2>三科错题</h2></div><BarChart3 /></div>
          <div className="subject-list">
            {SUBJECTS.map((subject) => {
              const count = items.filter((item) => item.subject === subject).length
              const mastered = items.filter((item) => item.subject === subject && item.mastered).length
              const percent = count ? Math.round((mastered / count) * 100) : 0
              return <button key={subject} className="subject-row" onClick={() => { setSubjectFilter(subject); setView('notebook') }}>
                <span className={`subject-badge ${subjectStyle[subject].className}`}>{subjectStyle[subject].short}</span>
                <span className="subject-row-main"><strong>{subject}</strong><small>{count} 道 · 掌握率 {percent}%</small><span className="progress"><i style={{ width: `${percent}%` }} /></span></span>
                <ChevronRight size={18} />
              </button>
            })}
          </div>
        </article>

        <article className="panel weakness-panel">
          <div className="panel-heading"><div><p className="eyebrow">智能聚焦</p><h2>当前薄弱点</h2></div><BrainCircuit /></div>
          {stats.weaknesses.length ? <div className="weakness-list">
            {stats.weaknesses.map(([point, count], index) => <div className="weakness" key={point}>
              <span>{index + 1}</span><div><strong>{point}</strong><small>{count} 道待掌握错题</small></div>
              <button onClick={() => { setQuery(point); setView('notebook') }}>查看</button>
            </div>)}
          </div> : <div className="empty-mini"><CheckCircle2 /><p>暂时没有待解决的薄弱点</p></div>}
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading"><div><p className="eyebrow">最近整理</p><h2>继续复盘</h2></div><button className="text-button" onClick={() => setView('notebook')}>查看全部 <ChevronRight size={16} /></button></div>
        <div className="recent-grid">
          {items.slice(0, 3).map((item) => <button className="recent-card" key={item.id} onClick={() => { setView('notebook'); setExpandedId(item.id) }}>
            <span className={`subject-badge ${subjectStyle[item.subject].className}`}>{subjectStyle[item.subject].short}</span>
            <div><strong>{item.title}</strong><small>{item.knowledgePoints.join(' · ')}</small><em className={item.mastered ? 'mastered' : ''}>{item.mastered ? '已掌握' : item.mistakeType}</em></div>
            <ChevronRight size={17} />
          </button>)}
        </div>
      </section>
    </div>
  )

  const renderNotebook = () => {
    const allVisibleSelected = filteredItems.length > 0 && filteredItems.every((item) => selected.has(item.id))
    return <div className="page-stack">
      <section className="page-title-row">
        <div><p className="eyebrow">错题档案</p><h1>我的错题</h1><p>共 {filteredItems.length} 道，点开卡片查看错因与变式题。</p></div>
        <div className="title-actions"><button className="secondary" onClick={exportItems}><FileDown size={18} />{selected.size ? `导出已选 ${selected.size} 道` : '导出当前结果'}</button><button className="primary" onClick={openCreate}><Plus size={18} />录入错题</button></div>
      </section>
      <section className="toolbar panel">
        <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题目、知识点、来源……" />{query && <button onClick={() => setQuery('')}><X size={16} /></button>}</label>
        <div className="filter-control"><Filter size={17} /><select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value as Subject | '全部')}><option>全部</option>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></div>
        <div className="filter-control"><select value={mistakeFilter} onChange={(event) => setMistakeFilter(event.target.value)}><option>全部错因</option>{MISTAKE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
      </section>
      {filteredItems.length ? <>
        <label className="select-all"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(filteredItems.map((item) => item.id)))} />选择当前全部错题</label>
        <section className="notebook-list">
          {filteredItems.map((item) => {
            const expanded = expandedId === item.id
            return <article className={`error-card ${expanded ? 'expanded' : ''}`} key={item.id}>
              <div className="error-card-summary">
                <input aria-label={`选择${item.title}`} type="checkbox" checked={selected.has(item.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next })} />
                <span className={`subject-badge ${subjectStyle[item.subject].className}`}>{subjectStyle[item.subject].short}</span>
                <button className="summary-content" onClick={() => setExpandedId(expanded ? null : item.id)}>
                  <span><strong>{item.title}</strong>{item.analysisMode === 'ai' && <em className="ai-mark"><Sparkles size={12} />AI</em>}</span>
                  <small>{item.source} · {formatDate(item.updatedAt)}</small>
                  <span className="tag-row"><em>{item.mistakeType}</em>{item.knowledgePoints.map((point) => <em key={point}>{point}</em>)}</span>
                </button>
                <span className={`status-pill ${item.mastered ? 'done' : ''}`}>{item.mastered ? '已掌握' : '待复习'}</span>
                <ChevronRight className={expanded ? 'turn' : ''} size={19} />
              </div>
              {expanded && <div className="error-detail">
                <div className="question-block"><p className="detail-label">原题</p><p>{item.question || '题目见图片'}</p>{item.imageDataUrl && <img src={item.imageDataUrl} alt="错题原图" />}</div>
                <div className="answer-columns">
                  <div><p className="detail-label wrong">我的答案</p><p>{item.studentAnswer || '未记录'}</p></div>
                  <div><p className="detail-label right">正确答案</p><p>{item.correctAnswer}</p></div>
                </div>
                <div className="analysis-box"><div className="analysis-title"><BrainCircuit size={20} /><strong>{item.analysisMode === 'ai' ? 'AI 错因分析' : '本地错因分析'}</strong></div><p><b>错误根源：</b>{item.rootCause}</p><p><b>思路讲解：</b>{item.explanation}</p><p><b>改进动作：</b>{item.improvementAdvice}</p></div>
                <div className="variants"><p className="detail-label"><Sparkles size={15} /> 举一反三</p>{item.variants.map((variant, index) => <details key={`${item.id}-variant-${index}`}><summary><span>{index + 1}</span>{variant.question}</summary><div><p><b>提示：</b>{variant.hint}</p><p><b>答案：</b>{variant.answer}</p></div></details>)}</div>
                <div className="card-actions">
                  <button onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, mastered: !entry.mastered, updatedAt: new Date().toISOString() } : entry))}><Check size={16} />{item.mastered ? '改为待复习' : '标记已掌握'}</button>
                  <button onClick={() => openEdit(item)}><Edit3 size={16} />编辑</button>
                  <button onClick={() => reanalyze(item)}><Sparkles size={16} />AI 重新分析</button>
                  <button className="danger" onClick={() => removeItem(item.id)}><Trash2 size={16} />删除</button>
                </div>
              </div>}
            </article>
          })}
        </section>
      </> : <section className="empty-state panel"><Search /><h2>没有找到错题</h2><p>调整筛选条件，或录入一道新的错题。</p><button className="primary" onClick={openCreate}><Plus size={18} />录入错题</button></section>}
    </div>
  }

  const renderRedo = () => {
    const current = redoQueue[redoIndex]
    if (redoQueue.length && redoIndex >= redoQueue.length) return <div className="page-stack"><section className="redo-finish panel"><span><CheckCircle2 /></span><h1>本轮重做完成</h1><p>连续答对 2 次的错题会自动标记为已掌握。不要追求一次全对，稳定地关掉错题更重要。</p><div><button className="secondary" onClick={() => setView('home')}>查看学习概览</button><button className="primary" onClick={() => { setRedoQueue([]); startRedo() }}>再练一组</button></div></section></div>
    return <div className="page-stack">
      <section className="page-title-row"><div><p className="eyebrow">主动回忆</p><h1>重做练习</h1><p>先独立作答，再展开答案；连续答对 2 次视为掌握。</p></div><button className="secondary" onClick={async () => { try { const { exportRedoDocx } = await import('./lib/exportDocx'); await exportRedoDocx(items.filter((item) => !item.mastered)); notify('DOCX 重做卷已生成') } catch (error) { notify(error instanceof Error ? error.message : '导出失败', 'error') } }}><Printer size={18} />打印全部待复习题</button></section>
      {!current ? <section className="redo-start panel">
        <span className="hero-icon"><RotateCcw /></span><h2>开始一轮错题重做</h2><p>系统将从未掌握题目中随机抽取最多 10 题，不显示原答案。</p>
        <div className="subject-pills"><button className={redoSubject === '全部' ? 'active' : ''} onClick={() => setRedoSubject('全部')}>全部</button>{SUBJECTS.map((subject) => <button className={redoSubject === subject ? 'active' : ''} key={subject} onClick={() => setRedoSubject(subject)}>{subject}<small>{items.filter((item) => !item.mastered && item.subject === subject).length}</small></button>)}</div>
        <button className="primary large" onClick={startRedo}>开始重做 <ChevronRight size={18} /></button>
      </section> : <section className="redo-session">
        <div className="redo-progress"><span>第 {redoIndex + 1} / {redoQueue.length} 题</span><div><i style={{ width: `${((redoIndex + 1) / redoQueue.length) * 100}%` }} /></div><em>{current.subject} · {current.knowledgePoints[0]}</em></div>
        <article className="redo-card panel">
          <div className="redo-question"><span className={`subject-badge ${subjectStyle[current.subject].className}`}>{subjectStyle[current.subject].short}</span><div><h2>{current.title}</h2><p>{current.question || '请根据题目图片作答。'}</p>{current.imageDataUrl && <img src={current.imageDataUrl} alt="错题原图" />}</div></div>
          <div className="paper-lines"><span /><span /><span /><span /></div>
          {!redoRevealed ? <button className="secondary reveal" onClick={() => setRedoRevealed(true)}><Eye size={18} />显示答案与解析</button> : <div className="redo-answer"><p className="detail-label right">正确答案</p><p>{current.correctAnswer}</p><p className="detail-label">关键思路</p><p>{current.correctSolution}</p><div className="grade-actions"><button className="wrong-button" onClick={() => gradeRedo(false)}><X size={18} />仍然不会</button><button className="right-button" onClick={() => gradeRedo(true)}><Check size={18} />这次答对了</button></div></div>}
        </article>
      </section>}
    </div>
  }

  const renderSettings = () => (
    <div className="page-stack settings-page">
      <section className="page-title-row"><div><p className="eyebrow">数据与能力</p><h1>设置与备份</h1><p>AI 是增强项；即使不开启，错题本仍可离线使用。</p></div></section>
      <section className="settings-grid">
        <article className="panel setting-card wide">
          <div className="setting-heading"><span className="stat-icon violet"><Sparkles /></span><div><h2>AI 自动分析</h2><p>识别知识点、定位根因，并生成有答案的同类变式题。</p></div><label className="switch"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /><span /></label></div>
          <div className="settings-form">
            <label><span>Responses API 地址</span><input value={settings.endpoint} onChange={(event) => setSettings({ ...settings, endpoint: event.target.value })} placeholder="https://api.openai.com/v1/responses" /></label>
            <label><span>模型</span><input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} placeholder="gpt-5.6-luna" /></label>
            <label><span>API Key（仅保留到关闭本次应用）</span><div className="password-box"><input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" autoComplete="off" /><button onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          </div>
          <div className="security-note"><ShieldCheck size={18} /><p><b>密钥保护：</b>API Key 只存于当前会话，不进入错题备份和 GitHub。公共或多人设备请在使用后关闭应用。生产部署建议改用自有服务端代理。</p></div>
        </article>
        <article className="panel setting-card">
          <div className="setting-heading"><span className="stat-icon blue"><Download /></span><div><h2>备份错题</h2><p>导出包含全部错题和复习状态的 JSON 文件。</p></div></div>
          <button className="secondary full" onClick={() => downloadBackup(items)}><Download size={18} />导出数据备份</button>
        </article>
        <article className="panel setting-card">
          <div className="setting-heading"><span className="stat-icon green"><Upload /></span><div><h2>恢复数据</h2><p>从本应用导出的 JSON 备份覆盖恢复。</p></div></div>
          <input ref={backupInput} hidden type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} />
          <button className="secondary full" onClick={() => backupInput.current?.click()}><Upload size={18} />选择备份文件</button>
        </article>
        <article className="panel setting-card wide about-card">
          <div><h2>跨平台构建</h2><p>同一套数据与界面可构建 Windows 安装包和 Android APK，也可作为 PWA 安装使用。</p></div>
          <div className="platform-chips"><span>Windows</span><span>Android APK</span><span>离线可用</span><span>DOCX 导出</span></div>
        </article>
      </section>
    </div>
  )

  return <div className="app-shell">
    <aside className={mobileNav ? 'mobile-open' : ''}>
      <div className="brand"><span><BookOpen /></span><div><strong>沪学错题本</strong><small>知错 · 会改 · 真掌握</small></div><button className="mobile-close" onClick={() => setMobileNav(false)}><X /></button></div>
      <nav>{navItems.map((entry) => { const Icon = entry.icon; return <button key={entry.key} className={view === entry.key ? 'active' : ''} onClick={() => { setView(entry.key); setMobileNav(false) }}><Icon size={20} /><span>{entry.label}</span>{entry.key === 'notebook' && <em>{items.length}</em>}</button> })}</nav>
      <div className="sidebar-tip"><Sparkles size={19} /><div><strong>复习建议</strong><p>今天先重做 {Math.min(stats.pending, 5)} 道未掌握错题。</p></div></div>
      <div className="sidebar-footer">本地优先存储 · v0.1.0</div>
    </aside>
    {mobileNav && <button className="nav-backdrop" onClick={() => setMobileNav(false)} />}
    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu /></button><div><span>{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}</span><strong>晚上好，继续把薄弱点变成得分点。</strong></div><button className="quick-add" onClick={openCreate}><Plus size={18} /><span>录入错题</span></button></header>
      <div className="page-content">
        {view === 'home' && renderHome()}
        {view === 'notebook' && renderNotebook()}
        {view === 'redo' && renderRedo()}
        {view === 'settings' && renderSettings()}
      </div>
    </main>

    {showEditor && <div className="modal-layer" role="dialog" aria-modal="true" aria-label={editingId ? '编辑错题' : '录入错题'}>
      <button className="modal-backdrop" onClick={() => !isAnalyzing && setShowEditor(false)} />
      <section className="editor-modal">
        <div className="modal-heading"><div><p className="eyebrow">{editingId ? '修改档案' : '新增错题'}</p><h2>{editingId ? '编辑并重新整理' : '把今天的错误留下来'}</h2></div><button onClick={() => setShowEditor(false)} disabled={isAnalyzing}><X /></button></div>
        <div className="editor-body">
          <div className="form-grid thirds">
            <label><span>科目</span><select value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value as ErrorDraft['subject'] })}><option>智能判断</option>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
            <label><span>年级</span><select value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: event.target.value })}>{['六年级', '七年级', '八年级', '九年级'].map((grade) => <option key={grade}>{grade}</option>)}</select></label>
            <label><span>来源</span><input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="如：期中考试、作业" /></label>
          </div>
          <label className="form-field"><span>标题（可留空自动生成）</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="如：一次方程去括号" /></label>
          <label className="form-field"><span>原题文字</span><textarea rows={4} value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} placeholder="粘贴或输入题目；也可以只上传清晰照片。" /></label>
          <div className="image-upload-row">
            <label className="image-upload"><Camera size={20} /><span>{draft.imageDataUrl ? '更换题目图片' : '拍照 / 上传题目图片（≤2MB）'}</span><input hidden type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { notify('图片请控制在 2MB 以内，建议拍照后裁剪题目区域', 'error'); return } const reader = new FileReader(); reader.onload = () => setDraft((current) => ({ ...current, imageDataUrl: String(reader.result) })); reader.readAsDataURL(file) }} /></label>
            {draft.imageDataUrl && <div className="image-preview"><img src={draft.imageDataUrl} alt="题目预览" /><button onClick={() => setDraft({ ...draft, imageDataUrl: undefined })}><X size={15} /></button></div>}
          </div>
          <div className="form-grid">
            <label className="form-field"><span>我的错误答案</span><textarea rows={3} value={draft.studentAnswer} onChange={(event) => setDraft({ ...draft, studentAnswer: event.target.value })} placeholder="记录当时是怎么答的" /></label>
            <label className="form-field"><span>正确答案（可留空）</span><textarea rows={3} value={draft.correctAnswer} onChange={(event) => setDraft({ ...draft, correctAnswer: event.target.value })} placeholder="有标准答案时建议填写" /></label>
          </div>
          <label className="form-field"><span>我觉得错在哪里（可留空）</span><input value={draft.errorHint} onChange={(event) => setDraft({ ...draft, errorHint: event.target.value })} placeholder="如：看漏条件、公式记错、不会做……" /></label>
          <div className="analysis-choice"><span className={settings.enabled && apiKey ? 'online' : ''}>{settings.enabled && apiKey ? <Sparkles size={16} /> : <BrainCircuit size={16} />}{settings.enabled && apiKey ? `将使用 ${settings.model} 深度分析` : '将使用本地规则离线整理'}</span>{(!settings.enabled || !apiKey) && <button onClick={() => { setShowEditor(false); setView('settings') }}>配置 AI</button>}</div>
        </div>
        <div className="modal-footer"><button className="secondary" onClick={() => setShowEditor(false)} disabled={isAnalyzing}>取消</button><button className="primary" onClick={submitDraft} disabled={isAnalyzing}>{isAnalyzing ? <><LoaderCircle className="spin" size={18} />正在分析整理…</> : <><Sparkles size={18} />保存并智能整理</>}</button></div>
      </section>
    </div>}

    {isAnalyzing && !showEditor && <div className="global-loading"><LoaderCircle className="spin" /><span>AI 正在分析错因与变式题…</span></div>}
    {toast && <div className={`toast ${toast.kind}`}>
      {toast.kind === 'ok' ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}<span>{toast.text}</span>
    </div>}
  </div>
}

export default App
