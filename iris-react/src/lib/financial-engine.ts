/**
 * Financial Estimation Engine – pure TypeScript computation.
 *
 * Session-aware: 8-week mode treats each 8-week block as its own term
 * (Fall-A, Fall-B, Spring-A, Spring-B, Summer-A, Summer-B = 6/year).
 * 16-week mode keeps semesters (Fall, Spring, Summer = 3/year).
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface YearGrowthRates {
  fall: number
  spring: number
  summer: number
  /** 8-week only: optional per-session rates; when set, override fall/spring/summer for that session */
  fallA?: number
  fallB?: number
  springA?: number
  springB?: number
  summerA?: number
  summerB?: number
}

export interface FinancialInputs {
  programName: string
  totalCourses: number
  creditsPerCourse: number
  deliveryFormat: '8-week' | '16-week'
  includeSummer: boolean
  projectionYears: number
  startFY: number
  numberOfPrograms: number

  coursesToDevelop: number
  devCostPerCourse: number
  coursesToRevise: number
  revisionCostPct: number
  devAmortizationTerms: number

  initialIntake: number
  growthByYear: YearGrowthRates[]

  earlyRetentionRate: number
  lateRetentionRate: number
  retentionThresholdTerm: number
  graduationCurve: number[] | null

  tuitionPerCredit: number
  creditsPerSession: number   // per 8-week session or per 16-week semester
  tuitionInflationPct: number

  facultyCostPerSection: number
  maxStudentsPerSection: number
  taStudentRatio: number
  taHourlyRate: number
  taHoursPerWeek: number
  weeksPerSession: number

  variableOverheadPerStudent: number
  fixedOverheadPerTerm: number  // per semester, NOT per session
  cacPerStudent: number
  costInflationPct: number
}

export interface CohortRow {
  label: string
  initialIntake: number
  activeByTerm: number[]
  graduatedByTerm: number[]
}

export interface RevenueRow {
  term: string
  activeStudents: number
  tuitionPerCredit: number
  creditsPerSession: number
  baseRevenue: number
  revenue: number
}

export interface CostRow {
  term: string
  faculty: number
  ta: number
  courseDev: number
  variableOH: number
  fixedOH: number
  cac: number
  baseTotal: number
  totalCost: number
}

export interface PLRow {
  fiscalYear: string
  revenue: number
  cost: number
  net: number
  cumulative: number
  netMarginPct: number
  headcount: number  // total active students in the fiscal year (peak across sessions)
}

export interface ScenarioResults {
  cohortMatrix: CohortRow[]
  termLabels: string[]
  totalActive: number[]
  newStudents: number[]
  graduates: number[]     // students graduating at end of each session
  revenueRows: RevenueRow[]
  costRows: CostRow[]
  plSummary: PLRow[]
  breakEvenYear: string | null
  totalRevenue: number
  totalCost: number
  totalNet: number
  totalMarginPct: number
  programTerms: number
  graduationCurve: number[]
  sessionsPerYear: number
}

// ─── Defaults ────────────────────────────────────────────────────────

export function buildDefaultGrowthByYear(years: number, includeSummer: boolean): YearGrowthRates[] {
  const rates: YearGrowthRates[] = []
  for (let y = 0; y < years; y++) {
    rates.push(getDefaultGrowthRow(y, '16-week', includeSummer))
  }
  return rates
}

/** Default growth row for one year. Used for initial load and when adding new years in 8-week mode. */
export function getDefaultGrowthRow(
  yearIndex: number,
  deliveryFormat: '8-week' | '16-week',
  includeSummer: boolean,
): YearGrowthRates {
  if (deliveryFormat === '8-week') {
    // New years (e.g. when user adds projection years) get Yr 5-style rates
    const row: YearGrowthRates = {
      fall: 1.3,
      spring: 1.2,
      summer: includeSummer ? 1.1 : 0,
      fallA: 1.3,
      fallB: -0.5,
      springA: 1.2,
      springB: -0.5,
    }
    if (includeSummer) {
      row.summerA = 1.1
      row.summerB = -0.5
    }
    return row
  }
  return {
    fall: yearIndex === 0 ? 0 : 0.25,
    spring: 0.01,
    summer: includeSummer ? 0.01 : 0,
  }
}

export function getDefaultInputs(): FinancialInputs {
  return {
    programName: 'New Graduate Program',
    totalCourses: 10,
    creditsPerCourse: 3,
    deliveryFormat: '8-week',
    includeSummer: true,
    projectionYears: 5,
    startFY: 2026,
    numberOfPrograms: 1,

    coursesToDevelop: 10,
    devCostPerCourse: 60_000,
    coursesToRevise: 0,
    revisionCostPct: 0.30,
    devAmortizationTerms: 2,

    initialIntake: 17,
    growthByYear: [
      { fall: 0.01, spring: 1.2, summer: 1.1, fallA: 0.01, fallB: -0.5, springA: 1.2, springB: -0.5, summerA: 1.1, summerB: -0.5 },
      { fall: 1.2, spring: 1.1, summer: 1.1, fallA: 1.2, fallB: -0.5, springA: 1.1, springB: -0.5, summerA: 1.1, summerB: -0.5 },
      { fall: 1.3, spring: 1.2, summer: 1.1, fallA: 1.3, fallB: -0.5, springA: 1.2, springB: -0.5, summerA: 1.1, summerB: -0.5 },
      { fall: 1.3, spring: 1.2, summer: 1.1, fallA: 1.3, fallB: -0.5, springA: 1.2, springB: -0.5, summerA: 1.1, summerB: -0.5 },
      { fall: 1.3, spring: 1.2, summer: 1.1, fallA: 1.3, fallB: -0.5, springA: 1.2, springB: -0.5, summerA: 1.1, summerB: -0.5 },
    ],

    earlyRetentionRate: 0.90,
    lateRetentionRate: 0.95,
    retentionThresholdTerm: 4,
    graduationCurve: null,

    tuitionPerCredit: 800,
    creditsPerSession: 3,
    tuitionInflationPct: 0.0,

    facultyCostPerSection: 12_000,
    maxStudentsPerSection: 100,
    taStudentRatio: 30,
    taHourlyRate: 21,
    taHoursPerWeek: 20,
    weeksPerSession: 8,

    variableOverheadPerStudent: 50,
    fixedOverheadPerTerm: 50_000,
    cacPerStudent: 3000,
    costInflationPct: 0.07,
  }
}

// ─── Session / Term Helpers ──────────────────────────────────────────

/** Number of billing periods (sessions) per year */
export function sessionsPerYear(inp: FinancialInputs): number {
  const semesters = inp.includeSummer ? 3 : 2
  const perSem = inp.deliveryFormat === '8-week' ? 2 : 1
  return semesters * perSem
}

/** Session labels within one year */
function sessionNames(inp: FinancialInputs): string[] {
  const base = inp.includeSummer ? ['Fall', 'Spring', 'Summer'] : ['Fall', 'Spring']
  if (inp.deliveryFormat === '8-week') {
    return base.flatMap(s => [`${s}-A`, `${s}-B`])
  }
  return base
}

/** Which semester does session index belong to? Returns 'Fall'|'Spring'|'Summer' */
function getSemesterType(sessionIndex: number, inp: FinancialInputs): string {
  const spy = sessionsPerYear(inp)
  const posInYear = sessionIndex % spy
  const semesters = inp.includeSummer ? ['Fall', 'Spring', 'Summer'] : ['Fall', 'Spring']
  const perSem = inp.deliveryFormat === '8-week' ? 2 : 1
  const semIdx = Math.floor(posInYear / perSem)
  return semesters[semIdx] ?? semesters[semesters.length - 1]
}

/** Session keys for 8-week A/B (in order: Fall-A, Fall-B, Spring-A, Spring-B, Summer-A, Summer-B when summer included). Export for UI/export. */
export const SESSION_GROWTH_KEYS: (keyof YearGrowthRates)[] = ['fallA', 'fallB', 'springA', 'springB', 'summerA', 'summerB']

/** Growth rate for a given calendar session. In 8-week mode uses A/B rates when defined, else semester rate. */
function getGrowthRateForSession(sessionIndex: number, inp: FinancialInputs): number {
  const spy = sessionsPerYear(inp)
  const yr = getYearIndex(sessionIndex, inp)
  const yearRates = inp.growthByYear[yr] ?? inp.growthByYear[inp.growthByYear.length - 1]
  if (!yearRates) return 0

  if (inp.deliveryFormat === '16-week') {
    const semType = getSemesterType(sessionIndex, inp)
    if (semType === 'Fall') return yearRates.fall ?? 0
    if (semType === 'Spring') return yearRates.spring ?? 0
    return yearRates.summer ?? 0
  }

  // 8-week: posInYear 0=Fall-A, 1=Fall-B, 2=Spring-A, 3=Spring-B, 4=Summer-A, 5=Summer-B
  const posInYear = sessionIndex % spy
  const keysForYear = inp.includeSummer ? SESSION_GROWTH_KEYS : (SESSION_GROWTH_KEYS as (keyof YearGrowthRates)[]).slice(0, 4)
  const key = keysForYear[posInYear]
  const abRate = key != null ? yearRates[key] : undefined
  if (typeof abRate === 'number') return abRate
  // Fallback to semester rate
  const semType = getSemesterType(sessionIndex, inp)
  if (semType === 'Fall') return yearRates.fall ?? 0
  if (semType === 'Spring') return yearRates.spring ?? 0
  return yearRates.summer ?? 0
}

export function generateTermLabels(inp: FinancialInputs): string[] {
  const names = sessionNames(inp)
  const spy = sessionsPerYear(inp)
  const labels: string[] = []
  for (let y = 1; y <= inp.projectionYears; y++) {
    for (let s = 0; s < spy; s++) {
      labels.push(`${names[s]}-${y}`)
    }
  }
  return labels
}

function getYearIndex(sessionIndex: number, inp: FinancialInputs): number {
  return Math.floor(sessionIndex / sessionsPerYear(inp))
}

export function programDurationTerms(inp: FinancialInputs): number {
  const totalCredits = inp.totalCourses * inp.creditsPerCourse
  const cps = inp.creditsPerSession
  return cps > 0 ? Math.max(1, Math.ceil(totalCredits / cps)) : 1
}

/** How many sessions in one semester (1 for 16-week, 2 for 8-week) */
function sessionsPerSemester(inp: FinancialInputs): number {
  return inp.deliveryFormat === '8-week' ? 2 : 1
}

// ─── Graduation Curve ────────────────────────────────────────────────

/**
 * Credit-based cliff graduation: all surviving students graduate at exactly
 * the session when they have accumulated enough credits.
 *
 * progTerms = ceil(totalProgramCredits / creditsPerSession)
 *
 * The returned cumulative curve is 0 for every session before progTerms,
 * then jumps to 1.0 at progTerms (the "cliff").
 */
export function generateDefaultGraduationCurve(progTerms: number): number[] {
  const curve = new Array(progTerms).fill(0)
  curve[progTerms - 1] = 1.0
  return curve
}

function getGraduationCurve(inp: FinancialInputs): number[] {
  if (inp.graduationCurve && inp.graduationCurve.length > 0) {
    return [...inp.graduationCurve]
  }
  return generateDefaultGraduationCurve(programDurationTerms(inp))
}

// ─── Cohort Intakes ──────────────────────────────────────────────────

function computeCohortIntakes(inp: FinancialInputs): number[] {
  const spy = sessionsPerYear(inp)
  const n = inp.projectionYears * spy
  const intakes = new Array(n).fill(0)
  intakes[0] = inp.initialIntake

  for (let t = 1; t < n; t++) {
    const rate = getGrowthRateForSession(t, inp)
    intakes[t] = intakes[t - 1] * (1 + rate)
  }
  return intakes
}

// ─── Single Cohort Lifecycle ─────────────────────────────────────────

interface CohortLifecycle {
  active: number[]      // active[t] = students enrolled in session t
  graduated: number[]   // graduated[t] = students who complete the program at end of session t
}

function computeSingleCohort(
  initial: number,
  gradCurve: number[],
  inp: FinancialInputs,
  maxTerms: number,
): CohortLifecycle {
  const active = new Array(maxTerms).fill(0)
  const graduated = new Array(maxTerms).fill(0)
  active[0] = initial

  for (let t = 1; t < maxTerms; t++) {
    const retention = t < inp.retentionThresholdTerm
      ? inp.earlyRetentionRate
      : inp.lateRetentionRate

    const cumNow = (t - 1) < gradCurve.length ? gradCurve[t - 1] : 1.0
    const cumPrev = (t - 2) >= 0 && (t - 2) < gradCurve.length ? gradCurve[t - 2] : 0.0
    const curveGrads = Math.max(0, (cumNow - cumPrev) * initial)

    // Actual graduates = min(curve says, students still active)
    const actualGrads = Math.min(curveGrads, active[t - 1])
    graduated[t - 1] = Math.round(actualGrads * 100) / 100  // grads leave at end of session t-1

    const afterGrad = Math.max(0, active[t - 1] - actualGrads)
    active[t] = Math.max(0, afterGrad * retention)
  }
  return { active, graduated }
}

// ─── Full Cohort Matrix ──────────────────────────────────────────────

function computeCohortMatrix(inp: FinancialInputs) {
  const spy = sessionsPerYear(inp)
  const nCal = inp.projectionYears * spy
  const progTerms = programDurationTerms(inp)
  const gradCurve = getGraduationCurve(inp)
  const maxActive = gradCurve.length + 1  // +1 so the loop reaches the final curve index where graduation happens
  const intakes = computeCohortIntakes(inp)
  const labels = generateTermLabels(inp)

  const cohorts: CohortRow[] = []
  for (let c = 0; c < nCal; c++) {
    const lifecycle = computeSingleCohort(intakes[c], gradCurve, inp, maxActive)
    cohorts.push({
      label: labels[c],
      initialIntake: Math.round(intakes[c] * 100) / 100,
      activeByTerm: lifecycle.active,
      graduatedByTerm: lifecycle.graduated,
    })
  }
  return { cohorts, intakes, gradCurve, progTerms }
}

// ─── Active per Calendar Session ─────────────────────────────────────

function computeActivePerSession(cohorts: CohortRow[]) {
  const nCal = cohorts.length
  const maxInternal = cohorts[0]?.activeByTerm.length ?? 0
  const totalActive = new Array(nCal).fill(0)
  const totalGraduating = new Array(nCal).fill(0)
  const newStudents = cohorts.map(c => c.initialIntake)

  for (let t = 0; t < nCal; t++) {
    for (let c = 0; c < nCal; c++) {
      const internal = t - c
      if (internal >= 0 && internal < maxInternal) {
        totalActive[t] += cohorts[c].activeByTerm[internal]
        totalGraduating[t] += cohorts[c].graduatedByTerm[internal]
      }
    }
  }
  return { totalActive, newStudents, totalGraduating }
}

// ─── Revenue ─────────────────────────────────────────────────────────

function computeRevenue(totalActive: number[], inp: FinancialInputs): RevenueRow[] {
  const spy = sessionsPerYear(inp)
  const n = inp.projectionYears * spy
  const labels = generateTermLabels(inp)
  const rows: RevenueRow[] = []
  const N = inp.numberOfPrograms || 1

  for (let t = 0; t < n; t++) {
    const yr = getYearIndex(t, inp)
    const mult = Math.pow(1 + inp.tuitionInflationPct, yr)
    const stu = Math.round(totalActive[t] * 100) / 100 * N
    const base = stu * inp.tuitionPerCredit * inp.creditsPerSession
    rows.push({
      term: labels[t],
      activeStudents: Math.round(stu * 100) / 100,
      tuitionPerCredit: Math.round(inp.tuitionPerCredit * mult * 100) / 100,
      creditsPerSession: inp.creditsPerSession,
      baseRevenue: Math.round(base * 100) / 100,
      revenue: Math.round(base * mult * 100) / 100,
    })
  }
  return rows
}

// ─── Costs ───────────────────────────────────────────────────────────

function computeCosts(totalActive: number[], newStudents: number[], inp: FinancialInputs): CostRow[] {
  const spy = sessionsPerYear(inp)
  const n = inp.projectionYears * spy
  const labels = generateTermLabels(inp)
  const N = inp.numberOfPrograms || 1
  const weeks = inp.weeksPerSession

  // TA cost per student per session
  const taConst = inp.taStudentRatio > 0
    ? (inp.taHourlyRate * inp.taHoursPerWeek * weeks) / inp.taStudentRatio
    : 0

  // Course dev amortisation
  const totalDev = inp.coursesToDevelop * inp.devCostPerCourse
  const totalRev = inp.coursesToRevise * inp.devCostPerCourse * inp.revisionCostPct
  const totalCourse = (totalDev + totalRev) * N
  const amort = Math.max(inp.devAmortizationTerms, 1)
  const amortPer = totalCourse / amort

  // Fixed OH: specified per semester. For 8-week, split across 2 sessions.
  const fixOHperSession = inp.fixedOverheadPerTerm / sessionsPerSemester(inp)

  const rows: CostRow[] = []
  for (let t = 0; t < n; t++) {
    const yr = getYearIndex(t, inp)
    const mult = Math.pow(1 + inp.costInflationPct, yr)
    const stu = Math.round(totalActive[t] * 100) / 100 * N
    const newStu = Math.round(newStudents[t] * 100) / 100 * N

    const sectionsNeeded = inp.maxStudentsPerSection > 0
      ? Math.max(1, Math.ceil(stu / inp.maxStudentsPerSection))
      : 1
    const faculty = inp.facultyCostPerSection * sectionsNeeded
    const ta = stu * taConst
    const courseDev = t < amort ? amortPer : 0
    const varOH = stu * inp.variableOverheadPerStudent
    const cac = newStu * inp.cacPerStudent
    const base = faculty + ta + courseDev + varOH + fixOHperSession + cac

    rows.push({
      term: labels[t],
      faculty: Math.round(faculty * mult * 100) / 100,
      ta: Math.round(ta * mult * 100) / 100,
      courseDev: Math.round(courseDev * mult * 100) / 100,
      variableOH: Math.round(varOH * mult * 100) / 100,
      fixedOH: Math.round(fixOHperSession * mult * 100) / 100,
      cac: Math.round(cac * mult * 100) / 100,
      baseTotal: Math.round(base * 100) / 100,
      totalCost: Math.round(base * mult * 100) / 100,
    })
  }
  return rows
}

// ─── P&L Summary (aggregated by fiscal year) ─────────────────────────

function computePLSummary(revenueRows: RevenueRow[], costRows: CostRow[], totalActive: number[], inp: FinancialInputs): PLRow[] {
  const spy = sessionsPerYear(inp)
  const start = inp.startFY
  const rows: PLRow[] = []
  let cumulative = 0

  for (let y = 0; y < inp.projectionYears; y++) {
    const s = y * spy
    const e = s + spy
    let rev = 0, cost = 0, peakHC = 0
    for (let t = s; t < e; t++) {
      rev += revenueRows[t].revenue
      cost += costRows[t].totalCost
      peakHC = Math.max(peakHC, Math.round(totalActive[t]))
    }
    const net = rev - cost
    cumulative += net
    const margin = rev > 0 ? (net / rev) * 100 : 0
    rows.push({
      fiscalYear: `FY${start + y}`,
      revenue: Math.round(rev * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      net: Math.round(net * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
      netMarginPct: Math.round(margin * 100) / 100,
      headcount: peakHC,
    })
  }

  const totalRev = rows.reduce((s, r) => s + r.revenue, 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalNet = totalRev - totalCost
  const totalMargin = totalRev > 0 ? (totalNet / totalRev) * 100 : 0
  const maxHC = rows.reduce((m, r) => Math.max(m, r.headcount), 0)
  rows.push({
    fiscalYear: 'Total',
    revenue: Math.round(totalRev * 100) / 100,
    cost: Math.round(totalCost * 100) / 100,
    net: Math.round(totalNet * 100) / 100,
    cumulative: Math.round(cumulative * 100) / 100,
    netMarginPct: Math.round(totalMargin * 100) / 100,
    headcount: maxHC,
  })
  return rows
}

function findBreakEvenYear(pl: PLRow[]): string | null {
  for (const row of pl) {
    if (row.fiscalYear === 'Total') continue
    if (row.cumulative >= 0) return row.fiscalYear
  }
  return null
}

// ─── Scenario Orchestrator ───────────────────────────────────────────

export function computeScenario(inp: FinancialInputs): ScenarioResults {
  const { cohorts, gradCurve, progTerms } = computeCohortMatrix(inp)
  const { totalActive, newStudents, totalGraduating } = computeActivePerSession(cohorts)
  const revenueRows = computeRevenue(totalActive, inp)
  const costRows = computeCosts(totalActive, newStudents, inp)
  const plSummary = computePLSummary(revenueRows, costRows, totalActive, inp)
  const be = findBreakEvenYear(plSummary)
  const totals = plSummary[plSummary.length - 1]

  return {
    cohortMatrix: cohorts,
    termLabels: generateTermLabels(inp),
    totalActive,
    newStudents,
    graduates: totalGraduating,
    revenueRows,
    costRows,
    plSummary,
    breakEvenYear: be,
    totalRevenue: totals.revenue,
    totalCost: totals.cost,
    totalNet: totals.net,
    totalMarginPct: totals.netMarginPct,
    programTerms: progTerms,
    graduationCurve: gradCurve,
    sessionsPerYear: sessionsPerYear(inp),
  }
}
