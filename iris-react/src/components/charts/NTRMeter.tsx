/**
 * NTRMeter Component
 * 
 * Stunning radial gauge with gradient stroke, glow effects, and smooth animations.
 * Shows current NTR, projected NTR, and goal progress in a unified visual.
 * Includes confetti celebration when goal is reached!
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ConfettiExplosion from 'react-confetti-explosion'
import { GlassCard } from '@/components/shared/GlassCard'
import { TrendingUp, TrendingDown, Target, Zap, PartyPopper } from 'lucide-react'
import CountUp from 'react-countup'

interface NTRMeterProps {
  current: number
  goal: number
  projected?: number
  projectedLow?: number
  projectedHigh?: number
  previousYear?: number
  showProjection?: boolean
}

/**
 * Format currency with full digits
 */
function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format currency compact (for smaller displays)
 */
function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return formatCurrencyFull(value)
}

/**
 * Radial Gauge Component with gradient stroke and glow
 */
function RadialGauge({ 
  percent, 
  projectedPercent,
  size = 200,
  strokeWidth = 14,
}: { 
  percent: number
  projectedPercent?: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * Math.PI * 1.5 // 270 degrees (3/4 circle)
  const offset = circumference - (Math.min(100, percent) / 100) * circumference
  const projectedOffset = projectedPercent 
    ? circumference - (Math.min(100, projectedPercent) / 100) * circumference 
    : offset
  
  // Gradient ID (unique per instance)
  const gradientId = `ntr-gauge-gradient-${Math.random().toString(36).substr(2, 9)}`
  const glowId = `ntr-gauge-glow-${Math.random().toString(36).substr(2, 9)}`
  
  // Milestone positions (at 50%, 75%, 100%)
  const milestones = [50, 75, 100]
  
  const getColor = (p: number) => {
    if (p >= 90) return '#00d084'
    if (p >= 70) return '#ffb800'
    return '#ff4757'
  }
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-[135deg]"
      >
        <defs>
          {/* Gradient for the progress arc */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor={getColor(percent)} />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={0}
        />
        
        {/* Projected arc (if different from current) */}
        {projectedPercent && projectedPercent > percent && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(139, 92, 246, 0.3)"
            strokeWidth={strokeWidth - 4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: projectedOffset }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
          />
        )}
        
        {/* Progress arc with gradient and glow */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          filter={`url(#${glowId})`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        
        {/* Milestone markers */}
        {milestones.map((milestone) => {
          const angle = ((milestone / 100) * 270 - 135) * (Math.PI / 180)
          const markerRadius = radius + strokeWidth / 2 + 8
          const x = size / 2 + markerRadius * Math.cos(angle)
          const y = size / 2 + markerRadius * Math.sin(angle)
          const isReached = percent >= milestone
          
          return (
            <g key={milestone} className="transform rotate-[135deg]" style={{ transformOrigin: `${size/2}px ${size/2}px` }}>
              <circle
                cx={x}
                cy={y}
                r={3}
                fill={isReached ? getColor(milestone) : 'rgba(255,255,255,0.2)'}
              />
              <text
                x={x}
                y={y - 10}
                fill="rgba(255,255,255,0.5)"
                fontSize="10"
                textAnchor="middle"
                className="font-medium"
              >
                {milestone}%
              </text>
            </g>
          )
        })}
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
          Progress
        </div>
        <div 
          className="text-3xl font-bold tabular-nums"
          style={{ color: getColor(percent) }}
        >
          <CountUp 
            end={percent} 
            decimals={1} 
            suffix="%" 
            duration={1.5} 
            useEasing 
          />
        </div>
        <div className="text-xs text-[var(--color-text-muted)] mt-1">
          of goal
        </div>
      </div>
      
      {/* Pulsing glow when near goal */}
      {percent >= 85 && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${getColor(percent)}20 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </div>
  )
}

export function NTRMeter({
  current,
  goal,
  projected,
  projectedLow,
  projectedHigh,
  previousYear,
  showProjection = true,
}: NTRMeterProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false)
  
  const percentOfGoal = goal > 0 ? (current / goal) * 100 : 0
  const gapToGoal = Math.max(0, goal - current)
  const projectedPercent = projected && goal > 0 ? (projected / goal) * 100 : 0
  const goalReached = percentOfGoal >= 100
  
  // Trigger confetti when goal is reached (only once per session)
  useEffect(() => {
    if (goalReached && !hasTriggeredConfetti) {
      // Delay to let the gauge animation complete
      const timer = setTimeout(() => {
        setShowConfetti(true)
        setHasTriggeredConfetti(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [goalReached, hasTriggeredConfetti])
  
  // Status color based on progress
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return 'var(--color-success)'
    if (percent >= 70) return 'var(--color-warning)'
    return 'var(--color-danger)'
  }
  
  const statusColor = getStatusColor(percentOfGoal)
  
  // YoY calculation
  const yoyChange = previousYear && previousYear > 0
    ? ((current - previousYear) / previousYear) * 100
    : 0
  
  return (
    <GlassCard className="relative overflow-hidden">
      {/* Confetti celebration when goal is reached! */}
      {showConfetti && (
        <div className="absolute top-1/2 left-1/2 z-50">
          <ConfettiExplosion
            force={0.8}
            duration={3000}
            particleCount={150}
            width={1600}
            colors={['#00d084', '#3b82f6', '#8b5cf6', '#ffb800', '#A41034']}
            onComplete={() => setShowConfetti(false)}
          />
        </div>
      )}
      
      {/* Goal reached banner */}
      {goalReached && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-0 left-0 right-0 py-2 px-4 bg-gradient-to-r from-[var(--color-success)] to-[#00a86b] text-white text-center text-sm font-medium flex items-center justify-center gap-2 z-10"
        >
          <PartyPopper className="h-4 w-4" />
          Goal Reached! Congratulations!
          <PartyPopper className="h-4 w-4" />
        </motion.div>
      )}
      
      {/* Subtle gradient background */}
      <div 
        className={`absolute inset-0 opacity-30 ${goalReached ? 'pt-10' : ''}`}
        style={{
          background: `radial-gradient(ellipse at 30% 0%, ${statusColor}15 0%, transparent 50%)`,
        }}
      />
      
      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        {/* Left: Current NTR */}
        <div className="text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-2 mb-3">
            <div 
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${statusColor}20` }}
            >
              <Target className="h-5 w-5" style={{ color: statusColor }} />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Current NTR
            </span>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white mb-2 tabular-nums"
          >
            <CountUp
              end={current}
              duration={1.5}
              separator=","
              prefix="$"
              useEasing
            />
          </motion.div>
          
          <div className="text-sm text-[var(--color-text-muted)] mb-4">
            of <span className="text-white font-medium">{formatCurrencyCompact(goal)}</span> goal
          </div>
          
          {/* Gap indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] text-sm">
            <span className="text-[var(--color-text-muted)]">Gap:</span>
            <span className="font-medium text-[var(--color-warning)]">
              {formatCurrencyCompact(gapToGoal)}
            </span>
          </div>
          
          {/* YoY indicator */}
          {previousYear !== undefined && (
            <div className="mt-4 flex items-center justify-center lg:justify-start gap-2">
              {yoyChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
              ) : (
                <TrendingDown className="h-4 w-4 text-[var(--color-danger)]" />
              )}
              <span 
                className="text-sm font-medium"
                style={{ color: yoyChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
              >
                {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}% YoY
              </span>
            </div>
          )}
        </div>
        
        {/* Center: Radial Gauge */}
        <div className="flex justify-center">
          <RadialGauge 
            percent={percentOfGoal} 
            projectedPercent={showProjection ? projectedPercent : undefined}
            size={220}
            strokeWidth={16}
          />
        </div>
        
        {/* Right: Projected NTR */}
        {showProjection && projected ? (
          <div className="text-center lg:text-right">
            <div className="flex items-center justify-center lg:justify-end gap-2 mb-3">
              <span className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Projected NTR
              </span>
              <div className="h-10 w-10 rounded-xl bg-[var(--color-info)]/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-[var(--color-info)]" />
              </div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-bold text-white mb-2 tabular-nums"
            >
              <CountUp
                end={projected}
                duration={1.5}
                separator=","
                prefix="$"
                delay={0.3}
                useEasing
              />
            </motion.div>
            
            <div className="text-sm text-[var(--color-text-muted)] mb-4">
              end of term forecast
            </div>
            
            {/* Projection range */}
            {projectedLow && projectedHigh && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] text-sm mb-4">
                <span className="text-[var(--color-text-muted)]">Range:</span>
                <span className="font-medium text-white">
                  {formatCurrencyCompact(projectedLow)} – {formatCurrencyCompact(projectedHigh)}
                </span>
              </div>
            )}
            
            {/* Pipeline contribution */}
            <div className="flex items-center justify-center lg:justify-end gap-2">
              <span className="text-sm text-[var(--color-text-muted)]">From pipeline:</span>
              <span className="text-sm font-medium text-[var(--color-success)]">
                +{formatCurrencyCompact(projected - current)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center lg:text-right">
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ 
                backgroundColor: `${statusColor}20`,
                color: statusColor,
              }}
            >
              {percentOfGoal >= 90 ? 'Excellent Progress' : percentOfGoal >= 70 ? 'On Track' : 'Needs Push'}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
