import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  RotateCcw,
  ChevronDown,
  Sparkles,
  Target,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { useData, useNTR, useGraduation } from '@/hooks/useData'
import { useNavsStore } from '@/store/navsStore'
import { GlassCard } from '@/components/shared/GlassCard'
import { ChartSkeleton } from '@/components/shared/SkeletonLoader'
import { GaugeChart } from '@/components/charts/GaugeChart'

interface CategoryProjection {
  category: string
  lastTermNew: number
  targetNew: number
  avgCredits: number
  cpcRate: number
  projectedNTR: number
}

interface ProjectionState {
  // Attrition rate for continuing students
  attritionRate: number
  // Category-specific new student targets
  categoryTargets: Record<string, number>
  // Whether to use overall percentage instead of category targets
  useOverallPercent: boolean
  // Overall percentage increase for new students
  overallPercent: number
}

const DEFAULT_ATTRITION_RATE = 0.085 // 8.5%
const DEFAULT_AVG_CREDITS = 6.0

// Category order and CPC rates (new students)
const CATEGORY_CONFIG: Record<string, { order: number; cpcNew: number; cpcCurrent: number; avgCredits: number }> = {
  'Select Professional Online': { order: 1, cpcNew: 1395, cpcCurrent: 1650, avgCredits: 6.5 },
  'Retail': { order: 2, cpcNew: 1395, cpcCurrent: 1723, avgCredits: 6.0 },
  'Corporate': { order: 3, cpcNew: 1300, cpcCurrent: 1550, avgCredits: 6.2 },
  'Beacon': { order: 4, cpcNew: 290, cpcCurrent: 290, avgCredits: 6.0 },
  'ASAP': { order: 5, cpcNew: 875, cpcCurrent: 875, avgCredits: 4.0 },
  'CPE': { order: 6, cpcNew: 800, cpcCurrent: 800, avgCredits: 6.0 },
}

export function NTRProjector() {
  const { data, isLoading } = useData()
  const ntr = useNTR()
  const graduation = useGraduation()
  const { sendMessage } = useNavsStore()
  
  // Projection state
  const [projectionState, setProjectionState] = useState<ProjectionState>({
    attritionRate: DEFAULT_ATTRITION_RATE,
    categoryTargets: {},
    useOverallPercent: false,
    overallPercent: 5,
  })
  
  const [showDetails, setShowDetails] = useState(false)
  
  // Calculate historical new students by category
  const historicalByCategory = useMemo(() => {
    if (!data?.historicalByCategory) return {}
    
    const result: Record<string, number> = {}
    Object.entries(data.historicalByCategory as Record<string, { enrollments: number[] }>).forEach(([cat, hist]) => {
      // Get last term's enrollments (index 2 is current, so index 1 is previous)
      const enrolls = hist.enrollments || []
      result[cat] = enrolls[enrolls.length - 1] || 0
    })
    return result
  }, [data?.historicalByCategory])
  
  // Calculate continuing students projection
  const continuingProjection = useMemo(() => {
    if (!ntr || !graduation) {
      return {
        currentStudents: 0,
        graduating: 0,
        attrition: 0,
        continuing: 0,
        avgCredits: DEFAULT_AVG_CREDITS,
        cpcRate: 1500, // Average
        projectedNTR: 0,
      }
    }
    
    const currentStudents = ntr.currentStudents || 0
    const graduating = graduation.graduatingThisTerm || 0
    const nonGraduating = currentStudents - graduating
    const attrition = Math.round(nonGraduating * projectionState.attritionRate)
    const continuing = nonGraduating - attrition
    
    // Calculate weighted average CPC for current students
    const avgCredits = ntr.totalCredits && ntr.totalStudents 
      ? ntr.totalCredits / ntr.totalStudents 
      : DEFAULT_AVG_CREDITS
    
    // Use current NTR to estimate average CPC
    const avgCPC = ntr.currentNTR && ntr.currentCredits 
      ? ntr.currentNTR / ntr.currentCredits 
      : 1550
    
    const projectedNTR = continuing * avgCredits * avgCPC
    
    return {
      currentStudents,
      graduating,
      attrition,
      continuing,
      avgCredits,
      cpcRate: avgCPC,
      projectedNTR,
    }
  }, [ntr, graduation, projectionState.attritionRate])
  
  // Calculate new student projections by category
  const categoryProjections = useMemo((): CategoryProjection[] => {
    const categories = Object.keys(CATEGORY_CONFIG)
    
    return categories.map(category => {
      const config = CATEGORY_CONFIG[category]
      const lastTermNew = historicalByCategory[category] || 0
      
      // Get target from state or calculate from overall percent
      let targetNew: number
      if (projectionState.useOverallPercent) {
        targetNew = Math.round(lastTermNew * (1 + projectionState.overallPercent / 100))
      } else {
        targetNew = projectionState.categoryTargets[category] ?? lastTermNew
      }
      
      const projectedNTR = targetNew * config.avgCredits * config.cpcNew
      
      return {
        category,
        lastTermNew,
        targetNew,
        avgCredits: config.avgCredits,
        cpcRate: config.cpcNew,
        projectedNTR,
      }
    }).sort((a, b) => CATEGORY_CONFIG[a.category].order - CATEGORY_CONFIG[b.category].order)
  }, [historicalByCategory, projectionState])
  
  // Total new student NTR
  const newStudentTotals = useMemo(() => {
    const totalLast = categoryProjections.reduce((sum, c) => sum + c.lastTermNew, 0)
    const totalTarget = categoryProjections.reduce((sum, c) => sum + c.targetNew, 0)
    const totalNTR = categoryProjections.reduce((sum, c) => sum + c.projectedNTR, 0)
    
    return { totalLast, totalTarget, totalNTR }
  }, [categoryProjections])
  
  // Grand total projection
  const grandTotal = useMemo(() => {
    const total = continuingProjection.projectedNTR + newStudentTotals.totalNTR
    const goal = ntr?.goal || 9_800_000
    const vsGoal = total - goal
    const vsGoalPercent = (vsGoal / goal) * 100
    
    return { total, goal, vsGoal, vsGoalPercent }
  }, [continuingProjection.projectedNTR, newStudentTotals.totalNTR, ntr?.goal])
  
  // Handlers
  const updateCategoryTarget = useCallback((category: string, value: number) => {
    setProjectionState(prev => ({
      ...prev,
      categoryTargets: { ...prev.categoryTargets, [category]: value },
      useOverallPercent: false,
    }))
  }, [])
  
  const updateAttritionRate = useCallback((rate: number) => {
    setProjectionState(prev => ({ ...prev, attritionRate: rate }))
  }, [])
  
  const updateOverallPercent = useCallback((percent: number) => {
    setProjectionState(prev => ({ 
      ...prev, 
      overallPercent: percent,
      useOverallPercent: true,
    }))
  }, [])
  
  const resetProjection = useCallback(() => {
    setProjectionState({
      attritionRate: DEFAULT_ATTRITION_RATE,
      categoryTargets: {},
      useOverallPercent: false,
      overallPercent: 5,
    })
  }, [])
  
  const askNavsForInsights = useCallback(() => {
    const context = `
NTR Projection Analysis:
- Current Term NTR: ${formatCurrency(ntr?.total || 0)}
- Goal: ${formatCurrency(grandTotal.goal)}
- Projected Continuing NTR: ${formatCurrency(continuingProjection.projectedNTR)}
- Projected New Student NTR: ${formatCurrency(newStudentTotals.totalNTR)}
- Projected Total: ${formatCurrency(grandTotal.total)}
- vs Goal: ${grandTotal.vsGoal >= 0 ? '+' : ''}${formatCurrency(grandTotal.vsGoal)} (${grandTotal.vsGoalPercent.toFixed(1)}%)

Category Targets:
${categoryProjections.map(c => `- ${c.category}: ${c.targetNew} (last term: ${c.lastTermNew})`).join('\n')}

Assumptions:
- Attrition rate: ${formatPercent(projectionState.attritionRate * 100)}
- Graduating students: ${continuingProjection.graduating}
`
    
    sendMessage(`Based on my NTR projection, are my new student targets realistic? Here's the context:\n${context}`)
  }, [ntr, grandTotal, continuingProjection, newStudentTotals, categoryProjections, projectionState, sendMessage])
  
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <ChartSkeleton height={200} />
        <ChartSkeleton height={400} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calculator className="h-6 w-6 text-[var(--color-accent-primary)]" />
            NTR Projection Calculator
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Project next term's Net Tuition Revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetProjection}
            className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={askNavsForInsights}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-primary)] text-white rounded-lg hover:bg-[var(--color-accent-primary)]/80 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Ask Navs
          </button>
        </div>
      </motion.div>

      {/* Current Term Status */}
      <GlassCard className="border-l-4 border-l-[var(--color-accent-primary)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--color-text-muted)]">Current Term NTR</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(ntr?.total || 0, true)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[var(--color-text-muted)]">of {formatCurrency(ntr?.goal || 0, true)} goal</div>
            <div className={cn(
              'text-xl font-bold',
              (ntr?.percentOfGoal || 0) >= 100 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'
            )}>
              {formatPercent(ntr?.percentOfGoal || 0)}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Projection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Continuing Students Section */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-[var(--color-accent-primary)]" />
            <h3 className="text-lg font-semibold text-white">Continuing Students</h3>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MetricRow 
                label="Current Students" 
                value={formatNumber(continuingProjection.currentStudents)} 
              />
              <MetricRow 
                label="Graduating" 
                value={`-${formatNumber(continuingProjection.graduating)}`}
                valueColor="var(--color-warning)"
              />
            </div>
            
            {/* Attrition Rate Slider */}
            <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-[var(--color-text-muted)]">Attrition Rate</label>
                <span className="text-sm font-medium text-white">
                  {formatPercent(projectionState.attritionRate * 100)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={projectionState.attritionRate * 100}
                onChange={(e) => updateAttritionRate(parseFloat(e.target.value) / 100)}
                className="w-full h-2 rounded-full appearance-none bg-[var(--color-bg-surface)] cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--color-accent-primary) ${projectionState.attritionRate * 500}%, var(--color-bg-surface) ${projectionState.attritionRate * 500}%)`
                }}
              />
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                Est. not returning: {formatNumber(continuingProjection.attrition)}
              </div>
            </div>
            
            <div className="pt-4 border-t border-[var(--color-border-subtle)]">
              <div className="grid grid-cols-2 gap-4">
                <MetricRow 
                  label="= Continuing" 
                  value={formatNumber(continuingProjection.continuing)}
                  valueColor="var(--color-success)"
                />
                <MetricRow 
                  label="Avg Credits" 
                  value={continuingProjection.avgCredits.toFixed(1)}
                />
              </div>
              <div className="mt-4 p-3 rounded-lg bg-[var(--color-accent-primary)]/10">
                <div className="text-sm text-[var(--color-text-muted)]">Projected Continuing NTR</div>
                <div className="text-2xl font-bold text-[var(--color-accent-primary)]">
                  {formatCurrency(continuingProjection.projectedNTR, true)}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* New Students Section */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[var(--color-success)]" />
              <h3 className="text-lg font-semibold text-white">New Student Projections</h3>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-[var(--color-accent-primary)] flex items-center gap-1"
            >
              Details
              <ChevronDown className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')} />
            </button>
          </div>
          
          {/* Overall Percent Toggle */}
          <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)] mb-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useOverall"
                checked={projectionState.useOverallPercent}
                onChange={(e) => setProjectionState(prev => ({
                  ...prev,
                  useOverallPercent: e.target.checked,
                }))}
                className="h-4 w-4 rounded border-[var(--color-border-subtle)] text-[var(--color-accent-primary)]"
              />
              <label htmlFor="useOverall" className="text-sm text-[var(--color-text-secondary)]">
                Apply same % increase to all
              </label>
              {projectionState.useOverallPercent && (
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="number"
                    value={projectionState.overallPercent}
                    onChange={(e) => updateOverallPercent(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-sm text-right bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded text-white"
                  />
                  <span className="text-sm text-[var(--color-text-muted)]">%</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Category Inputs */}
          <div className="space-y-3">
            {categoryProjections.map((cat) => (
              <div 
                key={cat.category}
                className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0"
              >
                <div className="flex-1">
                  <div className="text-sm text-[var(--color-text-secondary)]">{cat.category}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Last: {cat.lastTermNew} | Credits: {cat.avgCredits}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={cat.targetNew}
                    onChange={(e) => updateCategoryTarget(cat.category, parseInt(e.target.value) || 0)}
                    disabled={projectionState.useOverallPercent}
                    className={cn(
                      'w-20 px-2 py-1 text-sm text-right bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded text-white',
                      projectionState.useOverallPercent && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                  {showDetails && (
                    <span className="text-sm text-[var(--color-text-muted)] w-24 text-right">
                      {formatCurrency(cat.projectedNTR, true)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[var(--color-text-muted)]">
                Total: {formatNumber(newStudentTotals.totalLast)} → {formatNumber(newStudentTotals.totalTarget)}
              </div>
              <div className={cn(
                'text-sm font-medium',
                newStudentTotals.totalTarget > newStudentTotals.totalLast 
                  ? 'text-[var(--color-success)]' 
                  : 'text-[var(--color-danger)]'
              )}>
                {newStudentTotals.totalTarget > newStudentTotals.totalLast ? '+' : ''}
                {formatNumber(newStudentTotals.totalTarget - newStudentTotals.totalLast)}
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-[var(--color-success)]/10">
              <div className="text-sm text-[var(--color-text-muted)]">Projected New Student NTR</div>
              <div className="text-2xl font-bold text-[var(--color-success)]">
                {formatCurrency(newStudentTotals.totalNTR, true)}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Projection Summary */}
      <GlassCard className="bg-gradient-to-r from-[var(--color-bg-surface)] to-[var(--color-accent-primary)]/10">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-[var(--color-accent-primary)]" />
          <h3 className="text-lg font-semibold text-white">Projection Summary</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg bg-[var(--color-bg-base)]/50">
            <div className="text-sm text-[var(--color-text-muted)] mb-1">Continuing NTR</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(continuingProjection.projectedNTR, true)}
            </div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-[var(--color-bg-base)]/50">
            <div className="text-sm text-[var(--color-text-muted)] mb-1">New Student NTR</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(newStudentTotals.totalNTR, true)}
            </div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-[var(--color-accent-primary)]/20">
            <div className="text-sm text-[var(--color-text-muted)] mb-1">Projected Total</div>
            <div className="text-3xl font-bold text-[var(--color-accent-primary)]">
              {formatCurrency(grandTotal.total, true)}
            </div>
            <div className={cn(
              'text-sm font-medium mt-1',
              grandTotal.vsGoal >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
            )}>
              vs Goal: {grandTotal.vsGoal >= 0 ? '+' : ''}{formatCurrency(grandTotal.vsGoal, true)} 
              ({grandTotal.vsGoalPercent >= 0 ? '+' : ''}{grandTotal.vsGoalPercent.toFixed(1)}%)
            </div>
          </div>
        </div>
        
        {/* Visual Comparison */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <GaugeChart 
            value={ntr?.total || 0} 
            goal={ntr?.goal || 9_800_000} 
            title="Current Term" 
          />
          <GaugeChart 
            value={grandTotal.total} 
            goal={grandTotal.goal} 
            title="Projected Next Term" 
          />
        </div>
      </GlassCard>
    </div>
  )
}

// Helper component
function MetricRow({ 
  label, 
  value, 
  valueColor 
}: { 
  label: string
  value: string | number
  valueColor?: string 
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <span 
        className="text-sm font-medium"
        style={{ color: valueColor || 'white' }}
      >
        {value}
      </span>
    </div>
  )
}
