import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VerdictType, CredibilityBand } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const verdictConfig: Record<VerdictType, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
}> = {
  true: {
    label: 'TRUE',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    textColor: '#10b981',
    glowColor: '0 0 20px rgba(16, 185, 129, 0.3)',
  },
  mostly_true: {
    label: 'MOSTLY TRUE',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
    textColor: '#34d399',
    glowColor: '0 0 20px rgba(52, 211, 153, 0.2)',
  },
  mixed: {
    label: 'MIXED',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    textColor: '#f59e0b',
    glowColor: '0 0 20px rgba(245, 158, 11, 0.25)',
  },
  mostly_false: {
    label: 'MOSTLY FALSE',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
    textColor: '#f97316',
    glowColor: '0 0 20px rgba(249, 115, 22, 0.2)',
  },
  false: {
    label: 'FALSE',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    textColor: '#ef4444',
    glowColor: '0 0 20px rgba(239, 68, 68, 0.25)',
  },
  unverified: {
    label: 'UNVERIFIED',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.08)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
    textColor: '#94a3b8',
    glowColor: '0 0 20px rgba(148, 163, 184, 0.1)',
  },
}

export const bandConfig: Record<CredibilityBand, {
  label: string;
  color: string;
  description: string;
}> = {
  green: { label: 'HIGH CREDIBILITY', color: '#10b981', description: 'Claims are well-supported by evidence' },
  yellow: { label: 'MIXED CREDIBILITY', color: '#f59e0b', description: 'Some claims require further verification' },
  red: { label: 'LOW CREDIBILITY', color: '#ef4444', description: 'Multiple false or unsupported claims found' },
  insufficient: { label: 'INSUFFICIENT DATA', color: '#94a3b8', description: 'Not enough evidence sources to determine credibility' },
}

export function getScoreColor(score: number): string {
  if (score >= 75) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}
