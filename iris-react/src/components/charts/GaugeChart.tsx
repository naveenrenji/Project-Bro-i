import { motion } from 'framer-motion'
import { Sparkles, Target, TrendingUp } from 'lucide-react'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { GlassCard } from '../shared/GlassCard'

interface GaugeChartProps {
  value: number
  goal: number
  title?: string
  onAskNavs?: () => void
  variant?: 'default' | 'compact'
}

export function GaugeChart({ 
  value, 
  goal, 
  title = 'NTR Progress', 
  onAskNavs,
  variant = 'default'
}: GaugeChartProps) {
  const percentage = Math.min((value / goal) * 100, 100)
  const gap = goal - value
  
  // Determine color and status based on progress
  const getStatus = () => {
    if (percentage >= 100) return { color: '#00d084', label: 'Achieved', glow: 'rgba(0, 208, 132, 0.4)' }
    if (percentage >= 90) return { color: '#00d084', label: 'On Track', glow: 'rgba(0, 208, 132, 0.3)' }
    if (percentage >= 70) return { color: '#ffb800', label: 'At Risk', glow: 'rgba(255, 184, 0, 0.3)' }
    return { color: '#ff4757', label: 'Behind', glow: 'rgba(255, 71, 87, 0.3)' }
  }
  
  const status = getStatus()
  
  // Full circle gauge
  const size = variant === 'compact' ? 140 : 180
  const strokeWidth = variant === 'compact' ? 10 : 14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  // Tick marks
  const ticks = [0, 25, 50, 75, 100]
  
  return (
    <GlassCard className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div 
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: `${status.color}20` }}
          >
            <Target className="h-4 w-4" style={{ color: status.color }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <div className="flex items-center gap-2">
              <span 
                className="status-dot"
                style={{ background: status.color, boxShadow: `0 0 8px ${status.color}` }}
              />
              <span className="text-xs text-[var(--color-text-muted)]">{status.label}</span>
            </div>
          </div>
        </div>
        {onAskNavs && (
          <button
            onClick={onAskNavs}
            className="flex items-center gap-1.5 text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Ask
          </button>
        )}
      </div>
      
      {/* Gauge */}
      <div className="flex flex-col items-center">
        <div className="relative">
          {/* Glow effect behind gauge */}
          <div 
            className="absolute inset-0 rounded-full blur-xl opacity-30"
            style={{ background: status.glow }}
          />
          
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Background gradient */}
            <defs>
              <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={status.color} />
                <stop offset="100%" stopColor={status.color} stopOpacity="0.6" />
              </linearGradient>
              <filter id="gauge-glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-bg-elevated)"
              strokeWidth={strokeWidth}
            />
            
            {/* Progress arc */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#gauge-gradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
              filter="url(#gauge-glow)"
            />
            
            {/* Tick marks */}
            {variant !== 'compact' && ticks.map((tick) => {
              const angle = (tick / 100) * 360 - 90
              const x1 = size / 2 + Math.cos((angle * Math.PI) / 180) * (radius + strokeWidth / 2 + 4)
              const y1 = size / 2 + Math.sin((angle * Math.PI) / 180) * (radius + strokeWidth / 2 + 4)
              const x2 = size / 2 + Math.cos((angle * Math.PI) / 180) * (radius + strokeWidth / 2 + 8)
              const y2 = size / 2 + Math.sin((angle * Math.PI) / 180) * (radius + strokeWidth / 2 + 8)
              
              return (
                <line
                  key={tick}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--color-border-subtle)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-center"
            >
              <div 
                className={cn(
                  "font-bold text-white tabular-nums",
                  variant === 'compact' ? 'text-2xl' : 'text-4xl'
                )}
              >
                {formatPercent(percentage, 0)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mt-1">
                of goal
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Stats row */}
        <div className="w-full mt-6 grid grid-cols-2 gap-3">
          <motion.div 
            className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Current
            </div>
            <div className="text-xl font-bold text-white tabular-nums">
              {formatCurrency(value, true)}
            </div>
          </motion.div>
          <motion.div 
            className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Goal
            </div>
            <div className="text-xl font-bold text-white tabular-nums">
              {formatCurrency(goal, true)}
            </div>
          </motion.div>
        </div>
        
        {/* Gap indicator with progress bar */}
        <motion.div 
          className="mt-4 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className={cn(
            'p-4 rounded-xl border',
            gap > 0 
              ? 'bg-[var(--color-danger-muted)] border-[var(--color-danger)]/20' 
              : 'bg-[var(--color-success-muted)] border-[var(--color-success)]/20'
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className={cn(
                  "h-4 w-4",
                  gap > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'
                )} />
                <span className={cn(
                  'text-sm font-medium',
                  gap > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'
                )}>
                  {gap > 0 ? 'Gap to Goal' : 'Goal Achieved!'}
                </span>
              </div>
              {gap > 0 && (
                <span className="text-sm font-bold text-[var(--color-danger)] tabular-nums">
                  {formatCurrency(gap, true)}
                </span>
              )}
            </div>
            
            {/* Mini progress bar */}
            <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  gap > 0 
                    ? 'bg-gradient-to-r from-[var(--color-danger)] to-[#ff6b7a]'
                    : 'bg-gradient-to-r from-[var(--color-success)] to-[#00e090]'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, delay: 0.9 }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </GlassCard>
  )
}
