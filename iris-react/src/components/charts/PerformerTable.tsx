/**
 * PerformerTable Component
 * 
 * Displays Top 5 / Bottom 5 programs with Total, New, Continuing, YoY metrics.
 */

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/shared/GlassCard'
import { TrendingUp, TrendingDown, ArrowRight, Trophy, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ClassifiedProgram } from '@/lib/program-classification'
import { formatNumber } from '@/lib/utils'

interface PerformerTableProps {
  programs: ClassifiedProgram[]
  type: 'top' | 'bottom'
  limit?: number
}

export function PerformerTable({ programs, type, limit = 5 }: PerformerTableProps) {
  const displayPrograms = programs.slice(0, limit)
  
  const isTop = type === 'top'
  const title = isTop ? 'Top 5 Performers' : 'Bottom 5 - Needs Attention'
  const Icon = isTop ? Trophy : AlertTriangle
  const iconColor = isTop ? 'var(--color-success)' : 'var(--color-danger)'
  const linkText = isTop ? 'See all programs' : 'Investigate'
  
  return (
    <motion.div
      initial={{ opacity: 0, x: isTop ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: isTop ? 0.3 : 0.4 }}
    >
      <GlassCard className="h-full">
        <div className="flex items-center gap-2 mb-4">
          <div 
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            <Icon className="h-4 w-4" style={{ color: iconColor }} />
          </div>
          <h3 className="font-semibold text-white">{title}</h3>
        </div>
        
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 text-xs text-[var(--color-text-muted)] pb-2 border-b border-[var(--color-border-subtle)]">
          <div className="col-span-4">Program</div>
          <div className="col-span-2 text-center">Total</div>
          <div className="col-span-2 text-center">New</div>
          <div className="col-span-2 text-center">Cont.</div>
          <div className="col-span-2 text-right">YoY</div>
        </div>
        
        {/* Table Body */}
        <div className="space-y-1 mt-2">
          {displayPrograms.map((program, index) => (
            <motion.div
              key={program.program}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="grid grid-cols-12 gap-2 py-2 text-sm border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/50 rounded transition-colors"
            >
              {/* Program Name */}
              <div className="col-span-4 truncate text-[var(--color-text-secondary)]" title={program.program}>
                <span className="text-[var(--color-text-muted)] mr-1">{index + 1}.</span>
                {program.program}
              </div>
              
              {/* Total */}
              <div className="col-span-2 text-center font-medium text-white">
                {formatNumber(program.total)}
              </div>
              
              {/* New */}
              <div className="col-span-2 text-center text-[var(--color-success)]">
                {formatNumber(program.newStudents)}
              </div>
              
              {/* Continuing */}
              <div className="col-span-2 text-center text-[var(--color-info)]">
                {formatNumber(program.continuing)}
              </div>
              
              {/* YoY */}
              <div className="col-span-2 flex items-center justify-end gap-1">
                {program.yoyChange >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-[var(--color-success)]" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-[var(--color-danger)]" />
                )}
                <span 
                  className="font-medium"
                  style={{ 
                    color: program.yoyChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                  }}
                >
                  {program.yoyChange >= 0 ? '+' : ''}{program.yoyChange.toFixed(0)}%
                </span>
              </div>
            </motion.div>
          ))}
          
          {/* Empty state */}
          {displayPrograms.length === 0 && (
            <div className="py-4 text-center text-[var(--color-text-muted)] text-sm">
              No programs in this category
            </div>
          )}
        </div>
        
        {/* Deep dive link */}
        <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
          <Link 
            to="/explore"
            className="text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors flex items-center gap-1"
          >
            {linkText} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </GlassCard>
    </motion.div>
  )
}

/**
 * Dual panel layout for Top and Bottom performers side by side
 */
interface PerformerPanelsProps {
  topPerformers: ClassifiedProgram[]
  needsAttention: ClassifiedProgram[]
  limit?: number
}

export function PerformerPanels({ topPerformers, needsAttention, limit = 5 }: PerformerPanelsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PerformerTable programs={topPerformers} type="top" limit={limit} />
      <PerformerTable programs={needsAttention} type="bottom" limit={limit} />
    </div>
  )
}
