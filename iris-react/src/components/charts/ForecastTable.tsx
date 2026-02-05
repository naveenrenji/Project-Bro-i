/**
 * ForecastTable Component
 * 
 * Summary table showing forecast with Low/Mid/High ranges for Apps, Admits, Enrolls, NTR.
 */

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/shared/GlassCard'
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { ForecastMetrics, ForecastParams } from '@/lib/forecasting'

interface ForecastTableProps {
  metrics: ForecastMetrics
  params?: ForecastParams
  title?: string
}

/**
 * Format currency with full digits
 */
function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function ForecastTable({ metrics, params, title = 'Forecast Summary' }: ForecastTableProps) {
  const rows = [
    { label: 'Applications', data: metrics.apps, format: 'number' as const },
    { label: 'Admits', data: metrics.admits, format: 'number' as const },
    { label: 'Enrollments', data: metrics.enrolls, format: 'number' as const },
    { label: 'NTR', data: metrics.ntr, format: 'currency' as const },
  ]
  
  const formatValue = (value: number, format: 'number' | 'currency') => {
    return format === 'currency' ? formatCurrencyFull(value) : formatNumber(value)
  }
  
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-[var(--color-accent-primary)]" />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      
      {/* Model Parameters */}
      {params && (
        <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)] mb-4 p-3 bg-[var(--color-bg-tertiary)]/50 rounded-lg">
          <span>
            <strong>Run Rate:</strong> {params.weeklyRunRate} apps/week
          </span>
          <span>
            <strong>Weeks Left:</strong> {params.weeksRemaining}
          </span>
          <span>
            <strong>Multiplier:</strong> {params.growthMultiplierMid}x
          </span>
          <span>
            <strong>Yield:</strong> {(params.avgHistoricalYield * 100).toFixed(1)}%
          </span>
          <span>
            <strong>MAPE:</strong> {params.backtestMAPE}%
          </span>
        </div>
      )}
      
      {/* Table Header */}
      <div className="grid grid-cols-7 gap-2 text-xs text-[var(--color-text-muted)] pb-2 border-b border-[var(--color-border-subtle)]">
        <div className="col-span-1">Metric</div>
        <div className="text-center">2025 Final</div>
        <div className="text-center">Current</div>
        <div className="text-center text-[var(--color-warning)]">Low</div>
        <div className="text-center text-[var(--color-success)]">Mid</div>
        <div className="text-center text-[var(--color-info)]">High</div>
        <div className="text-right">YoY</div>
      </div>
      
      {/* Table Body */}
      <div className="space-y-1 mt-2">
        {rows.map((row, index) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="grid grid-cols-7 gap-2 py-3 text-sm border-b border-[var(--color-border-subtle)] last:border-0"
          >
            {/* Label */}
            <div className="col-span-1 font-medium text-white">
              {row.label}
            </div>
            
            {/* Previous Year */}
            <div className="text-center text-[var(--color-text-muted)]">
              {formatValue(row.data.previousYear, row.format)}
            </div>
            
            {/* Current */}
            <div className="text-center font-medium text-[var(--color-accent-primary)]">
              {formatValue(row.data.current, row.format)}
            </div>
            
            {/* Low */}
            <div className="text-center text-[var(--color-warning)]">
              {formatValue(row.data.low, row.format)}
            </div>
            
            {/* Mid */}
            <div className="text-center font-semibold text-[var(--color-success)]">
              {formatValue(row.data.mid, row.format)}
            </div>
            
            {/* High */}
            <div className="text-center text-[var(--color-info)]">
              {formatValue(row.data.high, row.format)}
            </div>
            
            {/* YoY */}
            <div className="flex items-center justify-end gap-1">
              {row.data.yoyChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-[var(--color-success)]" />
              ) : (
                <TrendingDown className="h-3 w-3 text-[var(--color-danger)]" />
              )}
              <span 
                className="font-medium"
                style={{ 
                  color: row.data.yoyChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                }}
              >
                {row.data.yoyChange >= 0 ? '+' : ''}{row.data.yoyChange.toFixed(1)}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}
