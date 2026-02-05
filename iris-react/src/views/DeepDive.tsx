import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, GitBranch, PieChart as PieChartIcon, Users, TrendingUp, GraduationCap, ChevronDown, ChevronRight, Filter, BarChart, Building2, Briefcase } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { useData, useNTR, useNTRBreakdown, useNTRByStudentType, useGraduation, useDemographics, useYoY, useBySchool, useByDegree } from '@/hooks/useData'
import { useFilteredGraduation, useFilteredMetrics, useFilteredDemographics, useFilteredHistorical, useFilteredPrograms, usePipelinePrograms, useAverageCredits, useIsFiltered, useFilterSummary } from '@/hooks/useFilteredData'
import { useForecast, useForecastByCategory, useForecastByProgram } from '@/hooks/useForecast'
import { useProgramInsights } from '@/hooks/useProgramInsights'
import { useCorporateCohorts, useCorporateCohortSummary } from '@/hooks/useCorporateCohorts'
import { DEEP_DIVE_TABS } from '@/lib/constants'
import { GlassCard } from '@/components/shared/GlassCard'
import { GaugeChart } from '@/components/charts/GaugeChart'
import { SankeyFlow } from '@/components/charts/SankeyFlow'
import { NTRBarChart, NTRPieChart, NTRSummaryCards, NTRBreakdownTable, AvgCreditsChart } from '@/components/charts/NTRBreakdown'
import { TimelineChart } from '@/components/charts/TimelineChart'
import { ForecastTable } from '@/components/charts/ForecastTable'
import { ForecastByCategory } from '@/components/charts/ForecastByCategory'
import { ForecastByProgram } from '@/components/charts/ForecastByProgram'
import { PerformerPanels } from '@/components/charts/PerformerTable'
import { NavsInput } from '@/components/navs/NavsInput'
import { ChartSkeleton } from '@/components/shared/SkeletonLoader'
import { useState } from 'react'

const iconMap = {
  DollarSign,
  GitBranch,
  PieChart: PieChartIcon,
  Users,
  TrendingUp,
  BarChart,
}

// Source labels for breadcrumb
const SOURCE_LABELS: Record<string, string> = {
  'ntr-meter': 'NTR Meter',
  'student-metrics': 'Student Metrics',
  'funnel': 'Enrollment Funnel',
  'health-status': 'Health Status',
  'performers': 'Program Performers',
}

export function DeepDive() {
  const { activeDeepDiveTab, setActiveDeepDiveTab, deepDiveSource, clearDeepDiveSource } = useUIStore()
  const { data, isLoading } = useData()
  const isFiltered = useIsFiltered()
  const filterSummary = useFilterSummary()
  
  const getTabIcon = (iconName: string) => {
    return iconMap[iconName as keyof typeof iconMap] || DollarSign
  }
  
  // Get source label for breadcrumb
  const sourceLabel = deepDiveSource ? SOURCE_LABELS[deepDiveSource] : null
  
  return (
    <div className="space-y-6">
      {/* Source Breadcrumb */}
      {sourceLabel && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-sm"
        >
          <a 
            href="/"
            onClick={(e) => {
              e.preventDefault()
              clearDeepDiveSource()
              window.location.href = '/'
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)] transition-colors"
          >
            Command Center
          </a>
          <span className="text-[var(--color-text-muted)]">/</span>
          <span className="text-[var(--color-accent-primary)]">From: {sourceLabel}</span>
        </motion.div>
      )}
      
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Deep Dive</h1>
          <p className="text-[var(--color-text-muted)]">
            Explore and analyze enrollment data
          </p>
          {/* Filter indicator */}
          {isFiltered && filterSummary && (
            <div className="flex items-center gap-2 mt-1 text-sm text-[var(--color-accent-primary)]">
              <Filter className="h-3 w-3" />
              <span>Filtered: {filterSummary}</span>
            </div>
          )}
        </div>
        {data && (
          <div className="text-xs text-[var(--color-text-muted)]">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </div>
        )}
      </motion.div>
      
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {DEEP_DIVE_TABS.map((tab) => {
          const Icon = getTabIcon(tab.icon)
          const isActive = activeDeepDiveTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveDeepDiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'text-white'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-surface)]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="deep-dive-tab"
                  className="absolute inset-0 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
      
      {/* Tab Content */}
      {isLoading || !data ? (
        <div className="space-y-6">
          <ChartSkeleton height={200} />
          <ChartSkeleton height={300} />
        </div>
      ) : (
        <motion.div
          key={activeDeepDiveTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeDeepDiveTab === 'revenue' && <RevenueTab data={data} />}
          {activeDeepDiveTab === 'pipeline' && <PipelineTab data={data} />}
          {activeDeepDiveTab === 'forecast' && <ForecastTab />}
          {activeDeepDiveTab === 'programs' && <ProgramsTab data={data} />}
          {activeDeepDiveTab === 'students' && <StudentsTab data={data} />}
          {activeDeepDiveTab === 'trends' && <TrendsTab data={data} />}
        </motion.div>
      )}
      
      {/* Ask Navs */}
      <NavsInput 
        context={activeDeepDiveTab as 'revenue' | 'pipeline' | 'programs' | 'students' | 'trends'} 
      />
    </div>
  )
}

// Revenue Tab - Enhanced with NTR breakdown components
function RevenueTab({ data: _data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const ntr = useNTR()
  const breakdown = useNTRBreakdown()
  const byStudentType = useNTRByStudentType()
  const avgCredits = useAverageCredits()
  const [showBreakdown, setShowBreakdown] = useState(false)
  
  // Use hooks for data instead of prop
  void _data
  if (!ntr) return null

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      <GlassCard className="border-l-4 border-l-[var(--color-accent-primary)]">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center shrink-0">
            <DollarSign className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Navs Summary</h3>
            <p className="text-[var(--color-text-secondary)]">
              NTR is at <strong className="text-white">{formatCurrency(ntr.total, true)}</strong> ({formatPercent(ntr.percentOfGoal || (ntr.total / ntr.goal) * 100)} of goal). 
              New students contribute <strong className="text-white">{formatCurrency(ntr.newNTR, true)}</strong> ({formatPercent((ntr.newNTR / ntr.total) * 100)}). 
              Gap to goal: <strong className="text-[var(--color-warning)]">{formatCurrency(ntr.gapToGoal || (ntr.goal - ntr.total), true)}</strong>.
              {avgCredits.overall > 0 && (
                <> Average credits per student: <strong className="text-white">{avgCredits.overall}</strong>.</>
              )}
            </p>
          </div>
        </div>
      </GlassCard>
      
      {/* NTR Summary Cards */}
      <NTRSummaryCards
        total={ntr.total}
        goal={ntr.goal}
        percentOfGoal={ntr.percentOfGoal || (ntr.total / ntr.goal) * 100}
        newNTR={ntr.newNTR}
        currentNTR={ntr.currentNTR}
        totalStudents={ntr.totalStudents || 0}
        totalCredits={ntr.totalCredits || 0}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GaugeChart value={ntr.total} goal={ntr.goal} title="NTR Progress" />
        
        {byStudentType.length > 0 && (
          <NTRPieChart data={byStudentType} title="NTR by Student Type" />
        )}
      </div>
      
      {/* NTR by Category Bar Chart */}
      {ntr.byCategory?.length > 0 && (
        <NTRBarChart data={ntr.byCategory} title="NTR by Category" />
      )}
      
      {/* Average Credits per Student */}
      {avgCredits.byCategory.length > 0 && (
        <AvgCreditsChart 
          byCategory={avgCredits.byCategory}
          byStudentType={avgCredits.byStudentType}
          overall={avgCredits.overall}
        />
      )}
      
      {/* Expandable Detailed Breakdown */}
      <GlassCard>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="text-lg font-semibold text-white">Detailed NTR Breakdown</h3>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--color-text-muted)] transition-transform',
            showBreakdown && 'rotate-180'
          )} />
        </button>
        
        {showBreakdown && breakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4"
          >
            <NTRBreakdownTable data={breakdown} title="" />
          </motion.div>
        )}
      </GlassCard>
    </div>
  )
}

// Forecast Tab - Enrollment and NTR projections
function ForecastTab() {
  const { metrics: forecast, params: forecastParams, isLoading } = useForecast()
  const categoryForecasts = useForecastByCategory()
  const programForecasts = useForecastByProgram(20)
  const isFiltered = useIsFiltered()
  const filterSummary = useFilterSummary()
  
  if (isLoading || !forecast) {
    return (
      <div className="space-y-6">
        <ChartSkeleton height={200} />
        <ChartSkeleton height={300} />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* AI Summary */}
      <GlassCard className="border-l-4 border-l-[var(--color-accent-primary)]">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">
              Navs Forecast Summary
              {isFiltered && <span className="ml-2 text-xs font-normal text-[var(--color-accent-primary)]">(Filtered: {filterSummary})</span>}
            </h3>
            <p className="text-[var(--color-text-secondary)]">
              Projecting <strong className="text-white">{formatNumber(forecast.apps.mid)}</strong> applications by deadline
              ({forecast.apps.yoyChange >= 0 ? '+' : ''}{forecast.apps.yoyChange}% YoY).
              Expected enrollments: <strong className="text-white">{formatNumber(forecast.enrolls.mid)}</strong>.
              Projected NTR: <strong className="text-[var(--color-success)]">{formatCurrency(forecast.ntr.mid, true)}</strong>.
              {forecastParams && (
                <> Model using {forecastParams.weeklyRunRate} apps/week run rate with {(forecastParams.avgHistoricalYield * 100).toFixed(0)}% historical yield.</>
              )}
            </p>
          </div>
        </div>
      </GlassCard>
      
      {/* Overall Forecast Summary */}
      <ForecastTable 
        metrics={forecast} 
        params={forecastParams ?? undefined}
        title="Forecast Summary - 2026 Term" 
      />
      
      {/* Forecast by Category */}
      {categoryForecasts.length > 0 && (
        <ForecastByCategory data={categoryForecasts} />
      )}
      
      {/* Forecast by Program */}
      {programForecasts.length > 0 && (
        <ForecastByProgram data={programForecasts} />
      )}
    </div>
  )
}

// Pipeline Tab
function PipelineTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDegree, setSelectedDegree] = useState<string | null>(null)
  const [showAllPrograms, setShowAllPrograms] = useState(false)
  const { programsAll: pipelinePrograms } = usePipelinePrograms()
  
  // Get unique degree types from programs
  const degreeTypes = [...new Set(pipelinePrograms.map(p => p.degreeType).filter(Boolean))].sort()
  
  // Get programs with pipeline data from Slate only - filter by category and degree type
  const programsWithPipeline = pipelinePrograms
    .filter(p => p.applications > 0)
    .filter(p => !selectedCategory || p.category === selectedCategory)
    .filter(p => !selectedDegree || p.degreeType === selectedDegree)
    .sort((a, b) => b.applications - a.applications)
  
  const programsToShow = showAllPrograms 
    ? programsWithPipeline 
    : programsWithPipeline.slice(0, 15)
  
  // Calculate filtered funnel metrics from programs
  const filteredFunnelMetrics = {
    applications: programsWithPipeline.reduce((sum, p) => sum + p.applications, 0),
    admits: programsWithPipeline.reduce((sum, p) => sum + p.admits, 0),
    accepted: programsWithPipeline.reduce((sum, p) => sum + (p.accepted ?? 0), 0),
    enrolled: programsWithPipeline.reduce((sum, p) => sum + p.enrollments, 0),
  }
  
  // Build display funnel based on filters
  const displayFunnel = (selectedCategory || selectedDegree) ? [
    { stage: 'Applications', count: filteredFunnelMetrics.applications, conversionRate: 100 },
    { stage: 'Admits', count: filteredFunnelMetrics.admits, conversionRate: filteredFunnelMetrics.applications > 0 ? Math.round((filteredFunnelMetrics.admits / filteredFunnelMetrics.applications) * 100 * 10) / 10 : 0 },
    { stage: 'Accepted', count: filteredFunnelMetrics.accepted, conversionRate: filteredFunnelMetrics.admits > 0 ? Math.round((filteredFunnelMetrics.accepted / filteredFunnelMetrics.admits) * 100 * 10) / 10 : 0 },
    { stage: 'Enrolled', count: filteredFunnelMetrics.enrolled, conversionRate: filteredFunnelMetrics.accepted > 0 ? Math.round((filteredFunnelMetrics.enrolled / filteredFunnelMetrics.accepted) * 100 * 10) / 10 : 0 },
  ] : data.funnel
  
  // Build title based on selections
  const getTitle = () => {
    const parts = []
    if (selectedCategory) parts.push(selectedCategory)
    if (selectedDegree) parts.push(selectedDegree)
    return parts.length > 0 ? `${parts.join(' · ')} Pipeline` : 'Enrollment Pipeline'
  }
  
  return (
    <div className="space-y-6">
      <GlassCard className="border-l-4 border-l-[var(--color-accent-primary)]">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center shrink-0">
            <GitBranch className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Navs Summary</h3>
            <p className="text-[var(--color-text-secondary)]">
              Pipeline shows <strong className="text-white">{formatNumber(displayFunnel[0]?.count || 0)}</strong> applications. 
              Admit rate is <strong className="text-white">{displayFunnel[1]?.conversionRate || 0}%</strong>. 
              Overall yield at <strong className="text-white">{displayFunnel[3]?.conversionRate || 0}%</strong>.
            </p>
          </div>
        </div>
      </GlassCard>
      
      {/* Filters */}
      <div className="space-y-3">
        {/* Category Filter */}
        {data.funnelByCategory && Object.keys(data.funnelByCategory).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider w-20">Category:</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-all',
                !selectedCategory
                  ? 'bg-[var(--color-accent-primary)] text-white'
                  : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-white'
              )}
            >
              All
            </button>
            {Object.keys(data.funnelByCategory).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  selectedCategory === cat
                    ? 'bg-[var(--color-accent-primary)] text-white'
                    : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-white'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        
        {/* Degree Type Filter */}
        {degreeTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider w-20">Degree:</span>
            <button
              onClick={() => setSelectedDegree(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-all',
                !selectedDegree
                  ? 'bg-[var(--color-success)] text-white'
                  : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-white'
              )}
            >
              All
            </button>
            {degreeTypes.map((deg) => (
              <button
                key={deg}
                onClick={() => setSelectedDegree(deg)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  selectedDegree === deg
                    ? 'bg-[var(--color-success)] text-white'
                    : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-white'
                )}
              >
                {deg}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <SankeyFlow 
        data={displayFunnel} 
        title={getTitle()} 
      />
      
      {/* Funnel Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {displayFunnel.map((stage, i) => (
          <GlassCard key={stage.stage} padding="sm">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{stage.stage}</div>
            <div className="text-2xl font-bold text-white">{formatNumber(stage.count)}</div>
            {i > 0 && (
              <div className="text-xs text-[var(--color-text-secondary)]">
                {stage.conversionRate}% conversion
              </div>
            )}
          </GlassCard>
        ))}
      </div>
      
      {/* Program-wise Pipeline Table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[var(--color-accent-primary)]" />
            <h3 className="text-lg font-semibold text-white">
              Pipeline by Program
              {(selectedCategory || selectedDegree) && (
                <span className="ml-2 text-sm font-normal text-[var(--color-accent-primary)]">
                  ({[selectedCategory, selectedDegree].filter(Boolean).join(' · ')})
                </span>
              )}
            </h3>
          </div>
          <button
            onClick={() => setShowAllPrograms(!showAllPrograms)}
            className="text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)]"
          >
            {showAllPrograms ? 'Show Less' : `Show All (${programsWithPipeline.length})`}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th className="text-left py-3 text-[var(--color-text-muted)] font-medium">Program</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Apps</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Admits</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Admit %</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Enrolled</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Yield %</th>
              </tr>
            </thead>
            <tbody>
              {programsToShow.map((prog, i) => {
                const admitRate = prog.applications > 0 
                  ? Math.round((prog.admits / prog.applications) * 100) 
                  : 0
                const yieldRate = prog.admits > 0 
                  ? Math.round((prog.enrollments / prog.admits) * 100) 
                  : 0
                
                return (
                  <tr key={i} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]">
                    <td className="py-3 text-white max-w-[200px] truncate" title={prog.program}>
                      {prog.program}
                    </td>
                    <td className="py-3 text-right text-white tabular-nums">{prog.applications}</td>
                    <td className="py-3 text-right text-white tabular-nums">{prog.admits}</td>
                    <td className={cn(
                      'py-3 text-right tabular-nums',
                      admitRate >= 80 ? 'text-[var(--color-success)]' : 
                      admitRate >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'
                    )}>
                      {admitRate}%
                    </td>
                    <td className="py-3 text-right text-white font-medium tabular-nums">{prog.enrollments}</td>
                    <td className={cn(
                      'py-3 text-right font-medium tabular-nums',
                      yieldRate >= 50 ? 'text-[var(--color-success)]' : 
                      yieldRate >= 30 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'
                    )}>
                      {yieldRate}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Summary Row */}
            <tfoot>
              <tr className="bg-[var(--color-bg-elevated)] font-semibold">
                <td className="py-3 text-white">Total</td>
                <td className="py-3 text-right text-white tabular-nums">
                  {formatNumber(programsWithPipeline.reduce((sum, p) => sum + p.applications, 0))}
                </td>
                <td className="py-3 text-right text-white tabular-nums">
                  {formatNumber(programsWithPipeline.reduce((sum, p) => sum + p.admits, 0))}
                </td>
                <td className="py-3 text-right text-[var(--color-text-muted)]">—</td>
                <td className="py-3 text-right text-[var(--color-accent-primary)] font-bold tabular-nums">
                  {formatNumber(programsWithPipeline.reduce((sum, p) => sum + p.enrollments, 0))}
                </td>
                <td className="py-3 text-right text-[var(--color-text-muted)]">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </GlassCard>
      
      {/* Timeline Chart */}
      {data.timeline && (
        <TimelineChart 
          data={data.timeline} 
          selectedCategory={selectedCategory}
          selectedDegree={selectedDegree}
        />
      )}
    </div>
  )
}

// Programs Tab - Program classification, segmentation, and performance
function ProgramsTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const bySchool = useBySchool()
  const byDegree = useByDegree()
  const { programs: filteredPrograms, programsAll: filteredProgramsAll } = useFilteredPrograms()
  const { topPerformers, needsAttention, summary } = useProgramInsights()
  const isFiltered = useIsFiltered()
  const [showAllPrograms, setShowAllPrograms] = useState(false)
  
  // Use filtered programs when filters are active
  const programs = isFiltered ? filteredPrograms : data.programs
  const programsAll = isFiltered ? filteredProgramsAll : (data.programsAll || data.programs)
  
  const programsToShow = showAllPrograms 
    ? programsAll 
    : programs.slice(0, 10)

  return (
    <div className="space-y-6">
      <GlassCard className="border-l-4 border-l-[var(--color-accent-primary)]">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center shrink-0">
            <PieChartIcon className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Navs Summary</h3>
            <p className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-success)]">{summary.topCount}</strong> top performers, 
              <strong className="text-[var(--color-warning)]"> {summary.middleCount}</strong> middle tier, 
              <strong className="text-[var(--color-danger)]"> {summary.attentionCount}</strong> need attention. 
              {data.categories[0]?.category} leads with <strong className="text-white">{formatNumber(data.categories[0]?.enrollments || 0)}</strong> enrollments.
            </p>
          </div>
        </div>
      </GlassCard>
      
      {/* Program Classification Summary */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">Program Classification</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[var(--color-success)]/10 text-center">
            <div className="text-3xl font-bold text-[var(--color-success)]">{summary.topCount}</div>
            <div className="text-sm text-[var(--color-text-muted)]">Top Performers (&gt;100)</div>
          </div>
          <div className="p-4 rounded-lg bg-[var(--color-warning)]/10 text-center">
            <div className="text-3xl font-bold text-[var(--color-warning)]">{summary.middleCount}</div>
            <div className="text-sm text-[var(--color-text-muted)]">Middle Bunch (20-100)</div>
          </div>
          <div className="p-4 rounded-lg bg-[var(--color-danger)]/10 text-center">
            <div className="text-3xl font-bold text-[var(--color-danger)]">{summary.attentionCount}</div>
            <div className="text-sm text-[var(--color-text-muted)]">Needs Attention (&lt;20)</div>
          </div>
        </div>
      </GlassCard>
      
      {/* Top / Bottom Performers */}
      <PerformerPanels
        topPerformers={topPerformers}
        needsAttention={needsAttention}
        limit={5}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Category */}
        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-4">By Category</h3>
          <div className="space-y-2">
            {data.categories.map((cat, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0">
                <span className="text-[var(--color-text-secondary)] text-sm">{cat.category}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-muted)]">{cat.enrollments}</span>
                  <span className="text-sm font-medium text-white w-12 text-right">{cat.yield}%</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
        
        {/* By School */}
        {bySchool.length > 0 && (
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4">By School</h3>
            <div className="space-y-2">
              {bySchool.map((school, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0">
                  <span className="text-[var(--color-text-secondary)] text-sm">{school.school}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)]">{school.enrollments}</span>
                    <span className="text-sm font-medium text-white w-12 text-right">{school.yield}%</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
        
        {/* By Degree */}
        {byDegree.length > 0 && (
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4">By Degree Type</h3>
            <div className="space-y-2">
              {byDegree.map((deg, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0">
                  <span className="text-[var(--color-text-secondary)] text-sm">{deg.degreeType}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)]">{deg.enrollments}</span>
                    <span className="text-sm font-medium text-white w-12 text-right">{deg.yield}%</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
      
      {/* Programs Table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Programs</h3>
          <button
            onClick={() => setShowAllPrograms(!showAllPrograms)}
            className="text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)]"
          >
            {showAllPrograms ? 'Show Less' : `Show All (${programsAll.length})`}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th className="text-left py-3 text-[var(--color-text-muted)] font-medium">Program</th>
                <th className="text-left py-3 text-[var(--color-text-muted)] font-medium">School</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Enrolled</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">vs 2025</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">vs 2024</th>
              </tr>
            </thead>
            <tbody>
              {programsToShow.map((prog, i) => {
                const progData = prog as { vs2025?: number; vs2024?: number; yoyChange?: number; yoyEnrollChange?: number }
                const vs2025 = progData.vs2025 ?? progData.yoyChange ?? 0
                const vs2024 = progData.vs2024 ?? progData.yoyEnrollChange ?? 0
                return (
                  <tr key={i} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]">
                    <td className="py-3 text-white">{prog.program}</td>
                    <td className="py-3 text-[var(--color-text-secondary)]">{prog.school}</td>
                    <td className="py-3 text-right text-white tabular-nums">{prog.enrollments}</td>
                    <td className={cn(
                      'py-3 text-right font-medium tabular-nums',
                      vs2025 >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                    )}>
                      {vs2025 >= 0 ? '+' : ''}{vs2025}%
                    </td>
                    <td className={cn(
                      'py-3 text-right font-medium tabular-nums',
                      vs2024 >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                    )}>
                      {vs2024 >= 0 ? '+' : ''}{vs2024}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

// Student Tab - Enhanced with graduation tracking and demographics
function StudentsTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const rawGraduation = useGraduation()
  const filteredGraduation = useFilteredGraduation()
  const rawDemographics = useDemographics()
  const filteredDemographics = useFilteredDemographics()
  const filteredMetrics = useFilteredMetrics()
  const isFiltered = useIsFiltered()
  const [showDemographics, setShowDemographics] = useState(false)
  
  // Custom label for pie slices - shows count
  const renderPieLabel = (props: {
    cx?: number, cy?: number, midAngle?: number, innerRadius?: number, outerRadius?: number, value?: number
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0 } = props
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {formatNumber(value)}
      </text>
    )
  }
  
  // Use filtered demographics when filters are active
  const demographics = isFiltered ? filteredDemographics : rawDemographics
  
  // Use filtered data when filters are active
  const graduation = isFiltered ? filteredGraduation : rawGraduation
  const enrollment = isFiltered ? filteredMetrics.enrollment : data.enrollmentBreakdown
  
  return (
    <div className="space-y-6">
      <GlassCard className="border-l-4 border-l-[var(--color-accent-primary)]">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Navs Summary {isFiltered && <span className="text-xs text-[var(--color-accent-primary)]">(Filtered)</span>}</h3>
            <p className="text-[var(--color-text-secondary)]">
              Total enrollment: <strong className="text-white">{formatNumber(isFiltered ? enrollment.total : data.enrollmentBreakdown.total)}</strong> students. 
              {demographics && demographics.domesticInternational?.length > 0 && (
                <><strong className="text-white">{demographics.domesticInternational.find(d => d.status === 'Domestic')?.percentage || 0}%</strong> domestic, <strong className="text-white">{demographics.domesticInternational.find(d => d.status === 'International')?.percentage || 0}%</strong> international. </>
              )}
              {demographics?.ageDistribution && (
                <>Average age: <strong className="text-white">{demographics.ageDistribution.mean}</strong>. </>
              )}
              {graduation && (
                <><strong className="text-[var(--color-warning)]">{graduation.graduatingThisTerm}</strong> graduating this term.</>
              )}
            </p>
          </div>
        </div>
      </GlassCard>
      
      {/* Enrollment Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="text-center" padding="sm">
          <div className="text-3xl font-bold text-white mb-1">{formatNumber(isFiltered ? (enrollment as { newStudents: number }).newStudents : data.enrollmentBreakdown.newSlate)}</div>
          <div className="text-sm text-[var(--color-text-muted)]">New {isFiltered ? 'Students' : '(Slate)'}</div>
        </GlassCard>
        <GlassCard className="text-center" padding="sm">
          <div className="text-3xl font-bold text-white mb-1">{formatNumber(isFiltered ? (enrollment as { currentStudents: number }).currentStudents : data.enrollmentBreakdown.continuing)}</div>
          <div className="text-sm text-[var(--color-text-muted)]">{isFiltered ? 'Current' : 'Continuing'}</div>
        </GlassCard>
        <GlassCard className="text-center" padding="sm">
          <div className="text-3xl font-bold text-white mb-1">{formatNumber(isFiltered ? 0 : data.enrollmentBreakdown.returning)}</div>
          <div className="text-sm text-[var(--color-text-muted)]">Returning</div>
        </GlassCard>
        <GlassCard className="text-center" padding="sm">
          <div className="text-3xl font-bold text-[var(--color-accent-primary)] mb-1">{formatNumber(isFiltered ? enrollment.total : data.enrollmentBreakdown.total)}</div>
          <div className="text-sm text-[var(--color-text-muted)]">Total</div>
        </GlassCard>
      </div>
      
      {/* Demographics Section */}
      {demographics && (
        <>
          <GlassCard>
            <button
              onClick={() => setShowDemographics(!showDemographics)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--color-accent-primary)]" />
                <h3 className="text-lg font-semibold text-white">Student Demographics</h3>
              </div>
              <ChevronDown className={cn(
                'h-5 w-5 text-[var(--color-text-muted)] transition-transform',
                showDemographics && 'rotate-180'
              )} />
            </button>
            
            {showDemographics && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 space-y-6"
              >
                {/* Domestic vs International */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {demographics.domesticInternational.map((item) => (
                    <div key={item.status} className="p-4 rounded-lg bg-[var(--color-bg-elevated)]">
                      <div className="text-2xl font-bold text-white">{formatNumber(item.count)}</div>
                      <div className="text-sm text-[var(--color-text-muted)]">{item.status} ({item.percentage}%)</div>
                    </div>
                  ))}
                  {demographics.ageDistribution && (
                    <>
                      <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)]">
                        <div className="text-2xl font-bold text-white">{demographics.ageDistribution.mean}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">Average Age</div>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)]">
                        <div className="text-2xl font-bold text-white">{demographics.gpaDistribution?.median || '—'}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">Median GPA</div>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Age Distribution */}
                  {demographics.ageDistribution && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Age Distribution</h4>
                      <div className="space-y-2">
                        {[
                          { label: 'Under 25', value: demographics.ageDistribution.under25 },
                          { label: '25-34', value: demographics.ageDistribution['25to34'] },
                          { label: '35-44', value: demographics.ageDistribution['35to44'] },
                          { label: '45-54', value: demographics.ageDistribution['45to54'] },
                          { label: '55+', value: demographics.ageDistribution['55plus'] },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-3">
                            <div className="w-16 text-sm text-[var(--color-text-secondary)]">{item.label}</div>
                            <div className="flex-1 h-4 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--color-accent-primary)]"
                                style={{ width: `${(item.value / demographics.totalStudents) * 100}%` }}
                              />
                            </div>
                            <div className="w-12 text-sm text-white text-right">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Top States */}
                  {demographics.topStates?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Top States</h4>
                      <div className="space-y-2">
                        {demographics.topStates.slice(0, 5).map((item) => (
                          <div key={item.state} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border-subtle)] last:border-0">
                            <span className="text-[var(--color-text-secondary)]">{item.state}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[var(--color-text-muted)]">{item.count}</span>
                              <span className="text-sm font-medium text-white w-12 text-right">{item.percentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Countries */}
                  {demographics.topCountries?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Top Countries</h4>
                      <div className="space-y-2">
                        {demographics.topCountries.slice(0, 5).map((item) => (
                          <div key={item.country} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border-subtle)] last:border-0">
                            <span className="text-[var(--color-text-secondary)]">{item.country}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[var(--color-text-muted)]">{item.count}</span>
                              <span className="text-sm font-medium text-white w-12 text-right">{item.percentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Race/Ethnicity */}
                  {demographics.raceEthnicity?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Race/Ethnicity</h4>
                      <div className="space-y-2">
                        {demographics.raceEthnicity.slice(0, 5).map((item) => (
                          <div key={item.race} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border-subtle)] last:border-0">
                            <span className="text-[var(--color-text-secondary)] text-sm">{item.race}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[var(--color-text-muted)]">{item.count}</span>
                              <span className="text-sm font-medium text-white w-12 text-right">{item.percentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </GlassCard>
        </>
      )}
      
      {/* Credits Remaining Distribution */}
      {graduation && graduation.progressDistribution?.length > 0 && (
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-5 w-5 text-[var(--color-accent-primary)]" />
            <h3 className="text-lg font-semibold text-white">Credits Remaining Distribution</h3>
          </div>
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="w-full lg:w-1/2 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graduation.progressDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="label"
                        label={renderPieLabel}
                        labelLine={false}
                      >
                        {graduation.progressDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(17, 24, 39, 0.98)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#fff', fontWeight: 600 }}
                        formatter={((value: number | undefined) => [formatNumber(value ?? 0), 'Students']) as never}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 space-y-3">
                  {graduation.progressDistribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-elevated)]">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold text-white">{formatNumber(item.value)}</span>
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">
                          ({((item.value / graduation.totalStudents) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
        </GlassCard>
      )}
      
      {/* Corporate Cohorts - Now with drill-down */}
      <CorporateCohortsSection />
    </div>
  )
}

/**
 * Corporate Cohorts Section with expandable drill-down
 */
function CorporateCohortsSection() {
  const cohorts = useCorporateCohorts()
  const summary = useCorporateCohortSummary()
  const [expandedCohorts, setExpandedCohorts] = useState<Set<string>>(new Set())
  
  const toggleCohort = (cohortName: string) => {
    setExpandedCohorts(prev => {
      const next = new Set(prev)
      if (next.has(cohortName)) {
        next.delete(cohortName)
      } else {
        next.add(cohortName)
      }
      return next
    })
  }
  
  if (cohorts.length === 0) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-[var(--color-accent-primary)]" />
          <h3 className="text-lg font-semibold text-white">Corporate Cohorts</h3>
        </div>
        <p className="text-[var(--color-text-muted)]">No corporate cohort data available.</p>
      </GlassCard>
    )
  }
  
  return (
    <GlassCard>
      {/* Header with Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[var(--color-accent-primary)]" />
          <h3 className="text-lg font-semibold text-white">Corporate Cohorts</h3>
          <span className="text-sm text-[var(--color-text-muted)]">
            ({summary.totalCohorts} companies)
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--color-text-muted)]">
            <strong className="text-white">{formatNumber(summary.totalStudents)}</strong> students
          </span>
          <span className="text-[var(--color-text-muted)]">
            <strong className="text-[var(--color-success)]">{formatNumber(summary.totalNew)}</strong> new
          </span>
          <span className="text-[var(--color-text-muted)]">
            <strong className="text-[var(--color-info)]">{formatNumber(summary.totalContinuing)}</strong> continuing
          </span>
        </div>
      </div>
      
      {/* Cohort List */}
      <div className="space-y-2">
        {cohorts.map((cohort, index) => {
          const isExpanded = expandedCohorts.has(cohort.cohortName)
          
          return (
            <motion.div
              key={cohort.cohortName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden"
            >
              {/* Cohort Header Row - Clickable */}
              <button
                onClick={() => toggleCohort(cohort.cohortName)}
                className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-elevated)] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </motion.div>
                  <Briefcase className="h-4 w-4 text-[var(--color-accent-primary)]" />
                  <span className="font-medium text-white">{cohort.cohortName}</span>
                  
                  {/* Program and Degree count badges */}
                  <div className="flex items-center gap-2 ml-2">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]">
                      {cohort.programs.length} program{cohort.programs.length !== 1 ? 's' : ''}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]">
                      {cohort.degreeTypes.length} degree type{cohort.degreeTypes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm tabular-nums">
                  <div className="text-right">
                    <span className="text-[var(--color-success)]">{cohort.newStudents}</span>
                    <span className="text-[var(--color-text-muted)] ml-1">new</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[var(--color-info)]">{cohort.continuing}</span>
                    <span className="text-[var(--color-text-muted)] ml-1">cont.</span>
                  </div>
                  <div className="text-right min-w-[60px]">
                    <span className="font-semibold text-white">{cohort.total}</span>
                    <span className="text-[var(--color-text-muted)] ml-1">total</span>
                  </div>
                </div>
              </button>
              
              {/* Expanded Detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/30">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                        {/* Programs Breakdown */}
                        <div>
                          <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                            Programs ({cohort.programs.length})
                          </h4>
                          <div className="space-y-2">
                            {cohort.programs.map((program) => (
                              <div key={program.name} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-[var(--color-text-secondary)] truncate max-w-[200px]" title={program.name}>
                                      {program.name}
                                    </span>
                                    <span className="text-sm text-white font-medium tabular-nums">
                                      {program.count}
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${program.percentage}%` }}
                                      transition={{ duration: 0.4, delay: 0.1 }}
                                      className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-glow)]"
                                    />
                                  </div>
                                </div>
                                <span className="text-xs text-[var(--color-text-muted)] w-10 text-right">
                                  {program.percentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Degree Types Breakdown */}
                        <div>
                          <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                            Degree Types ({cohort.degreeTypes.length})
                          </h4>
                          <div className="space-y-2">
                            {cohort.degreeTypes.map((degreeType) => (
                              <div key={degreeType.name} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                      {degreeType.name}
                                    </span>
                                    <span className="text-sm text-white font-medium tabular-nums">
                                      {degreeType.count}
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${degreeType.percentage}%` }}
                                      transition={{ duration: 0.4, delay: 0.1 }}
                                      className="h-full rounded-full bg-gradient-to-r from-[var(--color-info)] to-[#60a5fa]"
                                    />
                                  </div>
                                </div>
                                <span className="text-xs text-[var(--color-text-muted)] w-10 text-right">
                                  {degreeType.percentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </GlassCard>
  )
}

// Time Tab - Enhanced with YoY data
function TrendsTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const rawYoY = useYoY()
  const { historical: filteredHistorical, yoy: filteredYoY, isFiltered } = useFilteredHistorical()
  
  // Use filtered data when filters are active
  const yoy = isFiltered ? filteredYoY : rawYoY
  const historical = isFiltered ? filteredHistorical : data.historical
  
  return (
    <div className="space-y-6">
      <GlassCard className="border-l-4 border-l-[var(--color-accent-primary)]">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">
              Navs Summary
              {isFiltered && <span className="ml-2 text-xs font-normal text-[var(--color-accent-primary)]">(Filtered)</span>}
            </h3>
            <p className="text-[var(--color-text-secondary)]">
              {yoy ? (
                <>
                  Applications <strong className={yoy.vsLastYear.appsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                    {yoy.vsLastYear.appsChange >= 0 ? '+' : ''}{yoy.vsLastYear.appsChange}%
                  </strong> vs LY. 
                  Enrollments <strong className={yoy.vsLastYear.enrollmentsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                    {yoy.vsLastYear.enrollmentsChange >= 0 ? '+' : ''}{yoy.vsLastYear.enrollmentsChange}%
                  </strong>. 
                  Yield change: <strong className="text-white">{yoy.vsLastYear.yieldChange >= 0 ? '+' : ''}{yoy.vsLastYear.yieldChange} points</strong>.
                </>
              ) : (
                <>3-year trend shows steady growth.</>
              )}
            </p>
          </div>
        </div>
      </GlassCard>
      
      {/* YoY Change Cards */}
      {yoy && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard padding="sm">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Apps Change</div>
            <div className={cn(
              'text-2xl font-bold',
              yoy.vsLastYear.appsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
            )}>
              {yoy.vsLastYear.appsChange >= 0 ? '+' : ''}{yoy.vsLastYear.appsChange}%
            </div>
          </GlassCard>
          <GlassCard padding="sm">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Admits Change</div>
            <div className={cn(
              'text-2xl font-bold',
              yoy.vsLastYear.admitsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
            )}>
              {yoy.vsLastYear.admitsChange >= 0 ? '+' : ''}{yoy.vsLastYear.admitsChange}%
            </div>
          </GlassCard>
          <GlassCard padding="sm">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Enrolls Change</div>
            <div className={cn(
              'text-2xl font-bold',
              yoy.vsLastYear.enrollmentsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
            )}>
              {yoy.vsLastYear.enrollmentsChange >= 0 ? '+' : ''}{yoy.vsLastYear.enrollmentsChange}%
            </div>
          </GlassCard>
          <GlassCard padding="sm">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Yield Change</div>
            <div className={cn(
              'text-2xl font-bold',
              yoy.vsLastYear.yieldChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
            )}>
              {yoy.vsLastYear.yieldChange >= 0 ? '+' : ''}{yoy.vsLastYear.yieldChange}pts
            </div>
          </GlassCard>
        </div>
      )}
      
      {/* YoY Comparison Table */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-white mb-4">
          Year-over-Year Comparison
          {isFiltered && <span className="ml-2 text-xs font-normal text-[var(--color-accent-primary)]">(Filtered)</span>}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th className="text-left py-3 text-sm font-medium text-[var(--color-text-muted)]">Metric</th>
                {historical?.years?.map((year: string) => (
                  <th key={year} className="text-right py-3 text-sm font-medium text-[var(--color-text-muted)]">
                    {year}
                  </th>
                ))}
                <th className="text-right py-3 text-sm font-medium text-[var(--color-text-muted)]">YoY Change</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <td className="py-3 text-[var(--color-text-secondary)]">Applications</td>
                {historical?.applications?.map((val: number, i: number) => (
                  <td key={i} className="text-right py-3 text-white tabular-nums">{formatNumber(val)}</td>
                ))}
                <td className={cn(
                  'text-right py-3 font-medium tabular-nums',
                  yoy && yoy.vsLastYear.appsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                )}>
                  {yoy ? `${yoy.vsLastYear.appsChange >= 0 ? '+' : ''}${yoy.vsLastYear.appsChange}%` : '—'}
                </td>
              </tr>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <td className="py-3 text-[var(--color-text-secondary)]">Admits</td>
                {historical?.admits?.map((val: number, i: number) => (
                  <td key={i} className="text-right py-3 text-white tabular-nums">{formatNumber(val)}</td>
                ))}
                <td className={cn(
                  'text-right py-3 font-medium tabular-nums',
                  yoy && yoy.vsLastYear.admitsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                )}>
                  {yoy ? `${yoy.vsLastYear.admitsChange >= 0 ? '+' : ''}${yoy.vsLastYear.admitsChange}%` : '—'}
                </td>
              </tr>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <td className="py-3 text-[var(--color-text-secondary)]">Enrollments</td>
                {historical?.enrollments?.map((val: number, i: number) => (
                  <td key={i} className="text-right py-3 text-white tabular-nums">{formatNumber(val)}</td>
                ))}
                <td className={cn(
                  'text-right py-3 font-medium tabular-nums',
                  yoy && yoy.vsLastYear.enrollmentsChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                )}>
                  {yoy ? `${yoy.vsLastYear.enrollmentsChange >= 0 ? '+' : ''}${yoy.vsLastYear.enrollmentsChange}%` : '—'}
                </td>
              </tr>
              {historical?.yields && (
                <tr>
                  <td className="py-3 text-[var(--color-text-secondary)]">Yield Rate</td>
                  {historical.yields.map((val: number, i: number) => (
                    <td key={i} className="text-right py-3 text-white tabular-nums">{val}%</td>
                  ))}
                  <td className={cn(
                    'text-right py-3 font-medium tabular-nums',
                    yoy && yoy.vsLastYear.yieldChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                  )}>
                    {yoy ? `${yoy.vsLastYear.yieldChange >= 0 ? '+' : ''}${yoy.vsLastYear.yieldChange}pts` : '—'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
