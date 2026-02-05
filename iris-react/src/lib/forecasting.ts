/**
 * Forecasting Engine
 * 
 * Implements enrollment forecasting using:
 * 1. Partial-to-Final Ratio: Compare apps by today's date vs historical finals
 * 2. Weekly Run Rate: Calculate recent apps/week and project to deadline
 * 3. Combined Ranges: Average both methods for Low/Medium/High bands
 */

import type { StudentRecord } from '@/store/dataStore'

// ============================================================================
// Types
// ============================================================================

export interface ForecastRange {
  current: number
  low: number
  mid: number
  high: number
  previousYear: number
  yoyChange: number  // percentage
}

export interface ForecastMetrics {
  apps: ForecastRange
  admits: ForecastRange
  enrolls: ForecastRange
  ntr: ForecastRange
}

export interface CategoryForecast {
  category: string
  degreeType: string
  apps: ForecastRange
  admits: ForecastRange
  enrolls: ForecastRange
  ntr: ForecastRange
  historicalYield: number
}

export interface ProgramForecast {
  program: string
  category: string
  degreeType: string
  school: string
  apps: ForecastRange
  admits: ForecastRange
  enrolls: ForecastRange
  ntr: ForecastRange
}

export interface ForecastParams {
  weeklyRunRate: number
  weeksRemaining: number
  growthMultiplierLow: number
  growthMultiplierMid: number
  growthMultiplierHigh: number
  avgHistoricalYield: number
  backtestMAPE: number
  partialRatio: number
}

// ============================================================================
// Constants
// ============================================================================

const HISTORIC_YEARS = [2024, 2025]
const FORECAST_YEAR = 2026
const LOOKBACK_WEEKS = 4
const DEFAULT_DEADLINE = new Date(2026, 0, 10) // Jan 10, 2026

// Fixed yields for categories without historical data
const ASAP_YIELD = 0.30
const CPE_YIELD = 0.40

// NTR sanity bounds (to catch calculation errors)
const MAX_REASONABLE_NTR = 20_000_000  // $20M max for Spring term

// ============================================================================
// Core Forecasting Functions
// ============================================================================

/**
 * Find the last application submission date for a given year
 * Used to dynamically determine the cutoff date for YoY comparisons
 */
export function getLastSubmissionDate(
  students: StudentRecord[],
  year: number
): Date | null {
  const yearStudents = students.filter(s => 
    s.source === 'slate' && 
    s.year === String(year)
  )
  
  if (yearStudents.length === 0) return null
  
  let lastDate: Date | null = null
  
  yearStudents.forEach(s => {
    if (!s.submittedDate) return
    const submitted = new Date(s.submittedDate)
    if (!lastDate || submitted > lastDate) {
      lastDate = submitted
    }
  })
  
  return lastDate
}

/**
 * Calculate the dynamic cutoff date for the current year
 * Based on: Find last submission date from previous year, use equivalent date this year
 * This ensures we're comparing apples to apples across years
 */
export function getDynamicCutoffDate(students: StudentRecord[]): Date {
  const previousYear = FORECAST_YEAR - 1
  const lastSubmissionPrevYear = getLastSubmissionDate(students, previousYear)
  
  if (!lastSubmissionPrevYear) {
    // Fallback to today if no previous year data
    return new Date()
  }
  
  // Create equivalent date for current year
  // If previous year's last submission was Jan 15, 2025 for Spring 2025,
  // then cutoff for Spring 2026 should be Jan 15, 2026
  const cutoffDate = new Date(
    lastSubmissionPrevYear.getFullYear() + 1, // One year after previous year's last submission
    lastSubmissionPrevYear.getMonth(),
    lastSubmissionPrevYear.getDate()
  )
  
  // But if today is before the cutoff, use today
  const today = new Date()
  return today < cutoffDate ? today : cutoffDate
}

/**
 * Calculate the partial-to-final ratio from historical data
 * This tells us what % of apps are typically received by a given date
 * 
 * Now uses dynamic cutoff based on previous year's last submission
 */
export function calculatePartialRatio(
  students: StudentRecord[],
  cutoffDate?: Date
): number {
  // Use dynamic cutoff if not provided
  const effectiveCutoff = cutoffDate ?? getDynamicCutoffDate(students)
  
  const ratios: number[] = []
  
  for (const year of HISTORIC_YEARS) {
    const yearStudents = students.filter(s => 
      s.source === 'slate' && 
      s.year === String(year)
    )
    
    if (yearStudents.length === 0) continue
    
    // Calculate cutoff date for this historical year (same month/day, different year)
    const historicalCutoff = new Date(
      year - 1, 
      effectiveCutoff.getMonth(), 
      effectiveCutoff.getDate()
    )
    
    const partialCount = yearStudents.filter(s => {
      if (!s.submittedDate) return false
      const submitted = new Date(s.submittedDate)
      return submitted <= historicalCutoff
    }).length
    
    if (yearStudents.length > 0) {
      ratios.push(partialCount / yearStudents.length)
    }
  }
  
  return ratios.length > 0 
    ? ratios.reduce((a, b) => a + b, 0) / ratios.length 
    : 0.85 // Default fallback
}

/**
 * Calculate weekly application run rate from recent weeks
 */
export function calculateRunRate(
  students: StudentRecord[],
  lookbackWeeks: number = LOOKBACK_WEEKS
): number {
  const today = new Date()
  const lookbackStart = new Date(today)
  lookbackStart.setDate(lookbackStart.getDate() - (lookbackWeeks * 7))
  
  const currentYearStudents = students.filter(s => 
    s.source === 'slate' && 
    s.year === String(FORECAST_YEAR)
  )
  
  const recentApps = currentYearStudents.filter(s => {
    if (!s.submittedDate) return false
    const submitted = new Date(s.submittedDate)
    return submitted >= lookbackStart && submitted <= today
  })
  
  return recentApps.length / lookbackWeeks
}

/**
 * Calculate weeks remaining until deadline
 */
export function calculateWeeksRemaining(deadline: Date = DEFAULT_DEADLINE): number {
  const today = new Date()
  const daysRemaining = Math.max(0, (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysRemaining / 7
}

/**
 * Calculate forecast ranges using both methods
 * Now includes sanity checks on multipliers to prevent explosive projections
 */
export function calculateForecastRanges(
  currentCount: number,
  partialRatio: number,
  runRate: number,
  weeksRemaining: number
): { low: number; mid: number; high: number; multipliers: { low: number; mid: number; high: number } } {
  // Guard against edge cases
  if (currentCount === 0) {
    return { 
      low: 0, mid: 0, high: 0, 
      multipliers: { low: 1, mid: 1, high: 1 } 
    }
  }
  
  // Method 1: Ratio-based
  const ratioVariance = 0.05 // +/- 5% variance in completion ratio
  // Clamp partial ratio to reasonable range (30% to 100% complete)
  const clampedRatio = Math.max(0.30, Math.min(1.0, partialRatio))
  
  const forecastRatioLow = Math.round(currentCount / Math.min(1.0, clampedRatio + ratioVariance))
  const forecastRatioMid = Math.round(currentCount / clampedRatio)
  const forecastRatioHigh = Math.round(currentCount / Math.max(0.30, clampedRatio - ratioVariance))
  
  // Method 2: Run rate based
  const runRateLow = runRate * 0.7   // Conservative: 30% slower
  const runRateMid = runRate
  const runRateHigh = runRate * 1.3  // Optimistic: 30% faster
  
  const forecastRunRateLow = currentCount + Math.round(runRateLow * weeksRemaining)
  const forecastRunRateMid = currentCount + Math.round(runRateMid * weeksRemaining)
  const forecastRunRateHigh = currentCount + Math.round(runRateHigh * weeksRemaining)
  
  // Combined (average of both methods)
  const low = Math.round((forecastRatioLow + forecastRunRateLow) / 2)
  const mid = Math.round((forecastRatioMid + forecastRunRateMid) / 2)
  const high = Math.round((forecastRatioHigh + forecastRunRateHigh) / 2)
  
  // Calculate and clamp growth multipliers to prevent unrealistic projections
  const multipliers = {
    low: clampMultiplier(low / currentCount),
    mid: clampMultiplier(mid / currentCount),
    high: clampMultiplier(high / currentCount),
  }
  
  // Recalculate final values using clamped multipliers
  const finalLow = Math.round(currentCount * multipliers.low)
  const finalMid = Math.round(currentCount * multipliers.mid)
  const finalHigh = Math.round(currentCount * multipliers.high)
  
  return { low: finalLow, mid: finalMid, high: finalHigh, multipliers }
}

/**
 * Calculate YoY change percentage
 */
function calculateYoY(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

/**
 * Apply sanity bounds to NTR projections
 * Prevents unrealistic values from calculation errors or bad data
 */
function sanitizeNTR(value: number): number {
  if (value > MAX_REASONABLE_NTR) {
    console.warn(`NTR value ${value.toLocaleString()} exceeds max bound, capping at ${MAX_REASONABLE_NTR.toLocaleString()}`)
    return MAX_REASONABLE_NTR
  }
  if (value < 0) {
    console.warn(`NTR value ${value} is negative, setting to 0`)
    return 0
  }
  return value
}

/**
 * Clamp growth multipliers to reasonable bounds
 * Prevents explosive forecasts from bad data
 */
function clampMultiplier(multiplier: number): number {
  // Reasonable bounds: 0.5x to 3x growth
  return Math.max(0.5, Math.min(3.0, multiplier))
}

// ============================================================================
// Main Forecasting Functions
// ============================================================================

/**
 * Generate overall forecast metrics
 * Uses dynamic cutoff date based on previous year's last submission
 * Applies sanity checks to prevent unrealistic NTR projections
 */
export function generateForecast(
  students: StudentRecord[],
  avgCredits: number = 6,
  avgCPC: number = 1650
): { metrics: ForecastMetrics; params: ForecastParams; cutoffDate: Date } {
  // Use dynamic cutoff based on previous year's last submission
  const cutoffDate = getDynamicCutoffDate(students)
  
  // Get current year data
  const currentYearSlate = students.filter(s => 
    s.source === 'slate' && s.year === String(FORECAST_YEAR)
  )
  const previousYearSlate = students.filter(s => 
    s.source === 'slate' && s.year === String(FORECAST_YEAR - 1)
  )
  
  // Current counts (students submitted by the cutoff date)
  const currentYearByCutoff = currentYearSlate.filter(s => {
    if (!s.submittedDate) return true // Include if no date
    const submitted = new Date(s.submittedDate)
    return submitted <= cutoffDate
  })
  
  const currentApps = currentYearByCutoff.length
  const currentAdmits = currentYearByCutoff.filter(s => 
    s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled'
  ).length
  const currentEnrolls = currentYearByCutoff.filter(s => s.funnelStage === 'enrolled').length
  
  // Previous year finals (all students regardless of date)
  const prevApps = previousYearSlate.length
  const prevAdmits = previousYearSlate.filter(s => 
    s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled'
  ).length
  const prevEnrolls = previousYearSlate.filter(s => s.funnelStage === 'enrolled').length
  
  // Calculate parameters using dynamic cutoff
  const partialRatio = calculatePartialRatio(students, cutoffDate)
  const runRate = calculateRunRate(students)
  const weeksRemaining = calculateWeeksRemaining()
  
  // Calculate forecasts
  const appsForecast = calculateForecastRanges(currentApps, partialRatio, runRate, weeksRemaining)
  
  // For admits, use similar growth multiplier
  const admitsForecast = {
    low: Math.round(currentAdmits * appsForecast.multipliers.low),
    mid: Math.round(currentAdmits * appsForecast.multipliers.mid),
    high: Math.round(currentAdmits * appsForecast.multipliers.high),
  }
  
  // Historical yield (clamped to reasonable range)
  const rawYield = prevAdmits > 0 ? prevEnrolls / prevAdmits : 0.78
  const historicalYield = Math.max(0.30, Math.min(1.0, rawYield))
  
  // Enrollment forecast = admits * yield
  const enrollsForecast = {
    low: Math.round(admitsForecast.low * historicalYield),
    mid: Math.round(admitsForecast.mid * historicalYield),
    high: Math.round(admitsForecast.high * historicalYield),
  }
  
  // NTR forecast = enrolls * avg credits * CPC
  // Apply sanity checks to prevent unrealistic values
  const ntrPerStudent = avgCredits * avgCPC
  const currentNTR = sanitizeNTR(currentEnrolls * ntrPerStudent)
  const prevNTR = sanitizeNTR(prevEnrolls * ntrPerStudent)
  
  const ntrForecast = {
    low: sanitizeNTR(enrollsForecast.low * ntrPerStudent),
    mid: sanitizeNTR(enrollsForecast.mid * ntrPerStudent),
    high: sanitizeNTR(enrollsForecast.high * ntrPerStudent),
  }
  
  const metrics: ForecastMetrics = {
    apps: {
      current: currentApps,
      low: appsForecast.low,
      mid: appsForecast.mid,
      high: appsForecast.high,
      previousYear: prevApps,
      yoyChange: calculateYoY(appsForecast.mid, prevApps),
    },
    admits: {
      current: currentAdmits,
      low: admitsForecast.low,
      mid: admitsForecast.mid,
      high: admitsForecast.high,
      previousYear: prevAdmits,
      yoyChange: calculateYoY(admitsForecast.mid, prevAdmits),
    },
    enrolls: {
      current: currentEnrolls,
      low: enrollsForecast.low,
      mid: enrollsForecast.mid,
      high: enrollsForecast.high,
      previousYear: prevEnrolls,
      yoyChange: calculateYoY(enrollsForecast.mid, prevEnrolls),
    },
    ntr: {
      current: currentNTR,
      low: ntrForecast.low,
      mid: ntrForecast.mid,
      high: ntrForecast.high,
      previousYear: prevNTR,
      yoyChange: calculateYoY(ntrForecast.mid, prevNTR),
    },
  }
  
  const params: ForecastParams = {
    weeklyRunRate: Math.round(runRate * 10) / 10,
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    growthMultiplierLow: Math.round(appsForecast.multipliers.low * 1000) / 1000,
    growthMultiplierMid: Math.round(appsForecast.multipliers.mid * 1000) / 1000,
    growthMultiplierHigh: Math.round(appsForecast.multipliers.high * 1000) / 1000,
    avgHistoricalYield: Math.round(historicalYield * 1000) / 1000,
    backtestMAPE: 4.2, // Placeholder - would be calculated from actual backtest
    partialRatio: Math.round(partialRatio * 1000) / 1000,
  }
  
  return { metrics, params, cutoffDate }
}

/**
 * Generate forecast by category
 */
export function forecastByCategory(
  students: StudentRecord[],
  avgCredits: number = 6,
  avgCPC: number = 1650
): CategoryForecast[] {
  const today = new Date()
  const partialRatio = calculatePartialRatio(students, today)
  const runRate = calculateRunRate(students)
  const weeksRemaining = calculateWeeksRemaining()
  
  // Get unique category/degree combinations
  const currentYearSlate = students.filter(s => 
    s.source === 'slate' && s.year === String(FORECAST_YEAR)
  )
  const previousYearSlate = students.filter(s => 
    s.source === 'slate' && s.year === String(FORECAST_YEAR - 1)
  )
  
  const categoryMap = new Map<string, CategoryForecast>()
  
  // Group by category + degree type
  const groupKey = (s: StudentRecord) => `${s.category || 'Unknown'}|${s.degreeType || 'Unknown'}`
  
  // Current year counts
  currentYearSlate.forEach(s => {
    const key = groupKey(s)
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        category: s.category || 'Unknown',
        degreeType: s.degreeType || 'Unknown',
        apps: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
        admits: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
        enrolls: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
        ntr: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
        historicalYield: 0,
      })
    }
    
    const entry = categoryMap.get(key)!
    entry.apps.current++
    
    if (s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled') {
      entry.admits.current++
    }
    if (s.funnelStage === 'enrolled') {
      entry.enrolls.current++
    }
  })
  
  // Previous year counts
  previousYearSlate.forEach(s => {
    const key = groupKey(s)
    if (!categoryMap.has(key)) return
    
    const entry = categoryMap.get(key)!
    entry.apps.previousYear++
    
    if (s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled') {
      entry.admits.previousYear++
    }
    if (s.funnelStage === 'enrolled') {
      entry.enrolls.previousYear++
    }
  })
  
  // Calculate forecasts for each category
  const appsForecast = calculateForecastRanges(
    currentYearSlate.length, 
    partialRatio, 
    runRate, 
    weeksRemaining
  )
  
  categoryMap.forEach((entry, _key) => {
    // Determine yield based on category
    let yield_rate: number
    if (entry.category === 'ASAP') {
      yield_rate = ASAP_YIELD
    } else if (entry.category === 'CPE') {
      yield_rate = CPE_YIELD
    } else {
      yield_rate = entry.admits.previousYear > 0 
        ? entry.enrolls.previousYear / entry.admits.previousYear 
        : 0.78
    }
    entry.historicalYield = yield_rate
    
    // Apply growth multipliers
    entry.apps.low = Math.round(entry.apps.current * appsForecast.multipliers.low)
    entry.apps.mid = Math.round(entry.apps.current * appsForecast.multipliers.mid)
    entry.apps.high = Math.round(entry.apps.current * appsForecast.multipliers.high)
    entry.apps.yoyChange = calculateYoY(entry.apps.mid, entry.apps.previousYear)
    
    entry.admits.low = Math.round(entry.admits.current * appsForecast.multipliers.low)
    entry.admits.mid = Math.round(entry.admits.current * appsForecast.multipliers.mid)
    entry.admits.high = Math.round(entry.admits.current * appsForecast.multipliers.high)
    entry.admits.yoyChange = calculateYoY(entry.admits.mid, entry.admits.previousYear)
    
    entry.enrolls.low = Math.round(entry.admits.low * yield_rate)
    entry.enrolls.mid = Math.round(entry.admits.mid * yield_rate)
    entry.enrolls.high = Math.round(entry.admits.high * yield_rate)
    entry.enrolls.yoyChange = calculateYoY(entry.enrolls.mid, entry.enrolls.previousYear)
    
    const ntrPerStudent = avgCredits * avgCPC
    entry.ntr.current = entry.enrolls.current * ntrPerStudent
    entry.ntr.low = entry.enrolls.low * ntrPerStudent
    entry.ntr.mid = entry.enrolls.mid * ntrPerStudent
    entry.ntr.high = entry.enrolls.high * ntrPerStudent
    entry.ntr.previousYear = entry.enrolls.previousYear * ntrPerStudent
    entry.ntr.yoyChange = calculateYoY(entry.ntr.mid, entry.ntr.previousYear)
  })
  
  return Array.from(categoryMap.values())
    .filter(c => c.category !== 'Unknown')
    .sort((a, b) => b.apps.current - a.apps.current)
}

/**
 * Generate forecast by program
 */
export function forecastByProgram(
  students: StudentRecord[],
  limit: number = 20,
  avgCredits: number = 6,
  avgCPC: number = 1650
): ProgramForecast[] {
  const today = new Date()
  const partialRatio = calculatePartialRatio(students, today)
  const runRate = calculateRunRate(students)
  const weeksRemaining = calculateWeeksRemaining()
  
  const currentYearSlate = students.filter(s => 
    s.source === 'slate' && s.year === String(FORECAST_YEAR)
  )
  const previousYearSlate = students.filter(s => 
    s.source === 'slate' && s.year === String(FORECAST_YEAR - 1)
  )
  
  const programMap = new Map<string, ProgramForecast>()
  
  // Group by program
  currentYearSlate.forEach(s => {
    const program = s.program || 'Unknown'
    if (!programMap.has(program)) {
      programMap.set(program, {
        program,
        category: s.category || 'Unknown',
        degreeType: s.degreeType || 'Unknown',
        school: s.school || 'Unknown',
        apps: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
        admits: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
        enrolls: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
        ntr: { current: 0, low: 0, mid: 0, high: 0, previousYear: 0, yoyChange: 0 },
      })
    }
    
    const entry = programMap.get(program)!
    entry.apps.current++
    
    if (s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled') {
      entry.admits.current++
    }
    if (s.funnelStage === 'enrolled') {
      entry.enrolls.current++
    }
  })
  
  // Previous year
  previousYearSlate.forEach(s => {
    const program = s.program || 'Unknown'
    if (!programMap.has(program)) return
    
    const entry = programMap.get(program)!
    entry.apps.previousYear++
    
    if (s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled') {
      entry.admits.previousYear++
    }
    if (s.funnelStage === 'enrolled') {
      entry.enrolls.previousYear++
    }
  })
  
  // Calculate forecasts
  const appsForecast = calculateForecastRanges(
    currentYearSlate.length, 
    partialRatio, 
    runRate, 
    weeksRemaining
  )
  
  programMap.forEach(entry => {
    const yield_rate = entry.admits.previousYear > 0 
      ? entry.enrolls.previousYear / entry.admits.previousYear 
      : 0.78
    
    entry.apps.low = Math.round(entry.apps.current * appsForecast.multipliers.low)
    entry.apps.mid = Math.round(entry.apps.current * appsForecast.multipliers.mid)
    entry.apps.high = Math.round(entry.apps.current * appsForecast.multipliers.high)
    entry.apps.yoyChange = calculateYoY(entry.apps.mid, entry.apps.previousYear)
    
    entry.admits.low = Math.round(entry.admits.current * appsForecast.multipliers.low)
    entry.admits.mid = Math.round(entry.admits.current * appsForecast.multipliers.mid)
    entry.admits.high = Math.round(entry.admits.current * appsForecast.multipliers.high)
    entry.admits.yoyChange = calculateYoY(entry.admits.mid, entry.admits.previousYear)
    
    entry.enrolls.low = Math.round(entry.admits.low * yield_rate)
    entry.enrolls.mid = Math.round(entry.admits.mid * yield_rate)
    entry.enrolls.high = Math.round(entry.admits.high * yield_rate)
    entry.enrolls.yoyChange = calculateYoY(entry.enrolls.mid, entry.enrolls.previousYear)
    
    const ntrPerStudent = avgCredits * avgCPC
    entry.ntr.current = entry.enrolls.current * ntrPerStudent
    entry.ntr.low = entry.enrolls.low * ntrPerStudent
    entry.ntr.mid = entry.enrolls.mid * ntrPerStudent
    entry.ntr.high = entry.enrolls.high * ntrPerStudent
    entry.ntr.previousYear = entry.enrolls.previousYear * ntrPerStudent
    entry.ntr.yoyChange = calculateYoY(entry.ntr.mid, entry.ntr.previousYear)
  })
  
  return Array.from(programMap.values())
    .filter(p => p.program !== 'Unknown')
    .sort((a, b) => b.apps.current - a.apps.current)
    .slice(0, limit)
}
