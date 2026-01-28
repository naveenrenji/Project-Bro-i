import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LabelList } from 'recharts'
import { GlassCard } from '../shared/GlassCard'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Sparkles, TrendingUp, Users, CreditCard } from 'lucide-react'

interface NTRByCategory {
  category: string
  degreeType: string
  ntr: number
  students: number
  credits: number
}

interface NTRByStudentType {
  type: string
  ntr: number
  students: number
  credits: number
}

interface NTRBreakdownRow {
  category: string
  degreeType: string
  newStudents: number
  currentStudents: number
  totalStudents: number
  newCredits: number
  currentCredits: number
  totalCredits: number
  cpcNew: number
  cpcCurrent: number
  ntrNew: number
  ntrCurrent: number
  totalNtr: number
}

// Color palette
const COLORS = ['#a41034', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

interface NTRBarChartProps {
  data: NTRByCategory[]
  title?: string
  onAskNavs?: () => void
}

export function NTRBarChart({ data, title = 'NTR by Category', onAskNavs }: NTRBarChartProps) {
  // Aggregate by category (sum different degree types)
  const aggregated = data.reduce((acc, item) => {
    const existing = acc.find(a => a.category === item.category)
    if (existing) {
      existing.ntr += item.ntr
      existing.students += item.students
    } else {
      acc.push({ ...item })
    }
    return acc
  }, [] as NTRByCategory[])

  // Sort by NTR descending
  aggregated.sort((a, b) => b.ntr - a.ntr)

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {onAskNavs && (
          <button
            onClick={onAskNavs}
            className="flex items-center gap-1.5 text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Ask Navs
          </button>
        )}
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={aggregated} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis 
              type="number" 
              tickFormatter={(v) => formatCurrency(v, true)}
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              type="category" 
              dataKey="category" 
              width={100}
              tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(20, 24, 36, 0.98)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#fff',
              }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: '#fff', fontWeight: 600 }}
              formatter={(value) => [formatCurrency(value as number), 'NTR']}
            />
            <Bar dataKey="ntr" radius={[0, 4, 4, 0]}>
              {aggregated.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
              <LabelList 
                dataKey="ntr" 
                position="right" 
                formatter={(value: number) => formatCurrency(value, true)}
                style={{ fill: '#fff', fontSize: 11, fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}

interface NTRPieChartProps {
  data: NTRByStudentType[]
  title?: string
  onAskNavs?: () => void
}

export function NTRPieChart({ data, title = 'NTR by Student Type', onAskNavs }: NTRPieChartProps) {
  const COLORS_PIE = ['#3b82f6', '#22c55e']
  const total = data.reduce((sum, item) => sum + item.ntr, 0)
  
  // Custom label for pie slices
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: {
    cx: number, cy: number, midAngle: number, innerRadius: number, outerRadius: number, value: number
  }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {formatCurrency(value, true)}
      </text>
    )
  }

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {onAskNavs && (
          <button
            onClick={onAskNavs}
            className="flex items-center gap-1.5 text-sm text-[var(--color-accent-primary)] hover:text-[var(--color-accent-glow)] transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Ask Navs
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-6">
        <div className="h-48 w-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="ntr"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                label={renderPieLabel}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(20, 24, 36, 0.98)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#fff', fontWeight: 600 }}
                formatter={(value) => [formatCurrency(value as number), 'NTR']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex-1 space-y-4">
          {data.map((item, index) => (
            <div key={item.type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS_PIE[index] }}
                />
                <span className="text-[var(--color-text-secondary)]">{item.type}</span>
              </div>
              <div className="text-right">
                <div className="text-white font-medium">{formatCurrency(item.ntr, true)}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {((item.ntr / total) * 100).toFixed(0)}% • {formatNumber(item.students)} students
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

interface NTRSummaryCardsProps {
  total: number
  goal: number
  percentOfGoal: number
  newNTR: number
  currentNTR: number
  totalStudents: number
  totalCredits: number
}

export function NTRSummaryCards({
  total,
  goal,
  percentOfGoal,
  newNTR,
  currentNTR,
  totalStudents,
  totalCredits,
}: NTRSummaryCardsProps) {
  const gap = goal - total
  const isOnTrack = percentOfGoal >= 80

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
      >
        <GlassCard padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-accent-primary)]" />
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Total NTR</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(total, true)}</div>
          <div className={`text-xs ${isOnTrack ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
            {percentOfGoal.toFixed(0)}% of goal
          </div>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-text-muted)]" />
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Gap to Goal</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(gap > 0 ? gap : 0, true)}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Goal: {formatCurrency(goal, true)}
          </div>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <GlassCard padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-[var(--color-success)]" />
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Students</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatNumber(totalStudents)}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            New: {formatCurrency(newNTR, true)}
          </div>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassCard padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-[var(--color-warning)]" />
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Credits</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatNumber(totalCredits)}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Current: {formatCurrency(currentNTR, true)}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}

interface NTRBreakdownTableProps {
  data: NTRBreakdownRow[]
  title?: string
}

export function NTRBreakdownTable({ data, title = 'NTR Detailed Breakdown' }: NTRBreakdownTableProps) {
  // Calculate grand total
  const grandTotal = data.reduce(
    (acc, row) => ({
      newStudents: acc.newStudents + row.newStudents,
      currentStudents: acc.currentStudents + row.currentStudents,
      totalStudents: acc.totalStudents + row.totalStudents,
      newCredits: acc.newCredits + row.newCredits,
      currentCredits: acc.currentCredits + row.currentCredits,
      totalCredits: acc.totalCredits + row.totalCredits,
      ntrNew: acc.ntrNew + row.ntrNew,
      ntrCurrent: acc.ntrCurrent + row.ntrCurrent,
      totalNtr: acc.totalNtr + row.totalNtr,
    }),
    {
      newStudents: 0,
      currentStudents: 0,
      totalStudents: 0,
      newCredits: 0,
      currentCredits: 0,
      totalCredits: 0,
      ntrNew: 0,
      ntrCurrent: 0,
      totalNtr: 0,
    }
  )

  return (
    <GlassCard>
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)]">
              <th className="text-left py-3 px-2 text-[var(--color-text-muted)] font-medium">Category</th>
              <th className="text-left py-3 px-2 text-[var(--color-text-muted)] font-medium">Degree</th>
              <th className="text-right py-3 px-2 text-[var(--color-text-muted)] font-medium">New</th>
              <th className="text-right py-3 px-2 text-[var(--color-text-muted)] font-medium">Current</th>
              <th className="text-right py-3 px-2 text-[var(--color-text-muted)] font-medium">Credits</th>
              <th className="text-right py-3 px-2 text-[var(--color-text-muted)] font-medium">CPC (New)</th>
              <th className="text-right py-3 px-2 text-[var(--color-text-muted)] font-medium">CPC (Curr)</th>
              <th className="text-right py-3 px-2 text-[var(--color-text-muted)] font-medium">NTR</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr 
                key={`${row.category}-${row.degreeType}`}
                className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <td className="py-3 px-2 text-white">{row.category}</td>
                <td className="py-3 px-2 text-[var(--color-text-secondary)]">{row.degreeType}</td>
                <td className="py-3 px-2 text-right text-white tabular-nums">{row.newStudents}</td>
                <td className="py-3 px-2 text-right text-white tabular-nums">{row.currentStudents}</td>
                <td className="py-3 px-2 text-right text-[var(--color-text-secondary)] tabular-nums">{formatNumber(row.totalCredits)}</td>
                <td className="py-3 px-2 text-right text-[var(--color-text-secondary)] tabular-nums">${row.cpcNew}</td>
                <td className="py-3 px-2 text-right text-[var(--color-text-secondary)] tabular-nums">${row.cpcCurrent}</td>
                <td className="py-3 px-2 text-right text-white font-medium tabular-nums">{formatCurrency(row.totalNtr, true)}</td>
              </tr>
            ))}
            {/* Grand Total Row */}
            <tr className="bg-[var(--color-bg-elevated)] font-semibold">
              <td className="py-3 px-2 text-white" colSpan={2}>Grand Total</td>
              <td className="py-3 px-2 text-right text-white tabular-nums">{grandTotal.newStudents}</td>
              <td className="py-3 px-2 text-right text-white tabular-nums">{grandTotal.currentStudents}</td>
              <td className="py-3 px-2 text-right text-white tabular-nums">{formatNumber(grandTotal.totalCredits)}</td>
              <td className="py-3 px-2 text-right text-[var(--color-text-muted)]">—</td>
              <td className="py-3 px-2 text-right text-[var(--color-text-muted)]">—</td>
              <td className="py-3 px-2 text-right text-[var(--color-accent-primary)] font-bold tabular-nums">{formatCurrency(grandTotal.totalNtr, true)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}
