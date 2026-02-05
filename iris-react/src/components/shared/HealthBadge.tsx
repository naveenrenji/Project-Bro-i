/**
 * HealthBadge Component
 * 
 * Reusable color-coded status badge for health indicators.
 */

import { motion } from 'framer-motion'
import { Check, AlertTriangle, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export type HealthStatus = 'good' | 'warning' | 'danger' | 'neutral'

interface HealthBadgeProps {
  status: HealthStatus
  label: string
  value?: string | number
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig: Record<HealthStatus, {
  color: string
  bgColor: string
  icon: React.ReactNode
}> = {
  good: {
    color: 'var(--color-success)',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    icon: <Check className="h-3.5 w-3.5" />,
  },
  warning: {
    color: 'var(--color-warning)',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  danger: {
    color: 'var(--color-danger)',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    icon: <X className="h-3.5 w-3.5" />,
  },
  neutral: {
    color: 'var(--color-text-secondary)',
    bgColor: 'rgba(148, 163, 184, 0.15)',
    icon: <Minus className="h-3.5 w-3.5" />,
  },
}

const sizeConfig = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
}

export function HealthBadge({
  status,
  label,
  value,
  showIcon = true,
  size = 'md',
  className = '',
}: HealthBadgeProps) {
  const config = statusConfig[status]
  const sizeClass = sizeConfig[size]
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 rounded-full font-medium ${sizeClass} ${className}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
    >
      {showIcon && config.icon}
      <span>{label}</span>
      {value !== undefined && (
        <span className="font-semibold">{value}</span>
      )}
    </motion.div>
  )
}

/**
 * Helper to determine health status from YoY change
 */
export function getYoYStatus(change: number, inverseGood = false): HealthStatus {
  const isPositive = inverseGood ? change < 0 : change > 0
  const isNegative = inverseGood ? change > 0 : change < 0
  
  if (Math.abs(change) < 1) return 'neutral'
  if (isPositive) return 'good'
  if (isNegative && Math.abs(change) > 10) return 'danger'
  if (isNegative) return 'warning'
  return 'neutral'
}

/**
 * Helper to determine health status from percentage against target
 */
export function getPercentStatus(
  percent: number,
  goodThreshold = 90,
  warningThreshold = 70
): HealthStatus {
  if (percent >= goodThreshold) return 'good'
  if (percent >= warningThreshold) return 'warning'
  return 'danger'
}

/**
 * YoY Badge - specialized for year-over-year changes
 */
interface YoYBadgeProps {
  label: string
  change: number
  size?: 'sm' | 'md' | 'lg'
  inverseGood?: boolean
}

export function YoYBadge({ label, change, size = 'md', inverseGood = false }: YoYBadgeProps) {
  const status = getYoYStatus(change, inverseGood)
  const Icon = change >= 0 ? TrendingUp : TrendingDown
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 ${sizeConfig[size]}`}
    >
      <div
        className="flex items-center justify-center h-6 w-6 rounded-full"
        style={{ backgroundColor: statusConfig[status].bgColor }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: statusConfig[status].color }} />
      </div>
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span 
        className="font-semibold"
        style={{ color: statusConfig[status].color }}
      >
        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
    </motion.div>
  )
}
