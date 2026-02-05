/**
 * HealthStatusPanel Component
 * 
 * Panel showing all health indicators (YoY, yield, category performance).
 */

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/shared/GlassCard'
import { YoYBadge, getYoYStatus, getPercentStatus, type HealthStatus } from '@/components/shared/HealthBadge'
import { Activity, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface HealthStatusPanelProps {
  yoyApps?: number
  yoyEnrolls?: number
  yieldRate?: number
  yieldTarget?: number
  categoryPerformance?: Array<{
    category: string
    yoyChange: number
  }>
}

export function HealthStatusPanel({
  yoyApps,
  yoyEnrolls,
  yieldRate,
  yieldTarget = 75,
  categoryPerformance = [],
}: HealthStatusPanelProps) {
  // Calculate overall health score
  const healthIndicators: HealthStatus[] = []
  
  if (yoyApps !== undefined) {
    healthIndicators.push(getYoYStatus(yoyApps))
  }
  if (yoyEnrolls !== undefined) {
    healthIndicators.push(getYoYStatus(yoyEnrolls))
  }
  if (yieldRate !== undefined) {
    healthIndicators.push(getPercentStatus(yieldRate, 80, 65))
  }
  
  const goodCount = healthIndicators.filter(s => s === 'good').length
  const dangerCount = healthIndicators.filter(s => s === 'danger').length
  
  let overallStatus: HealthStatus = 'neutral'
  if (dangerCount > 0) overallStatus = 'danger'
  else if (goodCount >= healthIndicators.length * 0.6) overallStatus = 'good'
  else if (goodCount > 0) overallStatus = 'warning'
  
  const overallColors = {
    good: { bg: 'rgba(34, 197, 94, 0.1)', text: 'var(--color-success)', label: 'Healthy' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--color-warning)', label: 'Monitor' },
    danger: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--color-danger)', label: 'Action Needed' },
    neutral: { bg: 'rgba(148, 163, 184, 0.1)', text: 'var(--color-text-secondary)', label: 'Stable' },
  }
  
  const overall = overallColors[overallStatus]
  
  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
            <Activity className="h-4 w-4 text-[var(--color-accent-primary)]" />
          </div>
          <h3 className="font-semibold text-white">Health Status</h3>
        </div>
        
        {/* Overall status badge */}
        <div 
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{ backgroundColor: overall.bg, color: overall.text }}
        >
          {overall.label}
        </div>
      </div>
      
      <div className="space-y-3">
        {/* YoY Metrics */}
        {yoyApps !== undefined && (
          <YoYBadge label="Applications" change={yoyApps} />
        )}
        
        {yoyEnrolls !== undefined && (
          <YoYBadge label="Enrollments" change={yoyEnrolls} />
        )}
        
        {/* Yield Rate */}
        {yieldRate !== undefined && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 text-sm"
          >
            <div
              className="flex items-center justify-center h-6 w-6 rounded-full"
              style={{ 
                backgroundColor: getPercentStatus(yieldRate, 80, 65) === 'good' 
                  ? 'rgba(34, 197, 94, 0.15)' 
                  : getPercentStatus(yieldRate, 80, 65) === 'warning'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)'
              }}
            >
              <span className="text-xs font-bold" style={{
                color: getPercentStatus(yieldRate, 80, 65) === 'good' 
                  ? 'var(--color-success)' 
                  : getPercentStatus(yieldRate, 80, 65) === 'warning'
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)'
              }}>
                %
              </span>
            </div>
            <span className="text-[var(--color-text-secondary)]">Yield Rate</span>
            <span 
              className="font-semibold"
              style={{
                color: getPercentStatus(yieldRate, 80, 65) === 'good' 
                  ? 'var(--color-success)' 
                  : getPercentStatus(yieldRate, 80, 65) === 'warning'
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)'
              }}
            >
              {yieldRate.toFixed(1)}%
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              (target: {yieldTarget}%)
            </span>
          </motion.div>
        )}
        
        {/* Divider */}
        {categoryPerformance.length > 0 && (
          <div className="border-t border-[var(--color-border-subtle)] my-3" />
        )}
        
        {/* Category Performance */}
        {categoryPerformance.slice(0, 4).map((cat, i) => (
          <motion.div
            key={cat.category}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            <YoYBadge label={cat.category} change={cat.yoyChange} size="sm" />
          </motion.div>
        ))}
      </div>
      
      {/* Deep dive link */}
      <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
        <Link 
          to="/explore"
          className="text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors flex items-center gap-1"
        >
          View Details <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </GlassCard>
  )
}
