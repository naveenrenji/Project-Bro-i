/**
 * ForecastByCategory Component
 * 
 * Category-level forecast breakdown table.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/shared/GlassCard'
import { TrendingUp, TrendingDown, Layers, ChevronDown, ChevronUp } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { CategoryForecast } from '@/lib/forecasting'

interface ForecastByCategoryProps {
  data: CategoryForecast[]
  title?: string
}

/**
 * Format currency compact
 */
function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

export function ForecastByCategory({ data, title = 'Forecast by Category' }: ForecastByCategoryProps) {
  const [sortBy, setSortBy] = useState<'apps' | 'enrolls' | 'ntr'>('apps')
  const [sortAsc, setSortAsc] = useState(false)
  
  const handleSort = (field: 'apps' | 'enrolls' | 'ntr') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(field)
      setSortAsc(false)
    }
  }
  
  const sortedData = [...data].sort((a, b) => {
    const aVal = sortBy === 'apps' ? a.apps.mid : sortBy === 'enrolls' ? a.enrolls.mid : a.ntr.mid
    const bVal = sortBy === 'apps' ? b.apps.mid : sortBy === 'enrolls' ? b.enrolls.mid : b.ntr.mid
    return sortAsc ? aVal - bVal : bVal - aVal
  })
  
  const SortIcon = ({ field }: { field: 'apps' | 'enrolls' | 'ntr' }) => {
    if (sortBy !== field) return null
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }
  
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-[var(--color-info)]/20 flex items-center justify-center">
          <Layers className="h-4 w-4 text-[var(--color-info)]" />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 text-xs text-[var(--color-text-muted)] pb-2 border-b border-[var(--color-border-subtle)]">
        <div className="col-span-3">Category</div>
        <div className="col-span-2">Degree</div>
        <div 
          className="col-span-2 text-center cursor-pointer hover:text-white flex items-center justify-center gap-1"
          onClick={() => handleSort('apps')}
        >
          Apps (Mid) <SortIcon field="apps" />
        </div>
        <div 
          className="col-span-2 text-center cursor-pointer hover:text-white flex items-center justify-center gap-1"
          onClick={() => handleSort('enrolls')}
        >
          Enrolls <SortIcon field="enrolls" />
        </div>
        <div 
          className="col-span-2 text-center cursor-pointer hover:text-white flex items-center justify-center gap-1"
          onClick={() => handleSort('ntr')}
        >
          NTR <SortIcon field="ntr" />
        </div>
        <div className="col-span-1 text-right">YoY</div>
      </div>
      
      {/* Table Body */}
      <div className="space-y-1 mt-2 max-h-96 overflow-y-auto">
        {sortedData.map((cat, index) => (
          <motion.div
            key={`${cat.category}-${cat.degreeType}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="grid grid-cols-12 gap-2 py-2 text-sm border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/50 rounded transition-colors"
          >
            {/* Category */}
            <div className="col-span-3 truncate text-[var(--color-text-secondary)]" title={cat.category}>
              {cat.category}
            </div>
            
            {/* Degree Type */}
            <div className="col-span-2 truncate text-[var(--color-text-muted)]" title={cat.degreeType}>
              {cat.degreeType}
            </div>
            
            {/* Apps */}
            <div className="col-span-2 text-center">
              <span className="text-white font-medium">{formatNumber(cat.apps.mid)}</span>
              <span className="text-[var(--color-text-muted)] text-xs ml-1">
                ({formatNumber(cat.apps.current)})
              </span>
            </div>
            
            {/* Enrolls */}
            <div className="col-span-2 text-center">
              <span className="text-white font-medium">{formatNumber(cat.enrolls.mid)}</span>
              <span className="text-[var(--color-text-muted)] text-xs ml-1">
                ({formatNumber(cat.enrolls.current)})
              </span>
            </div>
            
            {/* NTR */}
            <div className="col-span-2 text-center font-medium text-[var(--color-success)]">
              {formatCurrencyCompact(cat.ntr.mid)}
            </div>
            
            {/* YoY */}
            <div className="col-span-1 flex items-center justify-end gap-1">
              {cat.apps.yoyChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-[var(--color-success)]" />
              ) : (
                <TrendingDown className="h-3 w-3 text-[var(--color-danger)]" />
              )}
              <span 
                className="font-medium text-xs"
                style={{ 
                  color: cat.apps.yoyChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                }}
              >
                {cat.apps.yoyChange >= 0 ? '+' : ''}{cat.apps.yoyChange.toFixed(0)}%
              </span>
            </div>
          </motion.div>
        ))}
        
        {/* Empty state */}
        {sortedData.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-muted)]">
            No category data available
          </div>
        )}
      </div>
      
      {/* Totals */}
      {sortedData.length > 0 && (
        <div className="grid grid-cols-12 gap-2 py-3 mt-2 text-sm border-t-2 border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)]/30 rounded">
          <div className="col-span-3 font-semibold text-white pl-2">Total</div>
          <div className="col-span-2"></div>
          <div className="col-span-2 text-center font-bold text-white">
            {formatNumber(sortedData.reduce((sum, c) => sum + c.apps.mid, 0))}
          </div>
          <div className="col-span-2 text-center font-bold text-white">
            {formatNumber(sortedData.reduce((sum, c) => sum + c.enrolls.mid, 0))}
          </div>
          <div className="col-span-2 text-center font-bold text-[var(--color-success)]">
            {formatCurrencyCompact(sortedData.reduce((sum, c) => sum + c.ntr.mid, 0))}
          </div>
          <div className="col-span-1"></div>
        </div>
      )}
    </GlassCard>
  )
}
