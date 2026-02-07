import { useState, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, TrendingUp, Users, RotateCcw,
  ChevronDown, ChevronUp, Settings, BookOpen, GraduationCap,
  Wallet, Building2, Target, FileSpreadsheet, FileDown, FileText,
  Sparkles, Loader2, Trash2,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import {
  type FinancialInputs, type ScenarioResults, type YearGrowthRates,
  getDefaultInputs, computeScenario, programDurationTerms, sessionsPerYear,
} from '@/lib/financial-engine'
import type { AIContent } from '@/lib/financial-export-pdf'

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtCur(v: number): string {
  if (v < 0) return `($${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })})`
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

interface SavedScenario { name: string; inputs: FinancialInputs; results: ScenarioResults }

// ─── Reusable components ─────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[var(--color-border-subtle)] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-4 py-3 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-surface)] transition-colors">
        <span className="flex items-center gap-2 text-sm font-medium text-white"><Icon className="h-4 w-4 text-[var(--color-accent-primary)]" />{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-[var(--color-bg-surface)]">{children}</div>}
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (<div><label className="block text-xs text-[var(--color-text-muted)] mb-1">{label}</label>{children}{hint && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{hint}</p>}</div>)
}

function NumInput({ value, onChange, step, prefix, suffix }: {
  value: number; onChange: (v: number) => void; step?: number; prefix?: string; suffix?: string
}) {
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-xs text-[var(--color-text-muted)]">{prefix}</span>}
      <input type="number" value={value} step={step} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-white focus:border-[var(--color-accent-primary)] focus:outline-none" />
      {suffix && <span className="text-xs text-[var(--color-text-muted)]">{suffix}</span>}
    </div>
  )
}

function KPICard({ label, value, accent = 'var(--color-accent-primary)' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border-l-4" style={{ borderLeftColor: accent }}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
    </div>
  )
}

// ═════════════════════════ MAIN COMPONENT ════════════════════════════

export function ProgramFinancial() {
  const [inputs, setInputs] = useState<FinancialInputs>(getDefaultInputs())
  const [activeTab, setActiveTab] = useState<'summary' | 'cohorts' | 'detail' | 'compare'>('summary')
  const [scenarios, setScenarios] = useState<SavedScenario[]>([])
  const [scenarioName, setScenarioName] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const inputsRef = useRef(inputs); inputsRef.current = inputs
  const scenarioNameRef = useRef(scenarioName); scenarioNameRef.current = scenarioName
  const results = useMemo(() => computeScenario(inputs), [inputs])
  const resultsRef = useRef(results); resultsRef.current = results

  const update = useCallback(<K extends keyof FinancialInputs>(key: K, val: FinancialInputs[K]) => {
    setInputs(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'projectionYears' || key === 'includeSummer') {
        const yrs = key === 'projectionYears' ? (val as number) : prev.projectionYears
        const summer = key === 'includeSummer' ? (val as boolean) : prev.includeSummer
        const existing = prev.growthByYear
        const grid: YearGrowthRates[] = []
        for (let y = 0; y < yrs; y++) grid.push(existing[y] ?? { fall: y === 0 ? 0 : 0.25, spring: 0.01, summer: summer ? 0.01 : 0 })
        next.growthByYear = grid
      }
      return next
    })
  }, [])

  const setYearAllGrowth = useCallback((yi: number, pct: number) => {
    setInputs(prev => {
      const grid = [...prev.growthByYear]
      grid[yi] = { fall: pct / 100, spring: pct / 100, summer: pct / 100 }
      return { ...prev, growthByYear: grid }
    })
  }, [])

  const updateGrowth = useCallback((yi: number, k: keyof YearGrowthRates, pct: number) => {
    setInputs(prev => {
      const grid = [...prev.growthByYear]
      grid[yi] = { ...grid[yi], [k]: pct / 100 }
      return { ...prev, growthByYear: grid }
    })
  }, [])

  const getTitle = () => scenarioNameRef.current.trim() || inputsRef.current.programName

  const handlePDFQuick = async () => {
    const { generatePDF } = await import('@/lib/financial-export-pdf')
    generatePDF(inputsRef.current, resultsRef.current, 'quick', getTitle())
  }
  const handlePDFFull = async () => {
    const { generatePDF } = await import('@/lib/financial-export-pdf')
    generatePDF(inputsRef.current, resultsRef.current, 'full', getTitle())
  }
  const handleExcel = async () => {
    const { generateExcel } = await import('@/lib/financial-export-excel')
    generateExcel(inputsRef.current, resultsRef.current, getTitle())
  }

  // AI-Enhanced PDF — tries Gemini first, falls back to Ollama, then plain PDF
  const [aiStatus, setAiStatus] = useState('')
  const handleAIPDF = async () => {
    setAiLoading(true)
    setAiStatus('')
    try {
      const { generateWithProvider, geminiProvider, ollamaProvider } = await import('@/lib/llm-provider')
      const inp = inputsRef.current
      const res = resultsRef.current

      const prompt = `You are a senior financial analyst at Stevens Institute of Technology, College of Professional Education. You are reviewing a program financial estimation model.

PROGRAM: ${inp.programName}
PROJECTION: ${inp.projectionYears} years (FY${inp.startFY}-FY${inp.startFY + inp.projectionYears - 1})
DELIVERY: ${inp.deliveryFormat} | ${inp.numberOfPrograms} program(s) | Summer: ${inp.includeSummer ? 'Yes' : 'No'}
INITIAL INTAKE: ${inp.initialIntake} students | TUITION: $${inp.tuitionPerCredit}/credit x ${inp.creditsPerSession} credits/session
RETENTION: ${Math.round(inp.earlyRetentionRate * 100)}% early, ${Math.round(inp.lateRetentionRate * 100)}% late

P&L RESULTS:
${res.plSummary.map(r => `${r.fiscalYear}: Revenue $${Math.round(r.revenue).toLocaleString()}, Cost $${Math.round(r.cost).toLocaleString()}, Net $${Math.round(r.net).toLocaleString()}, Margin ${r.netMarginPct.toFixed(1)}%`).join('\n')}
Break-Even: ${res.breakEvenYear ?? 'Not reached'}

Respond in this EXACT JSON format (no markdown, no code fences):
{"narrative":"2-3 paragraph executive summary","risks":["risk1","risk2","risk3"],"opportunities":["opp1","opp2","opp3"],"recommendation":"Go/Cautious/No-Go with 1-2 sentence rationale"}`

      let raw: string | null = null

      // 1) Try Gemini
      try {
        setAiStatus('Calling Gemini...')
        const geminiOk = await geminiProvider.isAvailable()
        if (!geminiOk) throw new Error('Gemini API key not configured')
        raw = await generateWithProvider(prompt, 'gemini')
        setAiStatus('Gemini responded')
      } catch (geminiErr) {
        console.warn('Gemini failed, trying Ollama:', geminiErr)

        // 2) Fallback to Ollama
        try {
          setAiStatus('Gemini unavailable — trying Ollama...')
          const ollamaOk = await ollamaProvider.isAvailable()
          if (!ollamaOk) throw new Error('Ollama server not running')
          const models = await ollamaProvider.listModels()
          if (models.length === 0) throw new Error('No supported Ollama models installed')
          raw = await generateWithProvider(prompt, 'ollama', models[0])
          setAiStatus(`Ollama responded (${models[0]})`)
        } catch (ollamaErr) {
          console.warn('Ollama also failed:', ollamaErr)
        }
      }

      if (raw) {
        // Parse JSON from response (handle potential markdown wrapping)
        const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const ai: AIContent = JSON.parse(jsonStr)

        const { generatePDF } = await import('@/lib/financial-export-pdf')
        generatePDF(inputsRef.current, resultsRef.current, 'quick', getTitle(), ai)
        setAiStatus('')
      } else {
        // Both providers failed — generate plain PDF with warning
        setAiStatus('AI unavailable — generated standard PDF')
        const { generatePDF } = await import('@/lib/financial-export-pdf')
        generatePDF(inputsRef.current, resultsRef.current, 'quick', getTitle())
        setTimeout(() => setAiStatus(''), 5000)
      }
    } catch (err) {
      console.error('AI PDF generation failed:', err)
      setAiStatus('AI failed — generated standard PDF')
      const { generatePDF } = await import('@/lib/financial-export-pdf')
      generatePDF(inputsRef.current, resultsRef.current, 'quick', getTitle())
      setTimeout(() => setAiStatus(''), 5000)
    } finally {
      setAiLoading(false)
    }
  }

  const spy = sessionsPerYear(inputs)
  const getYearAll = (yr: YearGrowthRates): number | null => {
    const f = Math.round(yr.fall * 100), s = Math.round(yr.spring * 100), su = Math.round(yr.summer * 100)
    return (f === s && s === su) ? f : null
  }

  const tabs = [
    { id: 'summary' as const, label: 'Executive Summary', icon: Target },
    { id: 'cohorts' as const, label: 'Cohort Details', icon: Users },
    { id: 'detail' as const, label: 'Revenue & Costs', icon: Wallet },
    { id: 'compare' as const, label: 'Scenario Compare', icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-[var(--color-accent-primary)]" /> Program Financial Estimation
          </h1>
          <p className="text-[var(--color-text-muted)]">Model the financial viability of a graduate program</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setInputs(getDefaultInputs())} className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"><RotateCcw className="h-4 w-4" /> Reset</button>
          <button onClick={handlePDFQuick} className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-white rounded-lg hover:bg-[var(--color-bg-surface)] transition-colors"><FileText className="h-4 w-4" /> Summary</button>
          <button onClick={handlePDFFull} className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-white rounded-lg hover:bg-[var(--color-bg-surface)] transition-colors"><FileDown className="h-4 w-4" /> Full Report</button>
          <button onClick={handleAIPDF} disabled={aiLoading} className="flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-[var(--color-accent-primary)] to-purple-600 text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? 'Generating...' : 'AI Summary'}
          </button>
          <button onClick={handleExcel} className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--color-accent-primary)] text-white rounded-lg hover:bg-[var(--color-accent-primary)]/80 transition-colors"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
        </div>
      </motion.div>
      {aiStatus && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-[var(--color-text-muted)] flex items-center gap-2 -mt-4">
          {aiLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          {aiStatus}
        </motion.div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Revenue" value={fmtCur(results.totalRevenue)} />
        <KPICard label="Total Cost" value={fmtCur(results.totalCost)} accent="var(--color-text-secondary)" />
        <KPICard label="Net P&L" value={fmtCur(results.totalNet)} accent={results.totalNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <KPICard label="Break-Even" value={results.breakEvenYear ?? 'N/A'} accent={results.breakEvenYear ? 'var(--color-success)' : 'var(--color-danger)'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── Inputs ─── */}
        <div className="lg:col-span-4 space-y-3">
          <Section title="Program Structure" icon={BookOpen} defaultOpen>
            <Field label="Program Name"><input value={inputs.programName} onChange={e => update('programName', e.target.value)} className="w-full px-2 py-1.5 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-white focus:border-[var(--color-accent-primary)] focus:outline-none" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Courses"><NumInput value={inputs.totalCourses} onChange={v => update('totalCourses', v)} /></Field>
              <Field label="Credits/Course"><NumInput value={inputs.creditsPerCourse} onChange={v => update('creditsPerCourse', v)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Delivery Format"><select value={inputs.deliveryFormat} onChange={e => update('deliveryFormat', e.target.value as '8-week' | '16-week')} className="w-full px-2 py-1.5 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-white"><option value="8-week">8-week</option><option value="16-week">16-week</option></select></Field>
              <Field label="Projection Years"><NumInput value={inputs.projectionYears} onChange={v => update('projectionYears', Math.max(1, v))} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Start FY"><NumInput value={inputs.startFY} onChange={v => update('startFY', v)} /></Field>
              <Field label="# Programs"><NumInput value={inputs.numberOfPrograms} onChange={v => update('numberOfPrograms', Math.max(1, v))} /></Field>
              <Field label="Summer"><button onClick={() => update('includeSummer', !inputs.includeSummer)} className={cn('w-full px-2 py-1.5 text-sm rounded border transition-colors', inputs.includeSummer ? 'bg-[var(--color-accent-primary)]/20 border-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)]')}>{inputs.includeSummer ? 'Yes' : 'No'}</button></Field>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">{spy} sessions/year ({inputs.deliveryFormat === '8-week' ? 'A+B per semester' : '1 per semester'}){inputs.numberOfPrograms > 1 ? ` | ${inputs.numberOfPrograms} programs (fixed OH shared)` : ''}</p>
          </Section>

          <Section title="Enrollment & Growth" icon={Users}>
            <Field label="Initial Fall-1 Intake (per program)"><NumInput value={inputs.initialIntake} onChange={v => update('initialIntake', v)} suffix="students" /></Field>
            <div className="mt-2">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">Term-over-Term Growth (%)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>
                    <th className="px-1 py-1 text-left text-[var(--color-text-muted)]">Year</th>
                    <th className="px-1 py-1 text-right text-[var(--color-text-muted)]">All</th>
                    <th className="px-1 py-1 text-right text-[var(--color-text-muted)]">Fall</th>
                    <th className="px-1 py-1 text-right text-[var(--color-text-muted)]">Spring</th>
                    {inputs.includeSummer && <th className="px-1 py-1 text-right text-[var(--color-text-muted)]">Summer</th>}
                  </tr></thead>
                  <tbody>
                    {inputs.growthByYear.map((yr, i) => {
                      const allVal = getYearAll(yr)
                      return (
                        <tr key={i} className={i % 2 ? 'bg-[var(--color-bg-elevated)]/30' : ''}>
                          <td className="px-1 py-1 text-[var(--color-text-secondary)] whitespace-nowrap">Yr {i + 1}</td>
                          <td className="px-1 py-1"><input type="number" value={allVal ?? ''} placeholder="--" step={1} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setYearAllGrowth(i, v) }} className="w-full px-1 py-0.5 text-xs text-right bg-[var(--color-accent-primary)]/10 border border-[var(--color-accent-primary)]/30 rounded text-white placeholder:text-[var(--color-text-muted)]" /></td>
                          <td className="px-1 py-1"><input type="number" value={Math.round(yr.fall * 100)} step={1} onChange={e => updateGrowth(i, 'fall', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-white" /></td>
                          <td className="px-1 py-1"><input type="number" value={Math.round(yr.spring * 100)} step={1} onChange={e => updateGrowth(i, 'spring', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-white" /></td>
                          {inputs.includeSummer && <td className="px-1 py-1"><input type="number" value={Math.round(yr.summer * 100)} step={1} onChange={e => updateGrowth(i, 'summer', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-white" /></td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Set "All" to fill every term. For 8-week, A+B sessions use the same semester rate.</p>
            </div>
          </Section>

          <Section title="Retention" icon={GraduationCap}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Early Retention %"><NumInput value={Math.round(inputs.earlyRetentionRate * 100)} onChange={v => update('earlyRetentionRate', v / 100)} suffix="%" /></Field>
              <Field label="Late Retention %"><NumInput value={Math.round(inputs.lateRetentionRate * 100)} onChange={v => update('lateRetentionRate', v / 100)} suffix="%" /></Field>
            </div>
            <Field label="Switch After Session"><NumInput value={inputs.retentionThresholdTerm} onChange={v => update('retentionThresholdTerm', v)} /></Field>
          </Section>

          <Section title="Course Development" icon={Settings}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Courses to Develop"><NumInput value={inputs.coursesToDevelop} onChange={v => update('coursesToDevelop', v)} /></Field>
              <Field label="Dev Cost/Course"><NumInput value={inputs.devCostPerCourse} onChange={v => update('devCostPerCourse', v)} prefix="$" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Courses to Revise"><NumInput value={inputs.coursesToRevise} onChange={v => update('coursesToRevise', v)} /></Field>
              <Field label="Revision Cost %"><NumInput value={Math.round(inputs.revisionCostPct * 100)} onChange={v => update('revisionCostPct', v / 100)} suffix="%" /></Field>
            </div>
            <Field label="Amortise Over (sessions)"><NumInput value={inputs.devAmortizationTerms} onChange={v => update('devAmortizationTerms', Math.max(1, v))} /></Field>
          </Section>

          <Section title="Tuition & Revenue" icon={DollarSign}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tuition/Credit"><NumInput value={inputs.tuitionPerCredit} onChange={v => update('tuitionPerCredit', v)} prefix="$" /></Field>
              <Field label="Credits/Session"><NumInput value={inputs.creditsPerSession} onChange={v => update('creditsPerSession', v)} /></Field>
            </div>
            <Field label="Tuition Inflation/yr"><NumInput value={Math.round(inputs.tuitionInflationPct * 1000) / 10} onChange={v => update('tuitionInflationPct', v / 100)} step={0.5} suffix="%" /></Field>
            <p className="text-[10px] text-[var(--color-text-muted)]">Revenue/student/session: {fmtCur(inputs.tuitionPerCredit * inputs.creditsPerSession)}</p>
          </Section>

          <Section title="Faculty & TA" icon={Building2}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faculty $/Section"><NumInput value={inputs.facultyCostPerSection} onChange={v => update('facultyCostPerSection', v)} prefix="$" /></Field>
              <Field label="Max Students/Section" hint="Auto-scales"><NumInput value={inputs.maxStudentsPerSection} onChange={v => update('maxStudentsPerSection', Math.max(1, v))} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="TA:Student"><NumInput value={inputs.taStudentRatio} onChange={v => update('taStudentRatio', v)} /></Field>
              <Field label="TA $/hr"><NumInput value={inputs.taHourlyRate} onChange={v => update('taHourlyRate', v)} prefix="$" /></Field>
              <Field label="TA hrs/wk"><NumInput value={inputs.taHoursPerWeek} onChange={v => update('taHoursPerWeek', v)} /></Field>
            </div>
            <Field label="Weeks/Session"><NumInput value={inputs.weeksPerSession} onChange={v => update('weeksPerSession', v)} /></Field>
          </Section>

          <Section title="Overhead & Marketing" icon={Wallet}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Variable OH/Student"><NumInput value={inputs.variableOverheadPerStudent} onChange={v => update('variableOverheadPerStudent', v)} prefix="$" /></Field>
              <Field label="Fixed OH/Semester" hint="Shared across programs, split across sessions"><NumInput value={inputs.fixedOverheadPerTerm} onChange={v => update('fixedOverheadPerTerm', v)} prefix="$" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CAC/Student"><NumInput value={inputs.cacPerStudent} onChange={v => update('cacPerStudent', v)} prefix="$" /></Field>
              <Field label="Cost Inflation/yr"><NumInput value={Math.round(inputs.costInflationPct * 100)} onChange={v => update('costInflationPct', v / 100)} suffix="%" /></Field>
            </div>
          </Section>

          <GlassCard padding="sm">
            <div className="flex items-center gap-2">
              <input value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder="Scenario name..." className="flex-1 px-2 py-1.5 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-white focus:outline-none" />
              <button onClick={() => { const n = scenarioName.trim() || inputs.programName; setScenarios(p => [...p, { name: n, inputs: { ...inputs }, results }]); setScenarioName('') }} className="px-3 py-1.5 text-sm bg-[var(--color-accent-primary)] text-white rounded hover:bg-[var(--color-accent-primary)]/80 transition-colors">Save</button>
            </div>
            {scenarios.length > 0 && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Saved: {scenarios.map(s => s.name).join(', ')}</p>}
          </GlassCard>
        </div>

        {/* ─── Results ─── */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-1 bg-[var(--color-bg-elevated)] p-1 rounded-lg">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all flex-1 justify-center',
                  activeTab === tab.id ? 'bg-[var(--color-bg-surface)] text-white border border-[var(--color-border-subtle)]' : 'text-[var(--color-text-muted)] hover:text-white')}>
                <tab.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          {activeTab === 'summary' && <ExecSummary results={results} />}
          {activeTab === 'cohorts' && <CohortTab results={results} />}
          {activeTab === 'detail' && <DetailTab results={results} />}
          {activeTab === 'compare' && <CompareTab scenarios={scenarios} onDelete={(i) => setScenarios(prev => prev.filter((_, idx) => idx !== i))} />}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════ TABS ═════════════════════════════════════════

function ExecSummary({ results }: { results: ScenarioResults }) {
  const fy = results.plSummary.filter(r => r.fiscalYear !== 'Total')
  const cd = fy.map(r => ({ fy: r.fiscalYear, Revenue: r.revenue, Cost: r.cost, Cumulative: r.cumulative, Margin: r.netMarginPct, Headcount: r.headcount }))
  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-sm font-semibold text-white mb-3">Profit & Loss Summary</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-[var(--color-accent-primary)]">{['Fiscal Year', 'Revenue', 'Cost', 'Net', 'Cumulative', 'Margin', 'Headcount'].map(h => <th key={h} className="px-3 py-2 text-white font-medium text-right first:text-left">{h}</th>)}</tr></thead>
          <tbody>{results.plSummary.map((r, i) => {
            const t = r.fiscalYear === 'Total'
            return (<tr key={r.fiscalYear} className={cn(t ? 'font-bold bg-[var(--color-bg-elevated)]' : i % 2 ? 'bg-[var(--color-bg-elevated)]/50' : '')}>
              <td className="px-3 py-2 text-white">{r.fiscalYear}</td>
              <td className="px-3 py-2 text-right text-white">{fmtCur(r.revenue)}</td>
              <td className="px-3 py-2 text-right text-white">{fmtCur(r.cost)}</td>
              <td className={cn('px-3 py-2 text-right', r.net >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>{fmtCur(r.net)}</td>
              <td className={cn('px-3 py-2 text-right', r.cumulative >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>{fmtCur(r.cumulative)}</td>
              <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{r.netMarginPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right text-white">{t ? `${r.headcount} (peak)` : r.headcount}</td>
            </tr>)
          })}</tbody>
        </table></div>
      </GlassCard>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Revenue vs Cost</h3>
          <ResponsiveContainer width="100%" height={250}><BarChart data={cd}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="fy" tick={{ fill: '#7F7F7F', fontSize: 11 }} /><YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip formatter={(v: number) => fmtCur(v)} contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Legend /><Bar dataKey="Revenue" fill="#A32638" radius={[4, 4, 0, 0]} /><Bar dataKey="Cost" fill="#363D45" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </GlassCard>
        <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Cumulative Net P&L</h3>
          <ResponsiveContainer width="100%" height={250}><AreaChart data={cd}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="fy" tick={{ fill: '#7F7F7F', fontSize: 11 }} /><YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip formatter={(v: number) => fmtCur(v)} contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#A32638" stopOpacity={0.3} /><stop offset="95%" stopColor="#A32638" stopOpacity={0} /></linearGradient></defs><Area dataKey="Cumulative" stroke="#A32638" fill="url(#cg)" strokeWidth={2} /></AreaChart></ResponsiveContainer>
        </GlassCard>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Total Headcount by Fiscal Year</h3>
          <ResponsiveContainer width="100%" height={220}><BarChart data={cd}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="fy" tick={{ fill: '#7F7F7F', fontSize: 11 }} /><YAxis tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Bar dataKey="Headcount" fill="#A32638" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </GlassCard>
        <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Net Margin % Trend</h3>
          <ResponsiveContainer width="100%" height={220}><LineChart data={cd}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="fy" tick={{ fill: '#7F7F7F', fontSize: 11 }} /><YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Line dataKey="Margin" stroke="#A32638" strokeWidth={2} dot={{ fill: '#A32638', r: 4 }} /></LineChart></ResponsiveContainer>
        </GlassCard>
      </div>
    </div>
  )
}

function CohortTab({ results }: { results: ScenarioResults }) {
  const ad = results.termLabels.map((l, i) => ({
    term: l,
    'Total Active': Math.round(results.totalActive[i]),
    'New Students': Math.round(results.newStudents[i]),
    Graduating: Math.round(results.graduates[i]),
  }))
  return (
    <div className="space-y-4">
      <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Students per Session</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={ad} barGap={0} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="term" tick={{ fill: '#7F7F7F', fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fill: '#7F7F7F', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="New Students" fill="#363D45" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Total Active" fill="#A32638" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Graduating" fill="#2E7D32" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>
      <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Session Detail</h3>
        <div className="overflow-x-auto text-xs"><table className="w-full">
          <thead><tr className="bg-[var(--color-accent-primary)]">
            {['Session', 'New Students', 'Total Active', 'Graduating'].map(h => (
              <th key={h} className="px-3 py-1.5 text-white font-medium text-right first:text-left">{h}</th>
            ))}
          </tr></thead>
          <tbody>{ad.map((r, i) => (
            <tr key={r.term} className={i % 2 ? 'bg-[var(--color-bg-elevated)]/50' : ''}>
              <td className="px-3 py-1 text-[var(--color-text-secondary)]">{r.term}</td>
              <td className="px-3 py-1 text-right text-white">{r['New Students']}</td>
              <td className="px-3 py-1 text-right text-white">{r['Total Active']}</td>
              <td className="px-3 py-1 text-right text-[var(--color-success)]">{r.Graduating > 0 ? r.Graduating : ''}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </GlassCard>
    </div>
  )
}

function DetailTab({ results }: { results: ScenarioResults }) {
  const ccd = results.costRows.map(r => ({ term: r.term, Faculty: r.faculty, TA: r.ta, 'Course Dev': r.courseDev, 'Variable OH': r.variableOH, 'Fixed OH': r.fixedOH, CAC: r.cac }))
  const rvc = results.termLabels.map((l, i) => ({ term: l, Revenue: results.revenueRows[i].revenue, Cost: results.costRows[i].totalCost }))
  return (
    <div className="space-y-4">
      <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Revenue per Session</h3>
        <div className="overflow-x-auto text-xs"><table className="w-full"><thead><tr className="bg-[var(--color-accent-primary)]">{['Session', 'Students', '$/Credit', 'Credits', 'Revenue'].map(h => <th key={h} className="px-3 py-1.5 text-white font-medium text-right first:text-left">{h}</th>)}</tr></thead>
        <tbody>{results.revenueRows.map((r, i) => <tr key={r.term} className={i % 2 ? 'bg-[var(--color-bg-elevated)]/50' : ''}><td className="px-3 py-1 text-[var(--color-text-secondary)]">{r.term}</td><td className="px-3 py-1 text-right text-white">{Math.round(r.activeStudents)}</td><td className="px-3 py-1 text-right text-white">{fmtCur(r.tuitionPerCredit)}</td><td className="px-3 py-1 text-right text-white">{r.creditsPerSession}</td><td className="px-3 py-1 text-right text-white font-medium">{fmtCur(r.revenue)}</td></tr>)}</tbody></table></div>
      </GlassCard>
      <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Cost Breakdown per Session</h3>
        <div className="overflow-x-auto text-xs"><table className="w-full"><thead><tr className="bg-[var(--color-accent-primary)]">{['Session', 'Faculty', 'TA', 'Dev', 'Var OH', 'Fix OH', 'CAC', 'Total'].map(h => <th key={h} className="px-2 py-1.5 text-white font-medium text-right first:text-left">{h}</th>)}</tr></thead>
        <tbody>{results.costRows.map((r, i) => <tr key={r.term} className={i % 2 ? 'bg-[var(--color-bg-elevated)]/50' : ''}><td className="px-2 py-1 text-[var(--color-text-secondary)]">{r.term}</td><td className="px-2 py-1 text-right text-white">{fmtCur(r.faculty)}</td><td className="px-2 py-1 text-right text-white">{fmtCur(r.ta)}</td><td className="px-2 py-1 text-right text-white">{fmtCur(r.courseDev)}</td><td className="px-2 py-1 text-right text-white">{fmtCur(r.variableOH)}</td><td className="px-2 py-1 text-right text-white">{fmtCur(r.fixedOH)}</td><td className="px-2 py-1 text-right text-white">{fmtCur(r.cac)}</td><td className="px-2 py-1 text-right text-white font-medium">{fmtCur(r.totalCost)}</td></tr>)}</tbody></table></div>
      </GlassCard>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Cost Components</h3>
          <ResponsiveContainer width="100%" height={280}><BarChart data={ccd}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="term" tick={{ fill: '#7F7F7F', fontSize: 8 }} angle={-45} textAnchor="end" height={60} /><YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip formatter={(v: number) => fmtCur(v)} contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Legend /><Bar dataKey="Faculty" stackId="a" fill="#A32638" /><Bar dataKey="TA" stackId="a" fill="#363D45" /><Bar dataKey="Course Dev" stackId="a" fill="#7F7F7F" /><Bar dataKey="Variable OH" stackId="a" fill="#5A6577" /><Bar dataKey="Fixed OH" stackId="a" fill="#E4E5E6" /><Bar dataKey="CAC" stackId="a" fill="#2E7D32" /></BarChart></ResponsiveContainer>
        </GlassCard>
        <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Revenue vs Cost</h3>
          <ResponsiveContainer width="100%" height={280}><LineChart data={rvc}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="term" tick={{ fill: '#7F7F7F', fontSize: 8 }} angle={-45} textAnchor="end" height={60} /><YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip formatter={(v: number) => fmtCur(v)} contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Legend /><Line dataKey="Revenue" stroke="#A32638" strokeWidth={2} dot={{ fill: '#A32638', r: 3 }} /><Line dataKey="Cost" stroke="#363D45" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#363D45', r: 3 }} /></LineChart></ResponsiveContainer>
        </GlassCard>
      </div>
    </div>
  )
}

function CompareTab({ scenarios, onDelete }: { scenarios: SavedScenario[]; onDelete: (index: number) => void }) {
  if (scenarios.length < 2) return <GlassCard><div className="text-center py-12"><TrendingUp className="h-12 w-12 text-[var(--color-text-muted)] mx-auto mb-3" /><p className="text-[var(--color-text-muted)]">Save at least 2 scenarios to compare.</p></div></GlassCard>

  const fy = scenarios[0].results.plSummary.filter(r => r.fiscalYear !== 'Total')
  const plData = fy.map((r, i) => {
    const p: Record<string, unknown> = { fy: r.fiscalYear }
    scenarios.forEach(s => { p[`${s.name}`] = s.results.plSummary[i]?.cumulative ?? 0 })
    return p
  })
  const hcData = fy.map((r, i) => {
    const p: Record<string, unknown> = { fy: r.fiscalYear }
    scenarios.forEach(s => { p[`${s.name}`] = s.results.plSummary[i]?.headcount ?? 0 })
    return p
  })
  const cols = ['#A32638', '#00d084', '#3b82f6', '#ffb800']

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-4', scenarios.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {scenarios.slice(0, 3).map((sc, si) => (
          <GlassCard key={sc.name} padding="sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">{sc.name}</h4>
              <button onClick={() => onDelete(si)} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors" title="Delete scenario"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-1 text-xs">
              {[
                ['Revenue', fmtCur(sc.results.totalRevenue), 'text-white'],
                ['Cost', fmtCur(sc.results.totalCost), 'text-white'],
                ['Net', fmtCur(sc.results.totalNet), sc.results.totalNet >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'],
                ['Margin', `${sc.results.totalMarginPct.toFixed(1)}%`, 'text-white'],
                ['Break-Even', sc.results.breakEvenYear ?? 'N/A', 'text-white'],
                ['Peak Headcount', String(sc.results.plSummary.find(r => r.fiscalYear === 'Total')?.headcount ?? 0), 'text-white'],
              ].map(([l, v, c]) => <div key={l} className="flex justify-between"><span className="text-[var(--color-text-muted)]">{l}</span><span className={c as string}>{v}</span></div>)}
            </div>
          </GlassCard>
        ))}
      </div>
      <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Cumulative P&L Comparison</h3>
        <ResponsiveContainer width="100%" height={300}><LineChart data={plData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="fy" tick={{ fill: '#7F7F7F', fontSize: 11 }} /><YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip formatter={(v: number) => fmtCur(v)} contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Legend />
          {scenarios.slice(0, 3).map((sc, i) => <Line key={sc.name} dataKey={sc.name} stroke={cols[i]} strokeWidth={2} dot={{ r: 3 }} />)}
        </LineChart></ResponsiveContainer>
      </GlassCard>
      <GlassCard><h3 className="text-sm font-semibold text-white mb-3">Headcount Comparison by FY</h3>
        <ResponsiveContainer width="100%" height={250}><BarChart data={hcData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="fy" tick={{ fill: '#7F7F7F', fontSize: 11 }} /><YAxis tick={{ fill: '#7F7F7F', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Legend />
          {scenarios.slice(0, 3).map((sc, i) => <Bar key={sc.name} dataKey={sc.name} fill={cols[i]} radius={[4, 4, 0, 0]} />)}
        </BarChart></ResponsiveContainer>
      </GlassCard>
    </div>
  )
}
