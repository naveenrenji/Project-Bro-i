import { motion } from 'framer-motion'
import { GraduationCap, Users, TrendingUp, ChevronDown, AlertCircle } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useState } from 'react'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { useFilteredGraduation, useIsFiltered } from '@/hooks/useFilteredData'
import { useGraduation } from '@/hooks/useData'

interface GraduationInsightsProps {
  className?: string
  showCategoryBreakdown?: boolean
  showStudentList?: boolean
}

export function GraduationInsights({
  className,
  showCategoryBreakdown = true,
  showStudentList = false,
}: GraduationInsightsProps) {
  const isFiltered = useIsFiltered()
  const rawGraduation = useGraduation()
  const filteredGraduation = useFilteredGraduation()
  
  // Use filtered data when filters are active
  const graduation = isFiltered ? filteredGraduation : rawGraduation
  
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [showAllStudents, setShowAllStudents] = useState(false)
  
  // Custom label for pie slices - shows count
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: {
    cx: number, cy: number, midAngle: number, innerRadius: number, outerRadius: number, value: number
  }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {formatNumber(value)}
      </text>
    )
  }
  
  if (!graduation) {
    return (
      <GlassCard className={className}>
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <AlertCircle className="h-5 w-5" />
          <span>Graduation data not available</span>
        </div>
      </GlassCard>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Cards */}
      {/* Credits Remaining Distribution - Pie Chart */}
      {graduation.progressDistribution && graduation.progressDistribution.length > 0 && (
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-5 w-5 text-[var(--color-accent-primary)]" />
            <h3 className="text-lg font-semibold text-white">Credits Remaining Distribution</h3>
          </div>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="w-full lg:w-1/2 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={graduation.progressDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="label"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {graduation.progressDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(17, 24, 39, 0.98)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                    formatter={(value: number) => [formatNumber(value), 'Students']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full lg:w-1/2 space-y-2">
              {graduation.progressDistribution.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg-elevated)]">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-white">{formatNumber(item.value)}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">
                      ({formatPercent((item.value / graduation.totalStudents) * 100)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Retention Projection */}
          {graduation.retentionRate && (
            <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">
                  Est. Retention Rate: <strong className="text-white">{formatPercent(graduation.retentionRate * 100)}</strong>
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  Projected Continuing: <strong className="text-white">{formatNumber(graduation.projectedContinuing)}</strong>
                </span>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* By Category Breakdown */}
      {showCategoryBreakdown && graduation.byCategory && graduation.byCategory.length > 0 && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-4">Graduation by Category</h3>
          <div className="space-y-2">
            {graduation.byCategory.map((cat) => (
              <div key={cat.category} className="border-b border-[var(--color-border-subtle)] last:border-0">
                <button
                  onClick={() => setExpandedCategory(
                    expandedCategory === cat.category ? null : cat.category
                  )}
                  className="w-full flex items-center justify-between py-3 text-left hover:bg-[var(--color-bg-elevated)] -mx-2 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--color-text-secondary)]">{cat.category}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      ({formatNumber(cat.total)} students)
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-muted)]">Graduating:</span>
                      <span className="text-sm font-medium text-[var(--color-success)]">
                        {formatNumber(cat.graduating)}
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      'h-4 w-4 text-[var(--color-text-muted)] transition-transform',
                      expandedCategory === cat.category && 'rotate-180'
                    )} />
                  </div>
                </button>
                
                {expandedCategory === cat.category && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pb-3 pl-4"
                  >
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)]">
                        <div className="text-xl font-bold text-[var(--color-success)]">
                          {formatNumber(cat.graduating)}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Graduating</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)]">
                        <div className="text-xl font-bold text-[var(--color-warning)]">
                          {formatNumber(cat.within10)}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Within 10 cr</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)]">
                        <div className="text-xl font-bold text-white">
                          {formatNumber(cat.within20)}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Within 20 cr</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)]">
                        <div className="text-xl font-bold text-[var(--color-text-secondary)]">
                          {formatNumber(cat.continuing)}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Continuing</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Graduating Students List */}
      {showStudentList && graduation.graduatingStudents && graduation.graduatingStudents.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Graduating Students</h3>
            <button
              onClick={() => setShowAllStudents(!showAllStudents)}
              className="text-sm text-[var(--color-accent-primary)] hover:underline"
            >
              {showAllStudents ? 'Show Less' : `Show All (${graduation.graduatingStudents.length})`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)]">
                  <th className="text-left py-2 text-[var(--color-text-muted)] font-medium">Program</th>
                  <th className="text-left py-2 text-[var(--color-text-muted)] font-medium">Category</th>
                  <th className="text-right py-2 text-[var(--color-text-muted)] font-medium">Remaining</th>
                  <th className="text-right py-2 text-[var(--color-text-muted)] font-medium">This Term</th>
                  <th className="text-right py-2 text-[var(--color-text-muted)] font-medium">After Term</th>
                </tr>
              </thead>
              <tbody>
                {(showAllStudents 
                  ? graduation.graduatingStudents 
                  : graduation.graduatingStudents.slice(0, 10)
                ).map((student, i) => (
                  <tr 
                    key={i} 
                    className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]"
                  >
                    <td className="py-2 text-white truncate max-w-[200px]">{student.program}</td>
                    <td className="py-2 text-[var(--color-text-secondary)]">{student.category}</td>
                    <td className="py-2 text-right text-white tabular-nums">{student.creditsRemaining}</td>
                    <td className="py-2 text-right text-white tabular-nums">{student.creditsThisTerm}</td>
                    <td className={cn(
                      'py-2 text-right font-medium tabular-nums',
                      student.creditsAfterTerm <= 0 
                        ? 'text-[var(--color-success)]' 
                        : 'text-[var(--color-text-secondary)]'
                    )}>
                      {student.creditsAfterTerm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  )
}

// Metric card subcomponent
function GradMetricCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: string
  icon: React.ReactNode
}) {
  return (
    <GlassCard padding="sm" className="text-center">
      <div 
        className="mx-auto h-10 w-10 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{formatNumber(value)}</div>
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
    </GlassCard>
  )
}
