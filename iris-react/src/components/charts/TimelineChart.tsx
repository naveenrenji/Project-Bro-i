import React, { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  LabelList,
} from 'recharts'
import { Calendar, TrendingUp, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { GlassCard } from '../shared/GlassCard'
import { cn } from '../../lib/utils'

interface TimelineData {
  applications: {
    byDay: { date: string; count: number }[]
    byWeek: { date: string; count: number }[]
    byMonth: { date: string; count: number }[]
    byCategoryMonth?: Record<string, any>[]
  }
  enrollments: {
    byDay: { date: string; count: number }[]
    byWeek: { date: string; count: number }[]
    byMonth: { date: string; count: number }[]
    byCategoryMonth?: Record<string, any>[]
  }
  dateRange: {
    minDate: string | null
    maxDate: string | null
  }
}

interface TimelineChartProps {
  data: TimelineData
  selectedCategory?: string | null
  selectedDegree?: string | null
}

type ViewMode = 'day' | 'week' | 'month'
type DataType = 'applications' | 'enrollments' | 'both'

const COLORS = {
  applications: '#3b82f6',
  enrollments: '#22c55e',
  applicationsGradient: 'url(#applicationsGradient)',
  enrollmentsGradient: 'url(#enrollmentsGradient)',
}

const formatDate = (dateStr: string, mode: ViewMode): string => {
  if (!dateStr) return ''
  
  if (mode === 'month') {
    // Format: 2024-01 -> Jan 2024
    const [year, month] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  
  // Format: 2024-01-15 -> Jan 15
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

export function TimelineChart({ data, selectedCategory, selectedDegree }: TimelineChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [dataType, setDataType] = useState<DataType>('both')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    // Default to last 12 months
    const now = new Date()
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1)
    return {
      start: yearAgo.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    }
  })

  // Get the appropriate data based on view mode
  const getDataForMode = (type: 'applications' | 'enrollments') => {
    switch (viewMode) {
      case 'day':
        return data[type]?.byDay || []
      case 'week':
        return data[type]?.byWeek || []
      case 'month':
      default:
        return data[type]?.byMonth || []
    }
  }

  // Filter and combine data
  const chartData = useMemo(() => {
    const appsData = getDataForMode('applications')
    const enrollData = getDataForMode('enrollments')
    
    // Create a combined dataset
    const dateMap = new Map<string, { date: string; applications: number; enrollments: number }>()
    
    appsData.forEach(item => {
      const key = item.date
      if (!dateMap.has(key)) {
        dateMap.set(key, { date: key, applications: 0, enrollments: 0 })
      }
      dateMap.get(key)!.applications = item.count
    })
    
    enrollData.forEach(item => {
      const key = item.date
      if (!dateMap.has(key)) {
        dateMap.set(key, { date: key, applications: 0, enrollments: 0 })
      }
      dateMap.get(key)!.enrollments = item.count
    })
    
    // Convert to array, filter by date range, and sort
    let combined = Array.from(dateMap.values())
      .filter(item => {
        const itemDate = item.date
        // For month view, compare YYYY-MM format
        if (viewMode === 'month') {
          const startMonth = dateRange.start.slice(0, 7)
          const endMonth = dateRange.end.slice(0, 7)
          return itemDate >= startMonth && itemDate <= endMonth
        }
        return itemDate >= dateRange.start && itemDate <= dateRange.end
      })
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return combined
  }, [data, viewMode, dateRange])

  // Calculate totals for the selected period
  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, item) => ({
        applications: acc.applications + item.applications,
        enrollments: acc.enrollments + item.enrollments,
      }),
      { applications: 0, enrollments: 0 }
    )
  }, [chartData])

  // Date navigation helpers
  const shiftDateRange = (direction: 'prev' | 'next') => {
    const months = viewMode === 'month' ? 6 : viewMode === 'week' ? 2 : 1
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    
    if (direction === 'prev') {
      startDate.setMonth(startDate.getMonth() - months)
      endDate.setMonth(endDate.getMonth() - months)
    } else {
      startDate.setMonth(startDate.getMonth() + months)
      endDate.setMonth(endDate.getMonth() + months)
    }
    
    setDateRange({
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
    })
  }

  const setPresetRange = (preset: 'ytd' | '12m' | '6m' | '3m' | 'all') => {
    const now = new Date()
    let start: Date
    
    switch (preset) {
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1)
        break
      case '12m':
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1)
        break
      case '6m':
        start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        break
      case '3m':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case 'all':
        start = data.dateRange.minDate ? new Date(data.dateRange.minDate) : new Date(2024, 0, 1)
        break
      default:
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1)
    }
    
    setDateRange({
      start: start.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    })
  }

  if (!data || (!data.applications?.byMonth?.length && !data.enrollments?.byMonth?.length)) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-[var(--color-accent-primary)]" />
          <h3 className="text-lg font-semibold text-white">Timeline</h3>
        </div>
        <div className="text-center text-[var(--color-text-muted)] py-8">
          No timeline data available
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[var(--color-accent-primary)]" />
          <h3 className="text-lg font-semibold text-white">Applications & Enrollments Over Time</h3>
        </div>
        
        {/* Totals for selected period */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-[var(--color-text-secondary)]">Apps:</span>
            <span className="text-white font-semibold">{formatNumber(totals.applications)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-[var(--color-text-secondary)]">Enrolled:</span>
            <span className="text-white font-semibold">{formatNumber(totals.enrollments)}</span>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-[var(--color-bg-surface)] rounded-lg p-1">
          {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm capitalize transition-all',
                viewMode === mode
                  ? 'bg-[var(--color-accent-primary)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:text-white'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
        
        {/* Data Type Toggle */}
        <div className="flex items-center gap-1 bg-[var(--color-bg-surface)] rounded-lg p-1">
          {(['both', 'applications', 'enrollments'] as DataType[]).map(type => (
            <button
              key={type}
              onClick={() => setDataType(type)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm capitalize transition-all',
                dataType === type
                  ? type === 'applications' ? 'bg-blue-500 text-white'
                  : type === 'enrollments' ? 'bg-green-500 text-white'
                  : 'bg-[var(--color-accent-primary)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:text-white'
              )}
            >
              {type === 'both' ? 'All' : type}
            </button>
          ))}
        </div>
        
        {/* Date Range Presets */}
        <div className="flex items-center gap-1 bg-[var(--color-bg-surface)] rounded-lg p-1">
          {[
            { key: '3m', label: '3M' },
            { key: '6m', label: '6M' },
            { key: '12m', label: '12M' },
            { key: 'ytd', label: 'YTD' },
            { key: 'all', label: 'All' },
          ].map(preset => (
            <button
              key={preset.key}
              onClick={() => setPresetRange(preset.key as any)}
              className="px-2 py-1.5 rounded-md text-sm text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-secondary)] transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        {/* Date Navigation */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => shiftDateRange('prev')}
            className="p-2 rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-white transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            {' - '}
            {new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
          <button
            onClick={() => shiftDateRange('next')}
            className="p-2 rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-white transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="applicationsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="enrollmentsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              tickFormatter={(val) => formatDate(val, viewMode)}
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
              tickFormatter={(val) => formatNumber(val)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
              labelStyle={{ color: 'white', fontWeight: 'bold', marginBottom: '8px' }}
              itemStyle={{ color: 'white' }}
              labelFormatter={(val) => formatDate(val, viewMode)}
              formatter={(value: number, name: string) => [formatNumber(value), name === 'applications' ? 'Applications' : 'Enrollments']}
            />
            <Legend
              wrapperStyle={{ paddingTop: '16px' }}
              formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.8)' }}>{value === 'applications' ? 'Applications' : 'Enrollments'}</span>}
            />
            {(dataType === 'both' || dataType === 'applications') && (
              <Area
                type="monotone"
                dataKey="applications"
                stroke={COLORS.applications}
                strokeWidth={2}
                fill={COLORS.applicationsGradient}
                dot={viewMode === 'month' ? { r: 4, fill: COLORS.applications } : false}
                activeDot={{ r: 6, fill: COLORS.applications }}
              />
            )}
            {(dataType === 'both' || dataType === 'enrollments') && (
              <Area
                type="monotone"
                dataKey="enrollments"
                stroke={COLORS.enrollments}
                strokeWidth={2}
                fill={COLORS.enrollmentsGradient}
                dot={viewMode === 'month' ? { r: 4, fill: COLORS.enrollments } : false}
                activeDot={{ r: 6, fill: COLORS.enrollments }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Date range info */}
      <div className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
        {data.dateRange.minDate && data.dateRange.maxDate && (
          <span>
            Data available from {new Date(data.dateRange.minDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            {' to '}
            {new Date(data.dateRange.maxDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </GlassCard>
  )
}

export default TimelineChart
