/**
 * Program Classification Utility
 * 
 * Classifies programs into performance tiers based on enrollment thresholds.
 */

export type PerformanceTier = 'top' | 'middle' | 'needsAttention'

export interface ClassifiedProgram {
  program: string
  school: string
  degreeType: string
  category: string
  total: number
  newStudents: number
  continuing: number
  yoyChange: number
  tier: PerformanceTier
}

/**
 * Classification thresholds
 */
export const TIER_THRESHOLDS = {
  TOP: 100,      // > 100 students = top performer
  MIDDLE: 20,   // 20-100 students = middle bunch
  // < 20 students = needs attention
}

/**
 * Classify a program based on enrollment count
 */
export function classifyProgram(enrollments: number): PerformanceTier {
  if (enrollments > TIER_THRESHOLDS.TOP) return 'top'
  if (enrollments >= TIER_THRESHOLDS.MIDDLE) return 'middle'
  return 'needsAttention'
}

/**
 * Get tier display info
 */
export function getTierInfo(tier: PerformanceTier): {
  label: string
  color: string
  bgColor: string
  description: string
} {
  switch (tier) {
    case 'top':
      return {
        label: 'Top Performer',
        color: 'var(--color-success)',
        bgColor: 'rgba(34, 197, 94, 0.1)',
        description: `Programs with more than ${TIER_THRESHOLDS.TOP} enrolled students`
      }
    case 'middle':
      return {
        label: 'Middle Bunch',
        color: 'var(--color-warning)',
        bgColor: 'rgba(245, 158, 11, 0.1)',
        description: `Programs with ${TIER_THRESHOLDS.MIDDLE}-${TIER_THRESHOLDS.TOP} enrolled students`
      }
    case 'needsAttention':
      return {
        label: 'Needs Attention',
        color: 'var(--color-danger)',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        description: `Programs with fewer than ${TIER_THRESHOLDS.MIDDLE} enrolled students`
      }
  }
}

/**
 * Get tier counts summary
 */
export function getTierSummary(programs: ClassifiedProgram[]): {
  top: number
  middle: number
  needsAttention: number
  total: number
} {
  return {
    top: programs.filter(p => p.tier === 'top').length,
    middle: programs.filter(p => p.tier === 'middle').length,
    needsAttention: programs.filter(p => p.tier === 'needsAttention').length,
    total: programs.length,
  }
}

/**
 * Sort programs by tier priority (top first, then needs attention, then middle)
 */
export function sortByTierPriority(programs: ClassifiedProgram[]): ClassifiedProgram[] {
  const tierOrder: Record<PerformanceTier, number> = {
    top: 0,
    needsAttention: 1,
    middle: 2,
  }
  
  return [...programs].sort((a, b) => {
    // First sort by tier
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier]
    if (tierDiff !== 0) return tierDiff
    
    // Then by enrollment count (descending)
    return b.total - a.total
  })
}
