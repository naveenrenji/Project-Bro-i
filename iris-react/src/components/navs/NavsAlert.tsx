import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, TrendingUp, Info, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Alert {
  type: 'warning' | 'success' | 'info'
  message: string
  metric?: string
  value?: number
}

interface NavsAlertProps {
  alerts: Alert[]
}

const iconMap = {
  warning: AlertTriangle,
  success: TrendingUp,
  info: Info,
}

const colorMap = {
  warning: {
    bg: 'bg-[var(--color-warning)]/10',
    border: 'border-[var(--color-warning)]/30',
    text: 'text-[var(--color-warning)]',
    icon: 'text-[var(--color-warning)]',
  },
  success: {
    bg: 'bg-[var(--color-success)]/10',
    border: 'border-[var(--color-success)]/30',
    text: 'text-[var(--color-success)]',
    icon: 'text-[var(--color-success)]',
  },
  info: {
    bg: 'bg-[var(--color-info)]/10',
    border: 'border-[var(--color-info)]/30',
    text: 'text-[var(--color-info)]',
    icon: 'text-[var(--color-info)]',
  },
}

export function NavsAlert({ alerts }: NavsAlertProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  
  const visibleAlerts = alerts.filter((_, i) => !dismissed.has(i))
  
  if (visibleAlerts.length === 0) return null
  
  const primaryAlert = visibleAlerts[0]
  const primaryIndex = alerts.findIndex((a) => a === primaryAlert)
  const Icon = iconMap[primaryAlert.type]
  const colors = colorMap[primaryAlert.type]
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          'rounded-xl border p-4 mb-6',
          colors.bg,
          colors.border
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn('mt-0.5', colors.icon)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className={cn('font-medium', colors.text)}>
                {primaryAlert.message}
              </p>
              {visibleAlerts.length > 1 && (
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  +{visibleAlerts.length - 1} more alert{visibleAlerts.length > 2 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setDismissed(prev => new Set(prev).add(primaryIndex))}
            className="text-[var(--color-text-muted)] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
