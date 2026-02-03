import { motion } from 'framer-motion'
import { DollarSign, GitBranch, PieChart as PieChartIcon, Users, TrendingUp, GraduationCap, ChevronDown, Filter } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { useData, useNTR, useNTRBreakdown, useNTRByStudentType, useGraduation, useDemographics, useYoY, useBySchool, useByDegree } from '@/hooks/useData'
import { useFilteredNTR, useFilteredGraduation, useFilteredCategories, useFilteredMetrics, useFilteredDemographics, useFilteredHistorical, useFilteredPrograms, useAverageCredits, useIsFiltered, useFilterSummary } from '@/hooks/useFilteredData'
import { DEEP_DIVE_TABS } from '@/lib/constants'
import { GlassCard } from '@/components/shared/GlassCard'
import { GaugeChart } from '@/components/charts/GaugeChart'
import { SankeyFlow } from '@/components/charts/SankeyFlow'
import { NTRBarChart, NTRPieChart, NTRSummaryCards, NTRBreakdownTable, AvgCreditsChart } from '@/components/charts/NTRBreakdown'
import { NavsInput } from '@/components/navs/NavsInput'
import { ChartSkeleton } from '@/components/shared/SkeletonLoader'
import { useState } from 'react'

const iconMap = {
  DollarSign,
  GitBranch,
  PieChart: PieChartIcon,
  Users,
  TrendingUp,
}

export function DeepDive() {
  const { activeDeepDiveTab, setActiveDeepDiveTab } = useUIStore()
  const { data, isLoading } = useData()
  const isFiltered = useIsFiltered()
  const filterSummary = useFilterSummary()
  
  const getTabIcon = (iconName: string) => {
    return iconMap[iconName as keyof typeof iconMap] || DollarSign
  }
  
  return (
    <div className="space-y-6">
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
          {activeDeepDiveTab === 'segment' && <SegmentTab data={data} />}
          {activeDeepDiveTab === 'student' && <StudentTab data={data} />}
          {activeDeepDiveTab === 'time' && <TimeTab data={data} />}
        </motion.div>
      )}
      
      {/* Ask Navs */}
      <NavsInput 
        context={activeDeepDiveTab as 'revenue' | 'pipeline' | 'segment' | 'student' | 'time'} 
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

// Pipeline Tab
function PipelineTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
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
              Pipeline shows <strong className="text-white">{formatNumber(data.funnel[0]?.count || 0)}</strong> applications. 
              Admit rate is <strong className="text-white">{data.funnel[1]?.conversionRate || 0}%</strong>. 
              Overall yield at <strong className="text-white">{data.funnel[3]?.conversionRate || 0}%</strong>.
            </p>
          </div>
        </div>
      </GlassCard>
      
      {/* Category Filter */}
      {data.funnelByCategory && Object.keys(data.funnelByCategory).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-all',
              !selectedCategory
                ? 'bg-[var(--color-accent-primary)] text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-white'
            )}
          >
            All Categories
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
      
      <SankeyFlow 
        data={selectedCategory && data.funnelByCategory?.[selectedCategory] 
          ? data.funnelByCategory[selectedCategory] 
          : data.funnel
        } 
        title={selectedCategory ? `${selectedCategory} Pipeline` : "Enrollment Pipeline"} 
      />
      
      {/* Funnel Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.funnel.map((stage, i) => (
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
    </div>
  )
}

// Segment Tab - Enhanced with filters and more programs
function SegmentTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const bySchool = useBySchool()
  const byDegree = useByDegree()
  const { programs: filteredPrograms, programsAll: filteredProgramsAll } = useFilteredPrograms()
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
            <PieChart className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Navs Summary</h3>
            <p className="text-[var(--color-text-secondary)]">
              {data.categories[0]?.category} leads with <strong className="text-white">{formatNumber(data.categories[0]?.enrollments || 0)}</strong> enrollments. 
              {bySchool.length > 0 && <> Top school: <strong className="text-white">{bySchool[0]?.school}</strong> ({bySchool[0]?.enrollments} enrolled).</>}
              <strong className="text-white"> {data.programsAll?.length || data.programs.length}</strong> active programs.
            </p>
          </div>
        </div>
      </GlassCard>
      
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
                const progData = prog as { vs2025?: number; vs2024?: number; yoyEnrollChange?: number }
                const vs2025 = progData.vs2025 ?? prog.yoyChange ?? 0
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
function StudentTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
  const rawGraduation = useGraduation()
  const filteredGraduation = useFilteredGraduation()
  const rawDemographics = useDemographics()
  const filteredDemographics = useFilteredDemographics()
  const filteredMetrics = useFilteredMetrics()
  const isFiltered = useIsFiltered()
  const [showDemographics, setShowDemographics] = useState(false)
  
  // Custom label for pie slices - shows count
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: {
    cx: number, cy: number, midAngle: number, innerRadius: number, outerRadius: number, value: number
  }) => {
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
          <div className="text-3xl font-bold text-white mb-1">{formatNumber(isFiltered ? enrollment.newStudents : data.enrollmentBreakdown.newSlate)}</div>
          <div className="text-sm text-[var(--color-text-muted)]">New {isFiltered ? 'Students' : '(Slate)'}</div>
        </GlassCard>
        <GlassCard className="text-center" padding="sm">
          <div className="text-3xl font-bold text-white mb-1">{formatNumber(isFiltered ? enrollment.currentStudents : data.enrollmentBreakdown.continuing)}</div>
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
                        formatter={(value: number) => [formatNumber(value), 'Students']}
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
      
      {/* Corporate Cohorts */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-white mb-4">Top Corporate Cohorts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th className="text-left py-3 text-[var(--color-text-muted)] font-medium">Cohort</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">New</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Continuing</th>
                <th className="text-right py-3 text-[var(--color-text-muted)] font-medium">Total Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort, i) => (
                <tr key={i} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]">
                  <td className="py-3 text-white">{cohort.company}</td>
                  <td className="py-3 text-right text-[var(--color-success)] tabular-nums">{cohort.newStudents}</td>
                  <td className="py-3 text-right text-[var(--color-text-secondary)] tabular-nums">{cohort.continuingStudents}</td>
                  <td className="py-3 text-right text-white font-medium tabular-nums">{cohort.enrollments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

// Time Tab - Enhanced with YoY data
function TimeTab({ data }: { data: NonNullable<ReturnType<typeof useData>['data']> }) {
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
