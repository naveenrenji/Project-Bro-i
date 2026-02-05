/**
 * Command Center - Executive Dashboard
 * 
 * Glanceable overview for leadership showing:
 * - NTR current + projected with full digits
 * - Total / New / Continuing student metrics
 * - Enrollment funnel with status
 * - Health status badges (YoY, yield, categories)
 * - Top 5 / Bottom 5 performers
 * - Deep dive links throughout
 */

import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useData } from '@/hooks/useData'
import { 
  useFilteredFunnel, 
  useFilteredNTR, 
  useIsFiltered, 
  useFilterSummary,
  useFilteredCategories,
} from '@/hooks/useFilteredData'
import { useForecast } from '@/hooks/useForecast'
import { useTopPerformers, useNeedsAttention, useStudentMetrics } from '@/hooks/useProgramInsights'
import { useUIStore, type DeepDiveSource } from '@/store/uiStore'
import { SankeyFlow } from '@/components/charts/SankeyFlow'
import { NTRMeter } from '@/components/charts/NTRMeter'
import { StudentMetricsRow } from '@/components/charts/StudentMetricsRow'
import { HealthStatusPanel } from '@/components/charts/HealthStatusPanel'
import { PerformerPanels } from '@/components/charts/PerformerTable'
import { NavsAlert } from '@/components/navs/NavsAlert'
import { NavsInput } from '@/components/navs/NavsInput'
import { KPICardSkeleton, ChartSkeleton } from '@/components/shared/SkeletonLoader'
import { Filter, ArrowRight } from 'lucide-react'

// Deep Dive Link component for consistent styling
function DeepDiveLink({ 
  tab, 
  source, 
  label = 'Deep Dive' 
}: { 
  tab: string
  source: DeepDiveSource
  label?: string 
}) {
  const navigate = useNavigate()
  const navigateToDeepDive = useUIStore((s) => s.navigateToDeepDive)
  
  const handleClick = () => {
    navigateToDeepDive(tab, source)
    navigate('/explore')
  }
  
  return (
    <button
      onClick={handleClick}
      className="group flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)] transition-colors"
    >
      <span>{label}</span>
      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
    </button>
  )
}

export function CommandCenter() {
  const { data, isLoading } = useData()
  const alerts = data?.alerts ?? []
  
  // Filtered data hooks
  const filteredFunnel = useFilteredFunnel()
  const filteredNTR = useFilteredNTR()
  const isFiltered = useIsFiltered()
  const filterSummary = useFilterSummary()
  const filteredCategories = useFilteredCategories()
  
  // Forecast data
  const { metrics: forecast, params: forecastParams } = useForecast()
  
  // Program insights
  const topPerformers = useTopPerformers(5)
  const needsAttention = useNeedsAttention(5)
  const studentMetrics = useStudentMetrics()
  
  // Loading state
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton height={300} />
      </div>
    )
  }
  
  // Calculate category performance for health panel
  const categoryPerformance = filteredCategories
    .slice(0, 4)
    .map(cat => ({
      category: cat.category,
      yoyChange: data.categories?.find(c => c.category === cat.category)?.ntr 
        ? ((cat.enrollments - (data.categories?.find(c => c.category === cat.category)?.enrollments || 0)) / 
           (data.categories?.find(c => c.category === cat.category)?.enrollments || 1)) * 100
        : 0
    }))
  
  // NTR values
  const currentNTR = filteredNTR?.total ?? data.ntr.total
  const ntrGoal = filteredNTR?.goal ?? data.ntr.goal
  const projectedNTR = forecast?.ntr.mid ?? currentNTR
  const projectedNTRLow = forecast?.ntr.low ?? currentNTR
  const projectedNTRHigh = forecast?.ntr.high ?? currentNTR
  const previousNTR = forecast?.ntr.previousYear ?? data.ntr.total * 0.9
  
  // Yield rate
  const yieldRate = filteredFunnel.length >= 4 
    ? filteredFunnel[3].conversionRate 
    : data.kpis.yield?.value ?? 78
  
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-[var(--color-text-muted)]">
            Executive enrollment intelligence at a glance
          </p>
          {/* Filter indicator */}
          {isFiltered && filterSummary && (
            <div className="flex items-center gap-2 mt-1 text-sm text-[var(--color-accent-primary)]">
              <Filter className="h-3 w-3" />
              <span>Filtered: {filterSummary}</span>
            </div>
          )}
        </div>
        <div className="text-sm text-[var(--color-text-muted)]">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </div>
      </motion.div>
      
      {/* Alerts */}
      {alerts.length > 0 && <NavsAlert alerts={alerts} />}
      
      {/* NTR Section - Current + Projected + Goal Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <div className="absolute top-4 right-4 z-10 flex gap-3">
          <DeepDiveLink tab="revenue" source="ntr-meter" label="Revenue Details" />
          <DeepDiveLink tab="forecast" source="ntr-meter" label="View Projections" />
        </div>
        <NTRMeter
          current={currentNTR}
          goal={ntrGoal}
          projected={projectedNTR}
          projectedLow={projectedNTRLow}
          projectedHigh={projectedNTRHigh}
          previousYear={previousNTR}
          showProjection={true}
        />
      </motion.div>
      
      {/* Student Metrics - Total / New / Continuing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <div className="absolute top-3 right-4 z-10">
          <DeepDiveLink tab="students" source="student-metrics" label="Student Details" />
        </div>
        <StudentMetricsRow
          total={studentMetrics.total}
          newStudents={studentMetrics.new}
          continuing={studentMetrics.continuing}
        />
      </motion.div>
      
      {/* Main Content Grid - Funnel + Health Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollment Funnel - 2 columns */}
        <motion.div 
          className="lg:col-span-2 relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="absolute top-4 right-4 z-10">
            <DeepDiveLink tab="pipeline" source="funnel" label="Pipeline Details" />
          </div>
          <SankeyFlow 
            data={filteredFunnel} 
            title={isFiltered ? "Filtered Enrollment Flow" : "Live Enrollment Flow"} 
          />
        </motion.div>
        
        {/* Health Status Panel - 1 column */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative"
        >
          <div className="absolute top-4 right-4 z-10">
            <DeepDiveLink tab="trends" source="health-status" label="View Trends" />
          </div>
          <HealthStatusPanel
            yoyApps={forecast?.apps.yoyChange}
            yoyEnrolls={forecast?.enrolls.yoyChange}
            yieldRate={yieldRate}
            categoryPerformance={categoryPerformance}
          />
        </motion.div>
      </div>
      
      {/* Top 5 / Bottom 5 Performers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative"
      >
        <div className="absolute top-4 right-4 z-10">
          <DeepDiveLink tab="programs" source="performers" label="All Programs" />
        </div>
        <PerformerPanels
          topPerformers={topPerformers}
          needsAttention={needsAttention}
          limit={5}
        />
      </motion.div>
      
      {/* Forecast Parameters (subtle display) */}
      {forecastParams && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)] px-4 py-3 bg-[var(--color-bg-secondary)]/50 rounded-lg"
        >
          <span>
            <strong>Run Rate:</strong> {forecastParams.weeklyRunRate} apps/week
          </span>
          <span>
            <strong>Weeks to Deadline:</strong> {forecastParams.weeksRemaining}
          </span>
          <span>
            <strong>Growth Multiplier:</strong> {forecastParams.growthMultiplierMid}x
          </span>
          <span>
            <strong>Avg Yield:</strong> {(forecastParams.avgHistoricalYield * 100).toFixed(1)}%
          </span>
        </motion.div>
      )}
      
      {/* Ask Navs Input */}
      <NavsInput context="commandCenter" />
    </div>
  )
}
