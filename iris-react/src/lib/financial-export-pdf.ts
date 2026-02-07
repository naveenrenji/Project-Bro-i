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
import { SESSION_GROWTH_KEYS } from './financial-engine'

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

// ── Diagram drawing helpers (for methodology PDF) ────────────────────

type RGB = [number, number, number]

/** Rounded box with centred text, used as a flowchart node */
function drawBox(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  label: string, fill: RGB, border: RGB, textCol: RGB, fontSize = 8,
) {
  doc.setFillColor(...fill)
  doc.setDrawColor(...border)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  doc.setFontSize(fontSize)
  doc.setTextColor(...textCol)
  const lines = doc.splitTextToSize(label, w - 6) as string[]
  const lineH = fontSize * 0.42
  const totalH = lines.length * lineH
  const startY = y + (h - totalH) / 2 + lineH - 0.5
  lines.forEach((line: string, i: number) => {
    doc.text(line, x + w / 2, startY + i * lineH, { align: 'center' })
  })
}

/** Vertical arrow from bottom of one box to top of another */
function arrowV(doc: jsPDF, x: number, y1: number, y2: number, color: RGB) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.5)
  doc.line(x, y1, x, y2)
  // arrowhead
  const dir = y2 > y1 ? 1 : -1
  doc.setFillColor(...color)
  doc.triangle(x, y2, x - 1.5, y2 - 3 * dir, x + 1.5, y2 - 3 * dir, 'F')
}

/** Horizontal arrow */
function arrowH(doc: jsPDF, x1: number, x2: number, y: number, color: RGB) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.5)
  doc.line(x1, y, x2, y)
  const dir = x2 > x1 ? 1 : -1
  doc.setFillColor(...color)
  doc.triangle(x2, y, x2 - 3 * dir, y - 1.5, x2 - 3 * dir, y + 1.5, 'F')
}

/** Dashed vertical arrow (for dropout branches) */
function dashedArrowV(doc: jsPDF, x: number, y1: number, y2: number, color: RGB) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.3)
  const step = 2
  let cy = y1
  while (cy < y2 - step) {
    doc.line(x, cy, x, Math.min(cy + step, y2))
    cy += step * 2
  }
  doc.setFillColor(...color)
  doc.triangle(x, y2, x - 1.2, y2 - 2.5, x + 1.2, y2 - 2.5, 'F')
}

/** Small label text */
function smallLabel(doc: jsPDF, text: string, x: number, y: number, color: RGB, align: 'left' | 'center' | 'right' = 'center') {
  doc.setFontSize(7)
  doc.setTextColor(...color)
  doc.text(text, x, y, { align })
}

/** Pipeline stage box: rect + title band + content lines with consistent spacing */
function pipelineStageBox(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  title: string, lines: string[], fill: RGB, border: RGB,
) {
  doc.setFillColor(...fill)
  doc.setDrawColor(...border)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  const titleY = y + 7
  const lineH = 5
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(title, x + w / 2, titleY, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...LGRAY)
  lines.forEach((line, i) => {
    doc.text(line, x + w / 2, titleY + 6 + (i + 1) * lineH, { align: 'center' })
  })
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
      ...inp.growthByYear.flatMap((yr, i): [string, string][] => {
        const sessionKeys = inp.deliveryFormat === '8-week' ? (inp.includeSummer ? SESSION_GROWTH_KEYS : SESSION_GROWTH_KEYS.slice(0, 4)) : null
        const hasAB = sessionKeys?.some(k => typeof yr[k] === 'number')
        if (inp.deliveryFormat === '8-week' && sessionKeys && hasAB) {
          const sessionLabel = (k: typeof sessionKeys[number]) => { const sem = k.startsWith('fall') ? 'Fall' : k.startsWith('spring') ? 'Spring' : 'Summer'; const ab = k.endsWith('A') ? 'A' : 'B'; return `${sem}-${ab}` }
          return sessionKeys.map(k => {
            const v = typeof yr[k] === 'number' ? yr[k]! : (k.startsWith('fall') ? yr.fall : k.startsWith('spring') ? yr.spring : yr.summer)
            return [`Year ${i + 1} ${sessionLabel(k)}`, `${Math.round(v * 100)}%`]
          })
        }
        return [
          [`Year ${i + 1} Fall`, `${Math.round(yr.fall * 100)}%`],
          [`Year ${i + 1} Spring`, `${Math.round(yr.spring * 100)}%`],
          ...(inp.includeSummer ? [[`Year ${i + 1} Summer`, `${Math.round(yr.summer * 100)}%`] as [string, string]] : []),
        ]
      }),
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

// ═══════════════════════ METHODOLOGY PDF ═════════════════════════════

function methodologyCover(doc: jsPDF) {
  darkBg(doc)
  doc.setFillColor(...RED)
  doc.rect(0, 0, PW, 10, 'F')
  try { doc.addImage(CPE_LOGO_DARK_PNG, 'PNG', ML, 16, 110, 0) } catch { /* optional */ }
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('P&L Calculation Methodology', ML, 65)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...LGRAY)
  doc.text('How the Financial Model Works', ML, 77)
  doc.setDrawColor(...DGRAY)
  doc.setLineWidth(0.3)
  doc.line(ML, 83, ML + CW, 83)
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - Naveen Mathews Renji`,
    ML, 89,
  )

  // Brief description
  doc.setFontSize(10)
  doc.setTextColor(...LGRAY)
  doc.text(
    'This document explains the complete computation pipeline used by the Program Financial Estimation tool. ' +
    'It covers how student enrollment is projected, how retention and graduation are modeled, and how revenue ' +
    'and costs are calculated to produce the P&L forecast.',
    ML, 103, { maxWidth: CW },
  )

  drawAsterism(doc, PW - 60, PH - 50, 45)
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Stevens Institute of Technology  |  College of Professional Education', PW / 2, PH - 15, { align: 'center' })
}

function pipelinePage(doc: jsPDF) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  let y = sectionTitle(doc, '1. Computation Pipeline', 14)

  doc.setFontSize(9)
  doc.setTextColor(...LGRAY)
  doc.text(
    'The engine processes inputs through five sequential stages. Each stage feeds into the next.',
    ML, y, { maxWidth: CW },
  )
  y += 12

  // Dimensions: centered boxes, consistent spacing
  const bw = Math.min(CW * 0.62, 165)   // box width, cap for readability
  const bh = 30                          // box height (title band + 3–4 lines)
  const gap = 14                          // vertical gap between stages
  const bx = ML + (CW - bw) / 2          // centre x on page

  // Stage 1: Program Structure
  const s1y = y
  pipelineStageBox(doc, bx, s1y, bw, bh, '1. Program Structure', [
    'Total Credits = Courses x Credits/Course',
    'Sessions to Graduate = ceil(Total Credits / Credits per Session)',
    'Sessions/Year: 6 (8-week) or 3 (16-week)',
  ], SURFACE, DGRAY)
  arrowV(doc, bx + bw / 2, s1y + bh, s1y + bh + gap, RED)

  // Stage 2: Enrollment Forecast
  const s2y = s1y + bh + gap
  pipelineStageBox(doc, bx, s2y, bw, bh, '2. Enrollment Forecast', [
    'Start with initial cohort size',
    'Each session: new intake = previous x (1 + growth rate)',
    'Growth rates vary by semester: Fall, Spring, Summer',
    'In 8-week format, each session (Fall-A, Fall-B, …) can have its own rate.',
  ], SURFACE, DGRAY)
  arrowV(doc, bx + bw / 2, s2y + bh, s2y + bh + gap, RED)

  // Stage 3: Student Lifecycle (4 lines)
  const s3y = s2y + bh + gap
  const s3h = 34
  pipelineStageBox(doc, bx, s3y, bw, s3h, '3. Student Lifecycle (per Cohort)', [
    'Each session: remove graduates, then apply retention',
    'active[t] = (active[t-1] - graduates) x retention_rate',
    'Cliff graduation: all survivors graduate at calculated session',
  ], SURFACE, DGRAY)
  arrowV(doc, bx + bw / 2, s3y + s3h, s3y + s3h + gap, RED)

  // Stage 4: Aggregate
  const s4y = s3y + s3h + gap
  pipelineStageBox(doc, bx, s4y, bw, bh, '4. Aggregate Across All Cohorts', [
    'Total Active[t] = Sum of all overlapping cohorts at session t',
    'New Students[t] = Fresh cohort intake at session t',
    'Graduating[t] = Sum of all cohort graduates at session t',
  ], SURFACE, DGRAY)
  arrowV(doc, bx + bw / 2, s4y + bh, s4y + bh + gap, RED)

  // Stage 5: Financial Output
  const s5y = s4y + bh + gap
  pipelineStageBox(doc, bx, s5y, bw, bh, '5. Financial Output', [
    'Revenue per Session = Active x Tuition/Credit x Credits/Session',
    'Cost per Session = Faculty + TA + Dev + OH + CAC',
    'Net P&L per FY = Sum(Revenue) - Sum(Cost)  |  Break-Even = first FY cumulative >= 0',
  ], SURFACE, DGRAY)
}

function lifecyclePage(doc: jsPDF) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  let y = sectionTitle(doc, '2. Student Lifecycle — Single Cohort', 14)

  doc.setFontSize(9)
  doc.setTextColor(...LGRAY)
  doc.text(
    'Each cohort starts with N students. Every session, retention is applied (students drop out). ' +
    'At the calculated graduation session, all surviving students graduate and active count drops to zero.',
    ML, y, { maxWidth: CW },
  )
  y += 14

  // Horizontal lifecycle flow
  const boxW = 24
  const boxH = 16
  const arrowGap = 4
  const startX = ML + 2
  const flowY = y

  // Box: New Cohort
  drawBox(doc, startX, flowY, boxW + 4, boxH, 'New Cohort\nN students', DARK_ELEVATED, LGRAY, WHITE, 7)
  arrowH(doc, startX + boxW + 4, startX + boxW + 4 + arrowGap, flowY + boxH / 2, RED)

  // Box: Session 0
  const s0x = startX + boxW + 4 + arrowGap
  drawBox(doc, s0x, flowY, boxW, boxH, 'Session 0\nN active', SURFACE, DGRAY, WHITE, 7)

  // Early retention arrow + box
  const retEX = s0x + boxW + arrowGap - 1
  smallLabel(doc, 'x Early Retention', s0x + boxW + arrowGap / 2 + 8, flowY - 2, GRAY)
  arrowH(doc, s0x + boxW, retEX + 2, flowY + boxH / 2, RED)
  const s1x = retEX + 2
  drawBox(doc, s1x, flowY, boxW + 2, boxH, 'Session 1\n...', SURFACE, DGRAY, WHITE, 7)

  // Threshold marker
  const thX = s1x + boxW + 2 + arrowGap - 1
  smallLabel(doc, 'x Early/Late', s1x + boxW + 2 + arrowGap / 2 + 6, flowY - 2, GRAY)
  arrowH(doc, s1x + boxW + 2, thX + 2, flowY + boxH / 2, RED)
  const sMidX = thX + 2
  drawBox(doc, sMidX, flowY, boxW + 4, boxH, 'Sessions\n2 ... T-1', SURFACE, DGRAY, WHITE, 7)

  // Late retention arrow + grad session
  const gradArrX = sMidX + boxW + 4 + arrowGap - 1
  smallLabel(doc, 'x Late Retention', sMidX + boxW + 4 + arrowGap / 2 + 10, flowY - 2, GRAY)
  arrowH(doc, sMidX + boxW + 4, gradArrX + 2, flowY + boxH / 2, RED)
  const gradX = gradArrX + 2
  drawBox(doc, gradX, flowY, boxW + 6, boxH, 'Graduation\nSession T', [163, 38, 56], RED, WHITE, 7)

  // Arrow to "0"
  arrowH(doc, gradX + boxW + 6, gradX + boxW + 6 + arrowGap + 2, flowY + boxH / 2, GRAY)
  drawBox(doc, gradX + boxW + 6 + arrowGap + 2, flowY, boxW - 6, boxH, 'Active\n= 0', DARK_ELEVATED, DGRAY, LGRAY, 7)

  // Dropout arrows (dashed, going down)
  const dropY = flowY + boxH + 18
  const dropBoxH = 12

  dashedArrowV(doc, s0x + boxW / 2, flowY + boxH, flowY + boxH + 6, GRAY)
  drawBox(doc, s0x - 2, dropY - 8, boxW + 4, dropBoxH, 'Dropouts', DARK_ELEVATED, GRAY, GRAY, 7)

  dashedArrowV(doc, s1x + (boxW + 2) / 2, flowY + boxH, flowY + boxH + 6, GRAY)
  drawBox(doc, s1x - 1, dropY - 8, boxW + 4, dropBoxH, 'Dropouts', DARK_ELEVATED, GRAY, GRAY, 7)

  dashedArrowV(doc, sMidX + (boxW + 4) / 2, flowY + boxH, flowY + boxH + 6, GRAY)
  drawBox(doc, sMidX, dropY - 8, boxW + 4, dropBoxH, 'Dropouts', DARK_ELEVATED, GRAY, GRAY, 7)

  // "All survivors graduate" label
  smallLabel(doc, 'All survivors graduate', gradX + (boxW + 6) / 2, flowY + boxH + 6, GREEN, 'center')

  // Formula section
  y = dropY + dropBoxH + 12

  doc.setFillColor(...SURFACE)
  doc.roundedRect(ML, y, CW, 72, 2, 2, 'F')
  y += 6

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('Key Formulas', ML + 6, y)
  doc.setFont('helvetica', 'normal')
  y += 8

  const formulas = [
    ['Program Duration', 'Sessions to Graduate = ceil( Total Courses x Credits/Course  /  Credits per Session )'],
    ['Sessions per Year', '8-week: Semesters x 2  |  16-week: Semesters x 1  (Semesters = 3 with summer, 2 without)'],
    ['Graduation Curve', 'Cumulative curve is 0 for all sessions, then jumps to 1.0 at the graduation session (cliff)'],
    ['Active Students', 'active[t] = ( active[t-1]  -  graduates )  x  retention_rate'],
    ['Retention Rate', 'Early rate for sessions 1 .. (threshold - 1),  Late rate for sessions threshold onward'],
    ['Graduates', 'At cliff session: graduates = min( expected_grads,  active students remaining )'],
    ['Total Active', 'Total Active[t] = Sum of active[internal_session] across all overlapping cohorts at calendar session t'],
    ['New Students', 'New Students[t] = Intake of the cohort that starts at calendar session t'],
  ]

  formulas.forEach(([label, formula]) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...LGRAY)
    doc.text(label, ML + 6, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(formula, ML + 42, y)
    y += 7
  })

  // Numerical example
  y += 6
  doc.setFillColor(...DARK_ELEVATED)
  doc.roundedRect(ML, y, CW, 48, 2, 2, 'F')
  y += 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('Worked Example (Default Inputs)', ML + 6, y)
  doc.setFont('helvetica', 'normal')
  y += 7

  const examples = [
    '10 courses x 3 credits/course = 30 total credits',
    '30 credits / 3 credits per session = 10 sessions to graduate',
    '8-week format with summer: 3 semesters x 2 sessions = 6 sessions/year',
    '',
    'Cohort of 25 students, 85% early retention (sessions 1-3), 90% late retention (sessions 4+):',
    '  Session 0: 25.00  →  Session 1: 21.25  →  Session 2: 18.06  →  Session 3: 15.35',
    '  Session 4: 13.82  →  Session 5: 12.44  →  ...  →  Session 9: 8.16 → GRADUATE',
    '',
    'Result: 8 out of 25 students (33%) survive retention and graduate at session 10.',
  ]

  examples.forEach(line => {
    doc.setFontSize(7.5)
    doc.setTextColor(...(line.startsWith(' ') ? LGRAY : GRAY))
    doc.text(line, ML + 6, y)
    y += line === '' ? 3 : 5
  })
}

function formulasPage(doc: jsPDF) {
  doc.addPage()
  darkBg(doc)
  pageHeader(doc)
  let y = sectionTitle(doc, '3. Revenue & Cost Formulas', 14)

  // Revenue section
  doc.setFillColor(...SURFACE)
  doc.roundedRect(ML, y, CW, 44, 2, 2, 'F')

  // Revenue header bar
  doc.setFillColor(...RED)
  doc.roundedRect(ML, y, CW, 8, 2, 2, 'F')
  doc.rect(ML, y + 4, CW, 4, 'F')  // fill bottom corners
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('REVENUE', ML + 6, y + 6)
  doc.setFont('helvetica', 'normal')

  const ry = y + 13
  const revFormulas = [
    ['Revenue per Session', 'Total Active  x  Programs  x  Tuition/Credit  x  Credits/Session  x  (1 + Tuition Inflation)^year'],
    ['Total Active', 'Sum of all overlapping cohort active counts at that calendar session'],
    ['Tuition Inflation', 'Compounds annually — (1 + rate) raised to the power of the fiscal year index'],
    ['Annual Revenue', 'Sum of all session revenues within the fiscal year'],
  ]

  revFormulas.forEach(([label, formula], i) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...LGRAY)
    doc.text(label, ML + 6, ry + i * 7.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(formula, ML + 46, ry + i * 7.5)
  })

  // Cost section
  y += 52
  doc.setFillColor(...SURFACE)
  doc.roundedRect(ML, y, CW, 82, 2, 2, 'F')

  // Cost header bar
  doc.setFillColor(...DGRAY)
  doc.roundedRect(ML, y, CW, 8, 2, 2, 'F')
  doc.rect(ML, y + 4, CW, 4, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('COSTS (6 Line Items)', ML + 6, y + 6)
  doc.setFont('helvetica', 'normal')

  const cy = y + 14
  const costFormulas = [
    ['Faculty', 'ceil( Active Students / Max per Section )  x  Cost per Section'],
    ['Teaching Assistants', 'Active Students  x  ( Hourly Rate  x  Hours/Week  x  Weeks )  /  TA:Student Ratio'],
    ['Course Development', '( Courses to Develop x Dev Cost  +  Courses to Revise x Dev Cost x Revision % )  /  Amort Terms'],
    ['Variable Overhead', 'Active Students  x  Overhead per Student'],
    ['Fixed Overhead', 'Overhead per Semester  /  Sessions per Semester   (split for 8-week format)'],
    ['Student Acquisition', 'New Students  x  CAC per Student   (charged once at enrollment, before retention)'],
    ['', ''],
    ['Cost Inflation', 'Each line item above  x  (1 + Cost Inflation %)^year   — compounds annually'],
    ['Total Cost/Session', 'Faculty + TA + Course Dev + Variable OH + Fixed OH + CAC   (all inflated)'],
  ]

  costFormulas.forEach(([label, formula], i) => {
    if (!label) return
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...LGRAY)
    doc.text(label, ML + 6, cy + i * 7.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(formula, ML + 46, cy + i * 7.5)
  })

  // P&L Aggregation section
  y += 90
  doc.setFillColor(...SURFACE)
  doc.roundedRect(ML, y, CW, 44, 2, 2, 'F')

  doc.setFillColor(...GREEN)
  doc.roundedRect(ML, y, CW, 8, 2, 2, 'F')
  doc.rect(ML, y + 4, CW, 4, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('P&L AGGREGATION', ML + 6, y + 6)
  doc.setFont('helvetica', 'normal')

  const py = y + 14
  const plFormulas = [
    ['Revenue per FY', 'Sum of all session revenues within the fiscal year'],
    ['Cost per FY', 'Sum of all session costs within the fiscal year'],
    ['Net P&L', 'Revenue per FY  -  Cost per FY'],
    ['Cumulative P&L', 'Running total of Net P&L across all fiscal years'],
    ['Net Margin %', '( Net P&L  /  Revenue )  x  100'],
    ['Break-Even Year', 'First fiscal year where cumulative P&L  >=  0'],
  ]

  plFormulas.forEach(([label, formula], i) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...LGRAY)
    doc.text(label, ML + 6, py + i * 5.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(formula, ML + 46, py + i * 5.5)
  })
}

// ═══════════════════════ PUBLIC API ═══════════════════════════════════

export function generateMethodologyPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  methodologyCover(doc)
  pipelinePage(doc)
  lifecyclePage(doc)
  formulasPage(doc)

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    pageFooter(doc, i, total)
  }

  doc.save('PnL_Calculation_Methodology.pdf')
}

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
