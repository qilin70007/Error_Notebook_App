import type { AiSettings, ErrorItem } from '../types'
import { sampleItems } from './sampleData'

const ITEMS_KEY = 'huxue-error-items-v1'
const SETTINGS_KEY = 'huxue-ai-settings-v1'
const API_KEY_SESSION = 'huxue-ai-api-key'

export const defaultAiSettings: AiSettings = {
  enabled: false,
  endpoint: 'https://api.openai.com/v1/responses',
  model: 'gpt-5.6-luna',
}

export function loadItems(): ErrorItem[] {
  try {
    const saved = localStorage.getItem(ITEMS_KEY)
    if (!saved) return sampleItems
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : sampleItems
  } catch {
    return sampleItems
  }
}

export function saveItems(items: ErrorItem[]): boolean {
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

export function loadSettings(): AiSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    return saved ? { ...defaultAiSettings, ...JSON.parse(saved) } : defaultAiSettings
  } catch {
    return defaultAiSettings
  }
}

export function saveSettings(settings: AiSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadSessionApiKey(): string {
  return sessionStorage.getItem(API_KEY_SESSION) ?? ''
}

export function saveSessionApiKey(key: string): void {
  if (key) sessionStorage.setItem(API_KEY_SESSION, key)
  else sessionStorage.removeItem(API_KEY_SESSION)
}

export function downloadBackup(items: ErrorItem[]): void {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2)], {
    type: 'application/json',
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `沪学错题本备份_${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

export async function parseBackup(file: File): Promise<ErrorItem[]> {
  const data = JSON.parse(await file.text())
  if (!data || !Array.isArray(data.items)) throw new Error('不是有效的错题本备份文件')
  return data.items as ErrorItem[]
}
