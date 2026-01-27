import { forwardRef, type HTMLAttributes } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  animated?: boolean
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow, hover, padding = 'md', animated, children, ...props }, ref) => {
    const classes = cn(
      'glass-card',
      glow && 'glass-card-glow',
      hover && 'transition-all duration-300 hover:border-[var(--color-border-strong)] hover:shadow-lg',
      paddingClasses[padding],
      className
    )
    
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={classes}
          {...(props as HTMLMotionProps<'div'>)}
        >
          {children}
        </motion.div>
      )
    }
    
    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    )
  }
)

GlassCard.displayName = 'GlassCard'
