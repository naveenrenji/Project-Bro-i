import { cn } from '@/lib/utils'
import { Check, AlertTriangle, X, Info, Clock, TrendingUp, TrendingDown } from 'lucide-react'

type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending'

interface StatusBadgeProps {
  status: StatusType
  label: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
}

const statusConfig: Record<StatusType, {
  icon: typeof Check
  bg: string
  text: string
  border: string
  dot: string
}> = {
  success: {
    icon: Check,
    bg: 'bg-[var(--color-success-muted)]',
    text: 'text-[var(--color-success)]',
    border: 'border-[var(--color-success)]/20',
    dot: 'bg-[var(--color-success)]',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-[var(--color-warning-muted)]',
    text: 'text-[var(--color-warning)]',
    border: 'border-[var(--color-warning)]/20',
    dot: 'bg-[var(--color-warning)]',
  },
  danger: {
    icon: X,
    bg: 'bg-[var(--color-danger-muted)]',
    text: 'text-[var(--color-danger)]',
    border: 'border-[var(--color-danger)]/20',
    dot: 'bg-[var(--color-danger)]',
  },
  info: {
    icon: Info,
    bg: 'bg-[var(--color-info-muted)]',
    text: 'text-[var(--color-info)]',
    border: 'border-[var(--color-info)]/20',
    dot: 'bg-[var(--color-info)]',
  },
  neutral: {
    icon: Info,
    bg: 'bg-[var(--color-bg-elevated)]',
    text: 'text-[var(--color-text-secondary)]',
    border: 'border-[var(--color-border-subtle)]',
    dot: 'bg-[var(--color-text-muted)]',
  },
  pending: {
    icon: Clock,
    bg: 'bg-[var(--color-bg-elevated)]',
    text: 'text-[var(--color-text-muted)]',
    border: 'border-[var(--color-border-subtle)]',
    dot: 'bg-[var(--color-text-muted)]',
  },
}

const sizeConfig = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
}

const iconSizeConfig = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
}

export function StatusBadge({ 
  status, 
  label, 
  showIcon = true, 
  size = 'md',
  pulse = false
}: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium border',
      config.bg,
      config.text,
      config.border,
      sizeConfig[size]
    )}>
      {showIcon && (
        <Icon className={cn(iconSizeConfig[size])} />
      )}
      <span className="relative flex items-center gap-1.5">
        {pulse && (
          <span className={cn(
            'h-1.5 w-1.5 rounded-full animate-pulse',
            config.dot
          )} />
        )}
        {label}
      </span>
    </span>
  )
}

// Trend badge with arrow
interface TrendBadgeProps {
  value: number
  suffix?: string
  size?: 'sm' | 'md'
}

export function TrendBadge({ value, suffix = '%', size = 'md' }: TrendBadgeProps) {
  const isPositive = value > 0
  const isNegative = value < 0
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : null
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium tabular-nums',
      size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-0.5',
      isPositive && 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
      isNegative && 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]',
      !isPositive && !isNegative && 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
    )}>
      {Icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      {isPositive && '+'}{value}{suffix}
    </span>
  )
}

// Dot indicator
interface DotIndicatorProps {
  status: StatusType
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  label?: string
}

export function DotIndicator({ status, size = 'md', pulse = false, label }: DotIndicatorProps) {
  const config = statusConfig[status]
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }
  
  return (
    <span className="inline-flex items-center gap-2">
      <span 
        className={cn(
          'rounded-full',
          sizeClasses[size],
          config.dot,
          pulse && 'animate-pulse'
        )}
        style={{ boxShadow: `0 0 8px currentColor` }}
      />
      {label && (
        <span className={cn('text-sm', config.text)}>{label}</span>
      )}
    </span>
  )
}
