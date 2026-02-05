/**
 * ForecastByProgram Component
 * 
 * Program-level forecast breakdown table.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/shared/GlassCard'
import { TrendingUp, TrendingDown, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { ProgramForecast } from '@/lib/forecasting'

interface ForecastByProgramProps {
  data: ProgramForecast[]
  title?: string
}

export function ForecastByProgram({ data, title = 'Forecast by Program' }: ForecastByProgramProps) {
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
        <div className="h-8 w-8 rounded-lg bg-[var(--color-warning)]/20 flex items-center justify-center">
          <BookOpen className="h-4 w-4 text-[var(--color-warning)]" />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          (Top {data.length} programs)
        </span>
      </div>
      
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 text-xs text-[var(--color-text-muted)] pb-2 border-b border-[var(--color-border-subtle)]">
        <div className="col-span-4">Program</div>
        <div className="col-span-2">Category</div>
        <div 
          className="col-span-2 text-center cursor-pointer hover:text-white flex items-center justify-center gap-1"
          onClick={() => handleSort('apps')}
        >
          Apps <SortIcon field="apps" />
        </div>
        <div 
          className="col-span-2 text-center cursor-pointer hover:text-white flex items-center justify-center gap-1"
          onClick={() => handleSort('enrolls')}
        >
          Enrolls <SortIcon field="enrolls" />
        </div>
        <div className="col-span-2 text-right">YoY</div>
      </div>
      
      {/* Table Body */}
      <div className="space-y-1 mt-2 max-h-[500px] overflow-y-auto">
        {sortedData.map((prog, index) => (
          <motion.div
            key={prog.program}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="grid grid-cols-12 gap-2 py-2 text-sm border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/50 rounded transition-colors"
          >
            {/* Program */}
            <div className="col-span-4 truncate text-[var(--color-text-secondary)]" title={prog.program}>
              <span className="text-[var(--color-text-muted)] mr-1">{index + 1}.</span>
              {prog.program}
            </div>
            
            {/* Category */}
            <div className="col-span-2 truncate text-[var(--color-text-muted)]" title={prog.category}>
              {prog.category}
            </div>
            
            {/* Apps */}
            <div className="col-span-2 text-center">
              <span className="text-white font-medium">{formatNumber(prog.apps.mid)}</span>
              <span className="text-[var(--color-text-muted)] text-xs ml-1">
                ({formatNumber(prog.apps.current)})
              </span>
            </div>
            
            {/* Enrolls */}
            <div className="col-span-2 text-center">
              <span className="text-white font-medium">{formatNumber(prog.enrolls.mid)}</span>
              <span className="text-[var(--color-text-muted)] text-xs ml-1">
                ({formatNumber(prog.enrolls.current)})
              </span>
            </div>
            
            {/* YoY */}
            <div className="col-span-2 flex items-center justify-end gap-1">
              {prog.apps.yoyChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-[var(--color-success)]" />
              ) : (
                <TrendingDown className="h-3 w-3 text-[var(--color-danger)]" />
              )}
              <span 
                className="font-medium"
                style={{ 
                  color: prog.apps.yoyChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                }}
              >
                {prog.apps.yoyChange >= 0 ? '+' : ''}{prog.apps.yoyChange.toFixed(0)}%
              </span>
            </div>
          </motion.div>
        ))}
        
        {/* Empty state */}
        {sortedData.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-muted)]">
            No program data available
          </div>
        )}
      </div>
    </GlassCard>
  )
}
