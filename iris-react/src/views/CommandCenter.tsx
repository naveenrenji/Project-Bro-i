import { motion } from 'framer-motion'
import { useData, useAlerts, useInsights } from '@/hooks/useData'
import { useFilteredFunnel, useFilteredNTR, useFilteredMetrics, useIsFiltered, useFilterSummary } from '@/hooks/useFilteredData'
import { KPICard } from '@/components/charts/KPICard'
import { SankeyFlow } from '@/components/charts/SankeyFlow'
import { GaugeChart } from '@/components/charts/GaugeChart'
import { NavsAlert } from '@/components/navs/NavsAlert'
import { NavsInput } from '@/components/navs/NavsInput'
import { GlassCard } from '@/components/shared/GlassCard'
import { KPICardSkeleton, ChartSkeleton } from '@/components/shared/SkeletonLoader'
import { TrendingUp, AlertTriangle, ArrowRight, Filter } from 'lucide-react'
import { Link } from 'react-router-dom'

export function CommandCenter() {
  const { data, isLoading } = useData()
  const alerts = useAlerts()
  const insights = useInsights()
  
  // Filtered data hooks
  const filteredFunnel = useFilteredFunnel()
  const filteredNTR = useFilteredNTR()
  const filteredMetrics = useFilteredMetrics()
  const isFiltered = useIsFiltered()
  const filterSummary = useFilterSummary()
  
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton height={300} />
      </div>
    )
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
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-[var(--color-text-muted)]">
            Real-time enrollment intelligence
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
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          data={isFiltered ? {
            ...data.kpis.ntr,
            value: filteredNTR?.total ?? 0,
            label: 'Filtered NTR',
          } : data.kpis.ntr} 
          delay={0} 
        />
        <KPICard 
          data={isFiltered ? {
            label: 'Total Students',
            value: filteredNTR?.totalStudents ?? 0,
            previousValue: data.enrollmentBreakdown?.total,
            format: 'number' as const,
          } : {
            label: 'Total Students',
            value: data.enrollmentBreakdown?.total ?? 0,
            previousValue: data.historicalCensus?.stats?.['2025']?.total ?? 0,
            format: 'number' as const,
          }} 
          delay={1} 
        />
        <KPICard 
          data={isFiltered ? {
            label: 'New Students',
            value: filteredMetrics.funnel.enrollments,
            previousValue: data.enrollmentBreakdown?.newSlate,
            format: 'number' as const,
          } : {
            label: 'New Students',
            value: data.enrollmentBreakdown?.newSlate ?? 0,
            previousValue: data.historicalCensus?.stats?.['2025']?.new ?? 0,
            format: 'number' as const,
          }} 
          delay={2} 
        />
        <KPICard data={data.kpis.yoyChange} delay={3} />
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sankey Flow - 2 columns */}
        <div className="lg:col-span-2">
          <SankeyFlow 
            data={filteredFunnel} 
            title={isFiltered ? "Filtered Enrollment Flow" : "Live Enrollment Flow"} 
          />
        </div>
        
        {/* NTR Gauge - 1 column */}
        <div>
          <GaugeChart 
            value={filteredNTR?.total ?? data.ntr.total} 
            goal={filteredNTR?.goal ?? data.ntr.goal} 
            title={isFiltered ? "Filtered NTR" : "NTR Progress"} 
          />
        </div>
      </div>
      
      {/* Insights Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-success)]/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
              </div>
              <h3 className="font-semibold text-white">Top Performers</h3>
            </div>
            <div className="space-y-3">
              {insights.topPerformers.map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0"
                >
                  <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                  <span className="text-[var(--color-success)] font-medium">{item.value}</span>
                </div>
              ))}
            </div>
            <Link 
              to="/explore"
              className="mt-4 flex items-center gap-1 text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors"
            >
              Explore Winners <ArrowRight className="h-4 w-4" />
            </Link>
          </GlassCard>
        </motion.div>
        
        {/* Needs Attention */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <GlassCard className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-danger)]/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-[var(--color-danger)]" />
              </div>
              <h3 className="font-semibold text-white">Needs Attention</h3>
            </div>
            <div className="space-y-3">
              {insights.needsAttention.map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0"
                >
                  <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                  <span className="text-[var(--color-danger)] font-medium">{item.value}</span>
                </div>
              ))}
            </div>
            <Link 
              to="/explore"
              className="mt-4 flex items-center gap-1 text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors"
            >
              Investigate <ArrowRight className="h-4 w-4" />
            </Link>
          </GlassCard>
        </motion.div>
      </div>
      
      {/* Ask Navs Input */}
      <NavsInput context="commandCenter" />
    </div>
  )
}
