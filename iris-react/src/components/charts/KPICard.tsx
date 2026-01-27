import { motion } from 'framer-motion'
import { Minus, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines'
import { cn, formatCurrency, formatNumber, formatPercent, formatDelta } from '@/lib/utils'
import { GlassCard } from '../shared/GlassCard'
import { AnimatedNumber } from '../shared/AnimatedNumber'
import type { KPIData } from '@/store/dataStore'

interface KPICardProps {
  data: KPIData
  delay?: number
  onAskNavs?: () => void
  variant?: 'default' | 'compact' | 'large'
  accentColor?: 'primary' | 'success' | 'warning' | 'danger'
}

const accentColors = {
  primary: {
    gradient: 'from-[var(--color-accent-primary)] to-[var(--color-accent-glow)]',
    glow: 'rgba(164, 16, 52, 0.2)',
    line: '#A41034',
  },
  success: {
    gradient: 'from-[#00a86b] to-[var(--color-success)]',
    glow: 'rgba(0, 208, 132, 0.2)',
    line: '#00d084',
  },
  warning: {
    gradient: 'from-[#e6a600] to-[var(--color-warning)]',
    glow: 'rgba(255, 184, 0, 0.2)',
    line: '#ffb800',
  },
  danger: {
    gradient: 'from-[#cc3847] to-[var(--color-danger)]',
    glow: 'rgba(255, 71, 87, 0.2)',
    line: '#ff4757',
  },
}

export function KPICard({ 
  data, 
  delay = 0, 
  onAskNavs, 
  variant = 'default',
  accentColor = 'primary'
}: KPICardProps) {
  const { label, value, previousValue, format, trend } = data
  const colors = accentColors[accentColor]
  
  // Calculate change
  const change = previousValue
    ? ((value - previousValue) / previousValue) * 100
    : 0
  
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return formatCurrency(v, true)
      case 'percent':
        return formatPercent(v)
      default:
        return formatNumber(v)
    }
  }
  
  const isPositive = change > 0
  const isNegative = change < 0
  const TrendIcon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay: delay * 0.08, 
        duration: 0.5,
        ease: [0.34, 1.56, 0.64, 1]
      }}
    >
      <GlassCard 
        hover 
        className={cn(
          "relative overflow-hidden group",
          variant === 'large' && 'p-8'
        )}
      >
        {/* Animated gradient background */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${colors.glow} 0%, transparent 70%)`,
          }}
        />
        
        {/* Accent line at top */}
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
            colors.gradient
          )}
        />
        
        {/* Content */}
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              {label}
            </span>
            {onAskNavs && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                whileHover={{ scale: 1.05 }}
                className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 text-xs text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)]"
                onClick={onAskNavs}
              >
                <Sparkles className="h-3 w-3" />
                Ask
              </motion.button>
            )}
          </div>
          
          {/* Value with animated number */}
          <div className={cn(
            "font-bold text-white mb-3 tabular-nums",
            variant === 'large' ? 'text-4xl' : 'text-3xl'
          )}>
            <AnimatedNumber value={value} format={formatValue} />
          </div>
          
          {/* Change Indicator */}
          {previousValue !== undefined && (
            <div className="flex items-center gap-3 mb-4">
              <motion.div 
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium',
                  isPositive && 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
                  isNegative && 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]',
                  !isPositive && !isNegative && 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                )}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: delay * 0.08 + 0.3 }}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                <span>{formatDelta(change)}</span>
              </motion.div>
              <span className="text-xs text-[var(--color-text-faint)]">vs LY</span>
            </div>
          )}
          
          {/* Enhanced Sparkline */}
          {trend && trend.length > 0 && (
            <motion.div 
              className="h-12 mt-2"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: delay * 0.08 + 0.4, duration: 0.4 }}
              style={{ transformOrigin: 'bottom' }}
            >
              <Sparklines data={trend} margin={4} height={48}>
                <SparklinesLine 
                  color={colors.line}
                  style={{ 
                    strokeWidth: 2,
                    fill: 'none',
                  }}
                />
                <SparklinesSpots 
                  size={3}
                  style={{ 
                    stroke: colors.line,
                    fill: 'var(--color-bg-base)',
                    strokeWidth: 2,
                  }}
                  spotColors={{ '-1': colors.line }}
                />
              </Sparklines>
            </motion.div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}

// Mini KPI for inline display
interface MiniKPIProps {
  label: string
  value: string | number
  change?: number
  format?: 'number' | 'currency' | 'percent'
}

export function MiniKPI({ label, value, change, format = 'number' }: MiniKPIProps) {
  const formatValue = () => {
    if (typeof value === 'string') return value
    switch (format) {
      case 'currency':
        return formatCurrency(value, true)
      case 'percent':
        return formatPercent(value)
      default:
        return formatNumber(value)
    }
  }
  
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white tabular-nums">{formatValue()}</span>
        {change !== undefined && (
          <span className={cn(
            'text-xs font-medium',
            change > 0 && 'text-[var(--color-success)]',
            change < 0 && 'text-[var(--color-danger)]',
            change === 0 && 'text-[var(--color-text-muted)]'
          )}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  )
}
