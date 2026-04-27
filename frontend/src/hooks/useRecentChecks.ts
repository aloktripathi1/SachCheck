import { useState, useCallback } from 'react'
import type { CredibilityBand } from '../types'

export interface RecentCheck {
  id: string
  title: string
  score: number
  band: CredibilityBand
  timestamp: number
}

const STORAGE_KEY = 'sachcheck_recent'
const MAX_ITEMS = 5

function load(): RecentCheck[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as RecentCheck[]
  } catch {
    return []
  }
}

function save(checks: RecentCheck[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checks)) } catch { /* */ }
}

export function titleFromInput(input: string): string {
  const trimmed = input.trim()
  // URL — show hostname + truncated path
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed)
      const path = u.pathname.replace(/\/$/, '').split('/').pop() ?? ''
      const slug = path.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').slice(0, 40)
      return slug.length > 4 ? slug : u.hostname.replace('www.', '')
    } catch {
      return trimmed.slice(0, 50)
    }
  }
  // Plain text — first sentence or first 55 chars
  const firstSentence = trimmed.split(/[.!?\n]/)[0].trim()
  return (firstSentence.length > 8 ? firstSentence : trimmed).slice(0, 55)
}

export function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function useRecentChecks() {
  const [checks, setChecks] = useState<RecentCheck[]>(load)

  const add = useCallback((entry: Omit<RecentCheck, 'id' | 'timestamp'>) => {
    const next: RecentCheck = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    setChecks(prev => {
      const updated = [next, ...prev].slice(0, MAX_ITEMS)
      save(updated)
      return updated
    })
  }, [])

  const clear = useCallback(() => {
    save([])
    setChecks([])
  }, [])

  return { checks, add, clear }
}
