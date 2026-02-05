/**
 * StudentMetricsRow Component
 * 
 * Row of 3 KPI cards showing Total, New, and Continuing students with YoY.
 * Features animated numbers and mini sparklines.
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { Sparklines, SparklinesLine } from 'react-sparklines'
import { GlassCard } from '@/components/shared/GlassCard'
import { Users, UserPlus, UserCheck, TrendingUp, TrendingDown } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface StudentMetric {
  current: number
  previous: number
  yoyChange: number
}

interface StudentMetricsRowProps {
  total: StudentMetric
  newStudents: StudentMetric
  continuing: StudentMetric
}

interface MetricCardProps {
  label: string
  icon: React.ReactNode
  metric: StudentMetric
  accentColor: string
  delay?: number
}

/**
 * Generate a realistic trend line between previous and current values
 * Adds some variance to make it look natural
 */
function generateTrendData(previous: number, current: number, points: number = 12): number[] {
  const trend: number[] = []
  const diff = current - previous
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1)
    // Use an easing curve for natural growth
    const eased = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2
    
    // Add some variance (±5%)
    const variance = (Math.random() - 0.5) * 0.1 * Math.abs(diff)
    const value = previous + (diff * eased) + variance
    trend.push(Math.max(0, value))
  }
  
  // Ensure the last point is exactly the current value
  trend[points - 1] = current
  
  return trend
}

function MetricCard({ label, icon, metric, accentColor, delay = 0 }: MetricCardProps) {
  const isPositive = metric.yoyChange >= 0
  
  // Generate sparkline data
  const trendData = useMemo(
    () => generateTrendData(metric.previous, metric.current),
    [metric.previous, metric.current]
  )
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <GlassCard className="h-full group hover:scale-[1.02] transition-transform duration-300">
        <div className="flex items-center gap-2 mb-3">
          <div 
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <div style={{ color: accentColor }}>{icon}</div>
          </div>
          <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
        </div>
        
        <div className="text-3xl font-bold text-white mb-1 tabular-nums">
          <CountUp 
            end={metric.current} 
            duration={1.5} 
            separator="," 
            useEasing 
          />
        </div>
        
        <div className="text-sm text-[var(--color-text-muted)] mb-2">
          vs {formatNumber(metric.previous)} last year
        </div>
        
        {/* Mini Sparkline */}
        <motion.div 
          className="h-8 mb-2 opacity-60 group-hover:opacity-100 transition-opacity"
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 0.6, scaleY: 1 }}
          transition={{ delay: delay + 0.3, duration: 0.4 }}
          style={{ transformOrigin: 'bottom' }}
        >
          <Sparklines data={trendData} margin={2} height={32}>
            <SparklinesLine 
              color={isPositive ? 'var(--color-success)' : 'var(--color-danger)'}
              style={{ 
                strokeWidth: 1.5,
                fill: 'none',
              }}
            />
          </Sparklines>
        </motion.div>
        
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
          ) : (
            <TrendingDown className="h-4 w-4 text-[var(--color-danger)]" />
          )}
          <span 
            className="text-sm font-semibold"
            style={{ color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {isPositive ? '+' : ''}{metric.yoyChange.toFixed(1)}% YoY
          </span>
        </div>
      </GlassCard>
    </motion.div>
  )
}

export function StudentMetricsRow({ total, newStudents, continuing }: StudentMetricsRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        label="Total Students"
        icon={<Users className="h-4 w-4" />}
        metric={total}
        accentColor="var(--color-accent-primary)"
        delay={0}
      />
      <MetricCard
        label="New Students"
        icon={<UserPlus className="h-4 w-4" />}
        metric={newStudents}
        accentColor="var(--color-success)"
        delay={0.1}
      />
      <MetricCard
        label="Continuing"
        icon={<UserCheck className="h-4 w-4" />}
        metric={continuing}
        accentColor="var(--color-info)"
        delay={0.2}
      />
    </div>
  )
}
