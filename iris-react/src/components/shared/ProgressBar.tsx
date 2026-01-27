import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gradient'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  animate?: boolean
  delay?: number
}

const variantStyles = {
  default: 'bg-[var(--color-accent-primary)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  gradient: 'bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-glow)]',
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

export function ProgressBar({
  value,
  max = 100,
  variant = 'gradient',
  size = 'md',
  showLabel = false,
  label,
  animate = true,
  delay = 0,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)
  
  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
          )}
          {showLabel && (
            <span className="text-sm font-medium text-white tabular-nums">{percentage.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className={cn(
        'w-full rounded-full bg-[var(--color-bg-elevated)] overflow-hidden',
        sizeStyles[size]
      )}>
        <motion.div
          className={cn('h-full rounded-full', variantStyles[variant])}
          initial={animate ? { width: 0 } : false}
          animate={{ width: `${percentage}%` }}
          transition={{ 
            duration: 1, 
            delay,
            ease: [0.34, 1.56, 0.64, 1]
          }}
          style={{
            boxShadow: variant !== 'gradient' ? `0 0 10px currentColor` : undefined,
          }}
        />
      </div>
    </div>
  )
}

// Segmented progress for multi-step processes
interface SegmentedProgressProps {
  segments: Array<{
    value: number
    color: string
    label?: string
  }>
  total: number
  size?: 'sm' | 'md' | 'lg'
}

export function SegmentedProgress({ segments, total, size = 'md' }: SegmentedProgressProps) {
  return (
    <div className="w-full">
      <div className={cn(
        'w-full rounded-full bg-[var(--color-bg-elevated)] overflow-hidden flex',
        sizeStyles[size]
      )}>
        {segments.map((segment, index) => {
          const percentage = (segment.value / total) * 100
          return (
            <motion.div
              key={index}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: segment.color }}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ 
                duration: 0.8, 
                delay: index * 0.1,
                ease: [0.34, 1.56, 0.64, 1]
              }}
            />
          )
        })}
      </div>
      {segments.some(s => s.label) && (
        <div className="flex justify-between mt-2">
          {segments.map((segment, index) => (
            segment.label && (
              <div key={index} className="flex items-center gap-1.5">
                <span 
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-xs text-[var(--color-text-muted)]">{segment.label}</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// Circular progress indicator
interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  showValue?: boolean
}

export function CircularProgress({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  color = 'var(--color-accent-primary)',
  showValue = true,
}: CircularProgressProps) {
  const percentage = Math.min((value / max) * 100, 100)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bg-elevated)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </svg>
      {showValue && (
        <span className="absolute text-xs font-medium text-white tabular-nums">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  )
}
