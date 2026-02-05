import { forwardRef, type HTMLAttributes } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  hover?: boolean
  hoverLift?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  animated?: boolean
  delay?: number
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const accentGlowColors = {
  primary: 'rgba(164, 16, 52, 0.15)',
  success: 'rgba(0, 208, 132, 0.15)',
  warning: 'rgba(255, 184, 0, 0.15)',
  danger: 'rgba(255, 71, 87, 0.15)',
  info: 'rgba(59, 130, 246, 0.15)',
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ 
    className, 
    glow, 
    hover, 
    hoverLift = false,
    padding = 'md', 
    animated, 
    delay = 0,
    accentColor,
    children, 
    ...props 
  }, ref) => {
    const classes = cn(
      'glass-card relative overflow-hidden',
      glow && 'glass-card-glow',
      hover && 'transition-all duration-300 hover:border-[var(--color-border-strong)] hover:shadow-lg',
      hoverLift && 'transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20',
      paddingClasses[padding],
      className
    )
    
    // Content with optional accent glow
    const content = accentColor ? (
      <>
        {/* Accent glow overlay */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${accentGlowColors[accentColor]} 0%, transparent 70%)`,
          }}
        />
        {children}
      </>
    ) : children
    
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.4, 
            delay: delay * 0.08,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          className={cn(classes, accentColor && 'group')}
          {...(props as HTMLMotionProps<'div'>)}
        >
          {content}
        </motion.div>
      )
    }
    
    return (
      <div ref={ref} className={cn(classes, accentColor && 'group')} {...props}>
        {content}
      </div>
    )
  }
)

GlassCard.displayName = 'GlassCard'
