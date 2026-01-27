import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format delta (change) with +/- sign
 */
export function formatDelta(value: number, decimals = 0): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Get color class based on value sentiment
 */
export function getSentimentColor(value: number, inverse = false): string {
  const isPositive = inverse ? value < 0 : value > 0
  const isNegative = inverse ? value > 0 : value < 0
  
  if (isPositive) return 'text-[var(--color-success)]'
  if (isNegative) return 'text-[var(--color-danger)]'
  return 'text-[var(--color-text-secondary)]'
}

/**
 * Safe division to avoid NaN
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0) return fallback
  return numerator / denominator
}

/**
 * Delay utility for animations
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}
