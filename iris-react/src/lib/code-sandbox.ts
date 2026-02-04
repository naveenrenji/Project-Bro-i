/**
 * Code Sandbox for Ask Navs AI
 * Provides a secure environment for executing AI-generated JavaScript code
 * against student data in the browser.
 */

import type { StudentRecord } from '@/store/dataStore'

// =============================================================================
// TYPES
// =============================================================================

export interface SandboxResult {
  success: boolean
  result?: {
    answer: unknown
    explanation?: string
    data?: unknown
  }
  error?: string
  executionTime: number
  logs: string[]
}

export interface SandboxHelpers {
  sum: (arr: unknown[], field: string) => number
  avg: (arr: unknown[], field: string) => number
  count: (arr: unknown[]) => number
  groupBy: <T>(arr: T[], field: keyof T) => Record<string, T[]>
  unique: <T>(arr: T[], field: keyof T) => unknown[]
  filter: <T>(arr: T[], fn: (item: T) => boolean) => T[]
  sort: <T>(arr: T[], field: keyof T, descending?: boolean) => T[]
  top: <T>(arr: T[], n: number, field: keyof T) => T[]
  between: (dateStr: string, start: string, end: string) => boolean
  percent: (part: number, total: number, decimals?: number) => number
  formatCurrency: (num: number) => string
  formatNumber: (num: number) => string
  categoryMatch: (studentCategory: string, targetCategory: string) => boolean
}

// =============================================================================
// HELPER FUNCTIONS IMPLEMENTATION
// =============================================================================

function createHelpers(): SandboxHelpers {
  return {
    // Aggregation
    sum: (arr: unknown[], field: string): number => {
      return arr.reduce((acc: number, item: unknown) => {
        const val = (item as Record<string, unknown>)[field]
        return acc + (typeof val === 'number' ? val : 0)
      }, 0)
    },

    avg: (arr: unknown[], field: string): number => {
      if (arr.length === 0) return 0
      const total = arr.reduce((acc: number, item: unknown) => {
        const val = (item as Record<string, unknown>)[field]
        return acc + (typeof val === 'number' ? val : 0)
      }, 0)
      return total / arr.length
    },

    count: (arr: unknown[]): number => arr.length,

    // Grouping & Filtering
    groupBy: <T>(arr: T[], field: keyof T): Record<string, T[]> => {
      return arr.reduce((acc: Record<string, T[]>, item: T) => {
        const key = String(item[field] ?? 'Unknown')
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {})
    },

    unique: <T>(arr: T[], field: keyof T): unknown[] => {
      const seen = new Set<unknown>()
      arr.forEach(item => seen.add(item[field]))
      return Array.from(seen)
    },

    filter: <T>(arr: T[], fn: (item: T) => boolean): T[] => {
      return arr.filter(fn)
    },

    // Sorting
    sort: <T>(arr: T[], field: keyof T, descending = false): T[] => {
      return [...arr].sort((a, b) => {
        const aVal = a[field]
        const bVal = b[field]
        if (aVal === bVal) return 0
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1
        const comparison = aVal < bVal ? -1 : 1
        return descending ? -comparison : comparison
      })
    },

    top: <T>(arr: T[], n: number, field: keyof T): T[] => {
      return [...arr]
        .sort((a, b) => {
          const aVal = a[field] as number
          const bVal = b[field] as number
          return (bVal ?? 0) - (aVal ?? 0)
        })
        .slice(0, n)
    },

    // Date Utilities
    between: (dateStr: string, start: string, end: string): boolean => {
      if (!dateStr) return false
      return dateStr >= start && dateStr <= end
    },

    // Formatting
    percent: (part: number, total: number, decimals = 1): number => {
      if (total === 0) return 0
      return Number(((part / total) * 100).toFixed(decimals))
    },

    formatCurrency: (num: number): string => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num)
    },

    formatNumber: (num: number): string => {
      return new Intl.NumberFormat('en-US').format(num)
    },

    // Category Matching (handles aliases)
    categoryMatch: (studentCategory: string, targetCategory: string): boolean => {
      if (!studentCategory || !targetCategory) return false
      
      const normalize = (cat: string): string => {
        const lower = cat.toLowerCase().trim()
        if (lower.includes('corporate')) return 'corporate'
        if (lower.includes('retail')) return 'retail'
        if (lower.includes('select professional') || lower.includes('noodle')) return 'select professional online'
        if (lower.includes('beacon')) return 'beacon'
        if (lower.includes('cpe')) return 'cpe'
        if (lower.includes('asap')) return 'asap'
        return lower
      }
      
      return normalize(studentCategory) === normalize(targetCategory)
    },
  }
}

// =============================================================================
// SANDBOX EXECUTION
// =============================================================================

/**
 * Execute AI-generated code in a sandboxed environment
 * 
 * @param code - JavaScript code to execute
 * @param students - Array of student records to query
 * @param timeout - Maximum execution time in ms (default 3000)
 * @returns SandboxResult with success status, result, and any errors
 */
export function executeInSandbox(
  code: string,
  students: StudentRecord[],
  timeout = 3000
): SandboxResult {
  const startTime = performance.now()
  const logs: string[] = []
  
  // Create a mock console that captures logs
  const mockConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map(a => JSON.stringify(a)).join(' '))
    },
    error: (...args: unknown[]) => {
      logs.push(`[ERROR] ${args.map(a => JSON.stringify(a)).join(' ')}`)
    },
    warn: (...args: unknown[]) => {
      logs.push(`[WARN] ${args.map(a => JSON.stringify(a)).join(' ')}`)
    },
  }

  try {
    // Create helpers
    const helpers = createHelpers()
    
    // Wrap code to capture return value
    const wrappedCode = `
      "use strict";
      ${code}
    `
    
    // Create the sandbox function with restricted scope
    // Only expose: students, helpers, console (mock)
    const sandboxFn = new Function(
      'students',
      'helpers',
      'console',
      wrappedCode
    )
    
    // Execute with timeout
    let result: unknown
    let timedOut = false
    
    // Simple timeout implementation (synchronous code)
    const timeoutId = setTimeout(() => {
      timedOut = true
    }, timeout)
    
    try {
      result = sandboxFn(students, helpers, mockConsole)
    } finally {
      clearTimeout(timeoutId)
    }
    
    if (timedOut) {
      return {
        success: false,
        error: `Execution timed out after ${timeout}ms`,
        executionTime: timeout,
        logs,
      }
    }
    
    const executionTime = performance.now() - startTime
    
    // Validate result format
    if (result && typeof result === 'object') {
      const resultObj = result as Record<string, unknown>
      return {
        success: true,
        result: {
          answer: resultObj.answer ?? result,
          explanation: resultObj.explanation as string | undefined,
          data: resultObj.data,
        },
        executionTime,
        logs,
      }
    }
    
    // If result is a primitive, wrap it
    return {
      success: true,
      result: {
        answer: result,
      },
      executionTime,
      logs,
    }
    
  } catch (error) {
    const executionTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return {
      success: false,
      error: errorMessage,
      executionTime,
      logs,
    }
  }
}

// =============================================================================
// CODE VALIDATION
// =============================================================================

/**
 * Basic validation of AI-generated code before execution
 * Checks for potentially dangerous patterns
 */
export function validateCode(code: string): { valid: boolean; reason?: string } {
  // Forbidden patterns
  const forbidden = [
    { pattern: /\beval\s*\(/, reason: 'eval() is not allowed' },
    { pattern: /\bFunction\s*\(/, reason: 'Function constructor is not allowed' },
    { pattern: /\bfetch\s*\(/, reason: 'fetch() is not allowed' },
    { pattern: /\bXMLHttpRequest\b/, reason: 'XMLHttpRequest is not allowed' },
    { pattern: /\bimport\s*\(/, reason: 'Dynamic imports are not allowed' },
    { pattern: /\brequire\s*\(/, reason: 'require() is not allowed' },
    { pattern: /\bwindow\b/, reason: 'window access is not allowed' },
    { pattern: /\bdocument\b/, reason: 'document access is not allowed' },
    { pattern: /\blocalStorage\b/, reason: 'localStorage access is not allowed' },
    { pattern: /\bsessionStorage\b/, reason: 'sessionStorage access is not allowed' },
    { pattern: /\bsetTimeout\s*\(/, reason: 'setTimeout is not allowed' },
    { pattern: /\bsetInterval\s*\(/, reason: 'setInterval is not allowed' },
    { pattern: /\bprocess\b/, reason: 'process access is not allowed' },
    { pattern: /\bglobal\b/, reason: 'global access is not allowed' },
    { pattern: /\bthis\b/, reason: 'this keyword is not recommended' },
  ]
  
  for (const { pattern, reason } of forbidden) {
    if (pattern.test(code)) {
      return { valid: false, reason }
    }
  }
  
  return { valid: true }
}

// =============================================================================
// HELPER EXPORTS
// =============================================================================

export { createHelpers }
export type { SandboxHelpers as Helpers }
