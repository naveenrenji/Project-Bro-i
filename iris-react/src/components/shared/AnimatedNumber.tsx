import CountUp from 'react-countup'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  value: number
  previousValue?: number
  format?: 'currency' | 'number' | 'percent'
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
  compact?: boolean
}

/**
 * AnimatedNumber - Smooth count-up animation for KPI values
 * Uses react-countup for performant, eased animations
 */
export function AnimatedNumber({
  value,
  previousValue,
  format = 'number',
  prefix = '',
  suffix = '',
  decimals,
  duration = 1.5,
  className,
  compact = false,
}: AnimatedNumberProps) {
  // Determine decimal places based on format
  const decimalPlaces = decimals ?? (format === 'currency' ? (compact ? 1 : 0) : format === 'percent' ? 1 : 0)
  
  // Format prefix based on format type
  const displayPrefix = format === 'currency' ? '$' + prefix : prefix
  const displaySuffix = format === 'percent' ? '%' + suffix : suffix
  
  // For compact currency (millions)
  const displayValue = compact && format === 'currency' ? value / 1_000_000 : value
  const compactSuffix = compact && format === 'currency' ? 'M' + suffix : displaySuffix
  
  return (
    <CountUp
      start={previousValue ?? 0}
      end={displayValue}
      duration={duration}
      decimals={decimalPlaces}
      prefix={displayPrefix}
      suffix={compactSuffix}
      separator=","
      useEasing={true}
      easingFn={(t, b, c, d) => {
        // easeOutExpo for satisfying deceleration
        return c * (-Math.pow(2, -10 * t / d) + 1) + b
      }}
      className={cn('tabular-nums', className)}
    />
  )
}

/**
 * AnimatedCurrency - Shorthand for currency animation
 */
export function AnimatedCurrency({
  value,
  compact = true,
  className,
  ...props
}: Omit<AnimatedNumberProps, 'format'>) {
  return (
    <AnimatedNumber
      value={value}
      format="currency"
      compact={compact}
      className={className}
      {...props}
    />
  )
}

/**
 * AnimatedPercent - Shorthand for percentage animation
 */
export function AnimatedPercent({
  value,
  className,
  ...props
}: Omit<AnimatedNumberProps, 'format'>) {
  return (
    <AnimatedNumber
      value={value}
      format="percent"
      decimals={1}
      className={className}
      {...props}
    />
  )
}
