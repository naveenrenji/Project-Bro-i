/**
 * Executive-quality PDF report for Program Financial Estimation.
 *
 * Two modes: "quick" (3 pages) and "full" (6-7 pages).
 * Optional AI-enhanced mode adds an AI Analysis page.
 *
 * Design: DARK theme – black background, Stevens CPE brand colours,
 * white text, clean tables, simple bar/line charts drawn with jsPDF primitives.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CPE_LOGO_DARK_PNG } from './logo-data'
import type { FinancialInputs, ScenarioResults } from './financial-engine'

// ── Brand colours (RGB) ───────────────────────────────────────────────
const RED:     [number, number, number] = [163, 38, 56]
const DGRAY:   [number, number, number] = [54, 61, 69]
const GRAY:    [number, number, number] = [127, 127, 127]
const LGRAY:   [number, number, number] = [228, 229, 230]
const WHITE:   [number, number, number] = [255, 255, 255]
const BLACK:   [number, number, number] = [0, 0, 0]
const GREEN:   [number, number, number] = [46, 125, 50]

// Dark-theme surface colours
const SURFACE: [number, number, number] = [30, 33, 40]   // elevated bg (alt rows, KPI boxes)
const DARK_ELEVATED: [number, number, number] = [22, 24, 30] // deeper bg

// ── Formatting ────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v < 0) return `($${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })})`
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtShort(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return fmt(v)
}

// ── Page helpers ──────────────────────────────────────────────────────

const PW = 215.9  // letter width mm
const PH = 279.4  // letter height mm
const ML = 18     // margin left
const MR = 18     // margin right
const CW = PW - ML - MR  // content width

/** Fill entire page with black background */
function darkBg(doc: jsPDF) {
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, PW, PH, 'F')
}

function pageHeader(doc: jsPDF) {
  doc.setFillColor(...RED)
  doc.rect(0, 0, PW, 3, 'F')
}

function pageFooter(doc: jsPDF, num: number, total: number) {
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Stevens Institute of Technology  |  College of Professional Education', ML, PH - 10)
  doc.text(`${num} / ${total}`, PW - MR, PH - 10, { align: 'right' })
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(title, ML, y)
  doc.setDrawColor(...RED)
  doc.setLineWidth(0.5)
  doc.line(ML, y + 2, ML + CW, y + 2)
  doc.setFont('helvetica', 'normal')
  return y + 9
}

// ── KPI box (dark theme) ──────────────────────────────────────────────

function kpiBox(doc: jsPDF, x: number, y: number, w: number, h: number,
  label: string, value: string, accent: [number, number, number]) {
  // Dark elevated background
  doc.setFillColor(...SURFACE)
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F')
  // Accent left bar
  doc.setFillColor(...accent)
  doc.roundedRect(x, y, 2.5, h, 1, 1, 'F')
  // Label
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(label.toUpperCase(), x + 7, y + 6)
  // Value
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(value, x + 7, y + 15)
  doc.setFont('helvetica', 'normal')
}

// ── Bar chart (dark theme) ────────────────────────────────────────────

function barChart(doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; a: number; b: number }[], legendA: string, legendB: string) {
  const plotH = h - 18
  const plotW = w - 25
  const maxVal = Math.max(...data.flatMap(d => [d.a, d.b]), 1)
  const gw = plotW / data.length
  const bw = gw * 0.28

  // Gridlines
  doc.setDrawColor(...DGRAY)
  doc.setLineWidth(0.15)
  for (let i = 0; i <= 4; i++) {
    const ly = y + plotH - (plotH * i / 4)
    doc.line(x + 24, ly, x + w, ly)
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    doc.text(fmtShort(maxVal * i / 4), x + 22, ly + 1.5, { align: 'right' })
  }

  // Bars
  data.forEach((d, i) => {
    const cx = x + 25 + i * gw + gw / 2
    const aH = (d.a / maxVal) * plotH
    const bH = (d.b / maxVal) * plotH
    doc.setFillColor(...RED)
    doc.rect(cx - bw - 1, y + plotH - aH, bw, aH, 'F')
    doc.setFillColor(...LGRAY)
    doc.rect(cx + 1, y + plotH - bH, bw, bH, 'F')
    doc.setFontSize(6)
    doc.setTextColor(...LGRAY)
    doc.text(d.label, cx, y + plotH + 5, { align: 'center' })
  })

  // Legend
  const ly = y + h - 5
  doc.setFillColor(...RED)
  doc.rect(x + w - 55, ly, 4, 3, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...LGRAY)
  doc.text(legendA, x + w - 49, ly + 2.5)
  doc.setFillColor(...LGRAY)
  doc.rect(x + w - 25, ly, 4, 3, 'F')
  doc.text(legendB, x + w - 19, ly + 2.5)
}

// ── Line chart (dark theme) ───────────────────────────────────────────

function lineChart(doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; value: number }[], colour: [number, number, number]) {
  const plotH = h - 18
  const plotW = w - 25
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const minVal = Math.min(...data.map(d => d.value), 0)
  const range = maxVal - minVal || 1

  // Gridlines
  doc.setDrawColor(...DGRAY)
  doc.setLineWidth(0.15)
  for (let i = 0; i <= 4; i++) {
    const ly = y + plotH - (plotH * i / 4)
    doc.line(x + 24, ly, x + w, ly)
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    doc.text(fmtShort(minVal + range * i / 4), x + 22, ly + 1.5, { align: 'right' })
  }

  // Zero line if needed
  if (minVal < 0) {
    const zy = y + plotH - (plotH * (-minVal) / range)
    doc.setDrawColor(...GRAY)
    doc.setLineWidth(0.3)
    doc.line(x + 24, zy, x + w, zy)
  }

  // Points
  const pts = data.map((d, i) => ({
    px: x + 25 + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2),
    py: y + plotH - (plotH * (d.value - minVal) / range),
  }))

  // Line
  doc.setDrawColor(...colour)
  doc.setLineWidth(0.8)
  for (let i = 1; i < pts.length; i++) {
    doc.line(pts[i - 1].px, pts[i - 1].py, pts[i].px, pts[i].py)
  }

  // Dots + labels
  pts.forEach((p, i) => {
    doc.setFillColor(...colour)
    doc.circle(p.px, p.py, 1.2, 'F')
    doc.setFontSize(6)
    doc.setTextColor(...LGRAY)
    doc.text(data[i].label, p.px, y + plotH + 5, { align: 'center' })
  })
}

// ── Asterism gesture (brand element, Section 2.4) ─────────────────────

function drawAsterism(doc: jsPDF, cx: number, cy: number, size: number) {
  doc.setDrawColor(...DGRAY)
  doc.setLineWidth(0.3)
  // 0 degree ray (horizontal)
  doc.line(cx, cy, cx + size, cy)
  // 25 degree ray
  const rad25 = (25 * Math.PI) / 180
  doc.line(cx, cy, cx + size * Math.cos(rad25), cy - size * Math.sin(rad25))
  // -25 degree ray
  doc.line(cx, cy, cx + size * Math.cos(-rad25), cy - size * Math.sin(-rad25))
  // 90 degree ray (shorter, upward)
  doc.line(cx, cy, cx, cy - size * 0.6)
}

// ═══════════════════════ PAGES ════════════════════════════════════════

function coverPage(doc: jsPDF, inp: FinancialInputs, res: ScenarioResults, title: string) {
  darkBg(doc)

  // Full-width red bar
  doc.setFillColor(...RED)
  doc.rect(0, 0, PW, 10, 'F')

  // Logo (below the red bar, left-aligned)
  try {
    doc.addImage(CPE_LOGO_DARK_PNG, 'PNG', ML, 16, 110, 0)
  } catch { /* logo optional */ }

  // Program title – positioned below logo with clear space
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(title, ML, 65)

  // Subtitle
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...LGRAY)
  doc.text('Program Financial Estimation', ML, 77)

  // Divider
  doc.setDrawColor(...DGRAY)
  doc.setLineWidth(0.3)
  doc.line(ML, 83, ML + CW, 83)

  // Info line
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  const fy0 = inp.startFY
  doc.text([
    `${inp.projectionYears}-Year Outlook: FY${fy0} - FY${fy0 + inp.projectionYears - 1}`,
    `${inp.deliveryFormat} delivery  |  ${inp.numberOfPrograms} program${inp.numberOfPrograms > 1 ? 's' : ''}`,
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - Naveen Mathews Renji`,
  ].join('     '), ML, 89)

  // KPIs
  const ky = 103
  const kw = (CW - 12) / 4
  kpiBox(doc, ML, ky, kw, 20, 'Total Revenue', fmt(res.totalRevenue), RED)
  kpiBox(doc, ML + kw + 4, ky, kw, 20, 'Total Cost', fmt(res.totalCost), DGRAY)
  kpiBox(doc, ML + (kw + 4) * 2, ky, kw, 20, 'Net P&L', fmt(res.totalNet), res.totalNet >= 0 ? GREEN : RED)
  kpiBox(doc, ML + (kw + 4) * 3, ky, kw, 20, 'Break-Even', res.breakEvenYear ?? 'N/A', res.breakEvenYear ? GREEN : GRAY)

  // Executive narrative
  const be = res.breakEvenYear ?? 'beyond the projection'
  const narrative = `This program is projected to generate ${fmt(res.totalRevenue)} in total revenue against ${fmt(res.totalCost)} in costs over ${inp.projectionYears} years, yielding a net of ${fmt(res.totalNet)} (${res.totalMarginPct.toFixed(1)}% margin). Break-even is reached in ${be}. The model assumes an initial cohort of ${inp.initialIntake} students at $${inp.tuitionPerCredit.toLocaleString()}/credit.`

  doc.setFontSize(10)
  doc.setTextColor(...LGRAY)
  doc.text(narrative, ML, 135, { maxWidth: CW })

  // Key assumptions (compact 2-column)
  const ay = 159
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('Key Assumptions', ML, ay)
  doc.setFont('helvetica', 'normal')

  const params: [string, string][] = [
    ['Initial Intake', `${inp.initialIntake} students`],
    ['Tuition/Credit', `$${inp.tuitionPerCredit.toLocaleString()}`],
    ['Credits/Session', String(inp.creditsPerSession)],
    ['Delivery', inp.deliveryFormat],
    ['Early Retention', `${Math.round(inp.earlyRetentionRate * 100)}%`],
    ['Late Retention', `${Math.round(inp.lateRetentionRate * 100)}%`],
    ['Faculty/Section', `$${inp.facultyCostPerSection.toLocaleString()}`],
    ['CAC/Student', `$${inp.cacPerStudent.toLocaleString()}`],
    ['Fixed OH/Semester', `$${inp.fixedOverheadPerTerm.toLocaleString()}`],
    ['Cost Inflation', `${Math.round(inp.costInflationPct * 100)}%/yr`],
  ]

  doc.setFontSize(8)
  params.forEach(([label, val], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const ax = ML + col * (CW / 2)
    const ry = ay + 5 + row * 5
    doc.setTextColor(...GRAY)
    doc.text(label, ax, ry)
    doc.setTextColor(...WHITE)
    doc.text(val, ax + 38, ry)
  })

  // Asterism in bottom-right for brand feel
  drawAsterism(doc, PW - 60, PH - 50, 45)

  // Bottom footer
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Stevens Institute of Technology  |  College of Professional Education', PW / 2, PH - 15, { align: 'center' })
}

// ── Dark autoTable defaults ───────────────────────────────────────────

function darkTableDefaults() {
  return {
    theme: 'grid' as const,
    headStyles: {
      fillColor: RED as [number, number, number],
      textColor: WHITE as [number, number, number],
      fontStyle: 'bold' as const,
    },
    bodyStyles: {
      textColor: LGRAY as [number, number, number],
      fillColor: BLACK as [number, number, number],
    },
    alternateRowStyles: {
      fillColor: SURFACE as [number, number, number],
    },
    tableLineColor: DGRAY as [number, number, number],
    tableLineWidth: 0.15,
  }
}

function plPage(doc: jsPDF, res: ScenarioResults) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  let y = sectionTitle(doc, 'Profit & Loss Summary', 14)

  // Table
  autoTable(doc, {
    head: [['Fiscal Year', 'Revenue', 'Cost', 'Net', 'Cumulative', 'Margin']],
    body: res.plSummary.map(r => [
      r.fiscalYear, fmt(r.revenue), fmt(r.cost), fmt(r.net), fmt(r.cumulative), `${r.netMarginPct.toFixed(1)}%`,
    ]),
    startY: y,
    ...darkTableDefaults(),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { ...darkTableDefaults().headStyles, halign: 'center' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'right' }, 2: { halign: 'right' },
      3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === res.plSummary.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = DGRAY
        data.cell.styles.textColor = WHITE
      }
      if ((data.column.index === 3 || data.column.index === 4) && data.section === 'body') {
        const row = res.plSummary[data.row.index]
        const val = data.column.index === 3 ? row?.net : row?.cumulative
        if (val !== undefined && val < 0) data.cell.styles.textColor = RED
      }
    },
  })

  // Charts
  const fy = res.plSummary.filter(r => r.fiscalYear !== 'Total')
  const tableEnd = (doc as any).lastAutoTable?.finalY ?? 80

  const chartY = tableEnd + 10
  if (chartY + 55 < PH - 25) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...WHITE)
    doc.text('Revenue vs Cost by Fiscal Year', ML, chartY)
    doc.setFont('helvetica', 'normal')
    barChart(doc, ML - 3, chartY + 3, CW + 3, 55,
      fy.map(r => ({ label: r.fiscalYear, a: r.revenue, b: r.cost })),
      'Revenue', 'Cost')
  }

  const lineY = chartY + 65
  if (lineY + 50 < PH - 25) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...WHITE)
    doc.text('Cumulative Net P&L', ML, lineY)
    doc.setFont('helvetica', 'normal')
    lineChart(doc, ML - 3, lineY + 3, CW + 3, 50,
      fy.map(r => ({ label: r.fiscalYear, value: r.cumulative })), RED)
  }
}

function enrollmentPage(doc: jsPDF, res: ScenarioResults) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  let y = sectionTitle(doc, 'Enrollment Trajectory', 14)

  // Show ALL sessions — autoTable handles page breaks automatically
  const allRows = res.termLabels.map((lbl, i) => ({ lbl, ns: res.newStudents[i], ta: res.totalActive[i] }))

  // Use willDrawCell to paint the dark background on overflow pages BEFORE
  // any cell content is drawn (jsPDF is painter's model: last draw wins).
  let lastPage = doc.getNumberOfPages()

  autoTable(doc, {
    head: [['Session', 'New Students', 'Total Active']],
    body: allRows.map(r => [r.lbl, Math.round(r.ns).toString(), Math.round(r.ta).toString()]),
    startY: y,
    ...darkTableDefaults(),
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' } },
    showHead: 'everyPage',
    margin: { top: 14 }, // leave room for pageHeader on overflow pages
    willDrawCell: (data) => {
      const curPage = doc.getNumberOfPages()
      if (curPage !== lastPage) {
        // New page — paint dark bg + header BEFORE any cells are drawn
        darkBg(doc)
        pageHeader(doc)
        lastPage = curPage
      }
    },
  })

  // Line chart – sample for readability if many sessions
  const tableEnd = (doc as any).lastAutoTable?.finalY ?? 100
  const chartY = tableEnd + 8
  if (chartY + 50 < PH - 25) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...WHITE)
    doc.text('Total Active Students Over Time', ML, chartY)
    doc.setFont('helvetica', 'normal')
    const chartStep = Math.max(1, Math.floor(allRows.length / 15))
    const chartSubset = allRows.filter((_, i) => i % chartStep === 0 || i === allRows.length - 1)
    lineChart(doc, ML - 3, chartY + 3, CW + 3, 48,
      chartSubset.map(r => ({ label: r.lbl, value: r.ta })), RED)
  }
}

function revenueDetailPage(doc: jsPDF, res: ScenarioResults) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  sectionTitle(doc, 'Revenue Detail', 14)
  autoTable(doc, {
    head: [['Session', 'Students', '$/Credit', 'Credits', 'Revenue']],
    body: res.revenueRows.map(r => [
      r.term, Math.round(r.activeStudents).toString(), fmt(r.tuitionPerCredit),
      r.creditsPerSession.toString(), fmt(r.revenue),
    ]),
    startY: 22,
    ...darkTableDefaults(),
    styles: { fontSize: 7, cellPadding: 1.8 },
    headStyles: { ...darkTableDefaults().headStyles, fontSize: 8 },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })
}

function costDetailPage(doc: jsPDF, res: ScenarioResults) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  sectionTitle(doc, 'Cost Breakdown', 14)
  autoTable(doc, {
    head: [['Session', 'Faculty', 'TA', 'Dev', 'Var OH', 'Fix OH', 'CAC', 'Total']],
    body: res.costRows.map(r => [
      r.term, fmt(r.faculty), fmt(r.ta), fmt(r.courseDev),
      fmt(r.variableOH), fmt(r.fixedOH), fmt(r.cac), fmt(r.totalCost),
    ]),
    startY: 22,
    ...darkTableDefaults(),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { ...darkTableDefaults().headStyles, fontSize: 7 },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } },
  })
}

function assumptionsPage(doc: jsPDF, inp: FinancialInputs) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  let y = sectionTitle(doc, 'Complete Assumptions', 14)

  const sections: [string, [string, string][]][] = [
    ['Program Structure', [
      ['Program Name', inp.programName],
      ['Total Courses', String(inp.totalCourses)],
      ['Credits/Course', String(inp.creditsPerCourse)],
      ['Delivery Format', inp.deliveryFormat],
      ['Include Summer', inp.includeSummer ? 'Yes' : 'No'],
      ['Projection Years', String(inp.projectionYears)],
      ['# Programs', String(inp.numberOfPrograms)],
    ]],
    ['Enrollment', [
      ['Initial Intake', String(inp.initialIntake)],
      ...inp.growthByYear.flatMap((yr, i): [string, string][] => [
        [`Year ${i + 1} Fall`, `${Math.round(yr.fall * 100)}%`],
        [`Year ${i + 1} Spring`, `${Math.round(yr.spring * 100)}%`],
        ...(inp.includeSummer ? [[`Year ${i + 1} Summer`, `${Math.round(yr.summer * 100)}%`] as [string, string]] : []),
      ]),
      ['Early Retention', `${Math.round(inp.earlyRetentionRate * 100)}%`],
      ['Late Retention', `${Math.round(inp.lateRetentionRate * 100)}%`],
    ]],
    ['Revenue', [
      ['Tuition/Credit', `$${inp.tuitionPerCredit.toLocaleString()}`],
      ['Credits/Session', String(inp.creditsPerSession)],
      ['Tuition Inflation', `${(inp.tuitionInflationPct * 100).toFixed(1)}%/yr`],
    ]],
    ['Costs', [
      ['Faculty/Section', `$${inp.facultyCostPerSection.toLocaleString()}`],
      ['Max Students/Section', String(inp.maxStudentsPerSection)],
      ['TA Ratio', `1:${inp.taStudentRatio}`],
      ['TA Rate', `$${inp.taHourlyRate}/hr`],
      ['Variable OH/Student', `$${inp.variableOverheadPerStudent}`],
      ['Fixed OH/Semester', `$${inp.fixedOverheadPerTerm.toLocaleString()}`],
      ['CAC/Student', `$${inp.cacPerStudent.toLocaleString()}`],
      ['Cost Inflation', `${Math.round(inp.costInflationPct * 100)}%/yr`],
    ]],
    ['Course Development', [
      ['New Courses', String(inp.coursesToDevelop)],
      ['Dev Cost/Course', `$${inp.devCostPerCourse.toLocaleString()}`],
      ['Courses to Revise', String(inp.coursesToRevise)],
      ['Revision %', `${Math.round(inp.revisionCostPct * 100)}%`],
      ['Amort. Sessions', String(inp.devAmortizationTerms)],
    ]],
  ]

  for (const [name, params] of sections) {
    if (y > PH - 40) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 14 }
    doc.setFillColor(...DGRAY)
    doc.rect(ML, y - 3.5, CW, 5.5, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...WHITE)
    doc.text(name, ML + 2, y)
    doc.setFont('helvetica', 'normal')
    y += 5
    doc.setFontSize(8)
    for (const [label, value] of params) {
      if (y > PH - 20) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 14 }
      doc.setTextColor(...GRAY)
      doc.text(label, ML + 4, y)
      doc.setTextColor(...WHITE)
      doc.text(value, ML + 55, y)
      y += 4
    }
    y += 3
  }
}

// ── AI Analysis page ──────────────────────────────────────────────────

export interface AIContent {
  narrative: string
  risks: string[]
  opportunities: string[]
  recommendation: string
}

function aiAnalysisPage(doc: jsPDF, ai: AIContent) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  let y = sectionTitle(doc, 'AI-Generated Analysis', 14)

  // Narrative
  doc.setFontSize(10)
  doc.setTextColor(...LGRAY)
  const lines = doc.splitTextToSize(ai.narrative, CW)
  doc.text(lines, ML, y)
  y += lines.length * 4.5 + 6

  // Risks
  if (y > PH - 60) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 14 }
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...RED)
  doc.text('Key Risks', ML, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(...LGRAY)
  for (const risk of ai.risks) {
    const rLines = doc.splitTextToSize(`  -  ${risk}`, CW - 5)
    doc.text(rLines, ML, y)
    y += rLines.length * 4 + 2
  }
  y += 4

  // Opportunities
  if (y > PH - 60) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 14 }
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GREEN)
  doc.text('Key Opportunities', ML, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(...LGRAY)
  for (const opp of ai.opportunities) {
    const oLines = doc.splitTextToSize(`  -  ${opp}`, CW - 5)
    doc.text(oLines, ML, y)
    y += oLines.length * 4 + 2
  }
  y += 6

  // Recommendation
  if (y > PH - 40) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 14 }
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('Recommendation', ML, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.setFontSize(10)
  doc.setTextColor(...LGRAY)
  const recLines = doc.splitTextToSize(ai.recommendation, CW)
  doc.text(recLines, ML, y)
}

// ═══════════════════════ PUBLIC API ═══════════════════════════════════

export function generatePDF(
  inputs: FinancialInputs,
  results: ScenarioResults,
  mode: 'quick' | 'full' = 'quick',
  reportTitle?: string,
  aiContent?: AIContent,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const title = reportTitle || inputs.programName

  coverPage(doc, inputs, results, title)

  if (aiContent) {
    aiAnalysisPage(doc, aiContent)
  }

  plPage(doc, results)
  enrollmentPage(doc, results)

  if (mode === 'full') {
    revenueDetailPage(doc, results)
    costDetailPage(doc, results)
    assumptionsPage(doc, inputs)
  }

  // Footers on all pages
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    pageFooter(doc, i, total)
  }

  const suffix = aiContent ? '_AI_Summary' : mode === 'full' ? '_Full_Report' : '_Summary'
  doc.save(`${title.replace(/\s+/g, '_')}${suffix}.pdf`)
}
