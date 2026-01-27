import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { GlassCard } from '../shared/GlassCard'
import type { FunnelStage } from '@/store/dataStore'

interface SankeyFlowProps {
  data: FunnelStage[]
  title?: string
  onAskNavs?: () => void
}

export function SankeyFlow({ data, title = 'Enrollment Flow', onAskNavs }: SankeyFlowProps) {
  if (!data || data.length === 0) return null
  
  const maxCount = Math.max(...data.map(d => d.count))
  
  return (
    <GlassCard className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {onAskNavs && (
          <button
            onClick={onAskNavs}
            className="flex items-center gap-1.5 text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Ask Navs
          </button>
        )}
      </div>
      
      {/* Flow Visualization */}
      <div className="relative">
        {/* Stages */}
        <div className="flex items-center justify-between gap-4">
          {data.map((stage, index) => {
            const widthPercent = (stage.count / maxCount) * 100
            const isLast = index === data.length - 1
            
            return (
              <div key={stage.stage} className="flex-1 relative">
                {/* Stage Box */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className="relative"
                >
                  <div
                    className={cn(
                      'rounded-xl border transition-all duration-300',
                      'bg-gradient-to-br from-[var(--color-bg-elevated)] to-[var(--color-bg-surface)]',
                      'border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]',
                      'p-4 text-center'
                    )}
                  >
                    {/* Count */}
                    <div className="text-2xl font-bold text-white mb-1 tabular-nums">
                      {formatNumber(stage.count)}
                    </div>
                    
                    {/* Label */}
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {stage.stage}
                    </div>
                    
                    {/* Bar Indicator */}
                    <div className="mt-3 h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPercent}%` }}
                        transition={{ delay: index * 0.1 + 0.3, duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-glow)]"
                      />
                    </div>
                  </div>
                </motion.div>
                
                {/* Connector Arrow */}
                {!isLast && (
                  <div className="absolute top-1/2 -right-4 transform -translate-y-1/2 z-10 w-8">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 + 0.2, duration: 0.3 }}
                      className="flex items-center justify-center"
                    >
                      <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                        <path
                          d="M0 12H28M28 12L20 4M28 12L20 20"
                          stroke="var(--color-border-default)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.div>
                    {/* Conversion Rate Label */}
                    {data[index + 1]?.conversionRate && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.4, duration: 0.3 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-xs text-[var(--color-text-muted)]"
                      >
                        {formatPercent(data[index + 1].conversionRate ?? 0)}
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Summary Stats */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border-subtle)] grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
              Admit Rate
            </div>
            <div className="text-lg font-semibold text-white">
              {data[1] && data[0] ? formatPercent((data[1].count / data[0].count) * 100, 1) : '-'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
              Accept Rate
            </div>
            <div className="text-lg font-semibold text-white">
              {data[2] && data[1] ? formatPercent((data[2].count / data[1].count) * 100, 1) : '-'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
              Yield
            </div>
            <div className="text-lg font-semibold text-[var(--color-accent-primary)]">
              {data[3] && data[2] ? formatPercent((data[3].count / data[2].count) * 100, 1) : '-'}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
