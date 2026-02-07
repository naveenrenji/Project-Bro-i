/**
 * Client-side Excel workbook generation for Program Financial Estimation.
 * Uses ExcelJS to create a multi-sheet, presentation-ready .xlsx file.
 */

import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { FinancialInputs, ScenarioResults } from './financial-engine'
import { SESSION_GROWTH_KEYS } from './financial-engine'

// Brand colours
const RED = 'A32638'
const DGRAY = '363D45'
const GRAY = '7F7F7F'
const LGRAY = 'E4E5E6'
const WHITE = 'FFFFFF'

// Shared styles
const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }
const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: WHITE }, size: 11 }
const bodyFont: Partial<ExcelJS.Font> = { size: 10, color: { argb: DGRAY } }
const boldFont: Partial<ExcelJS.Font> = { bold: true, size: 10, color: { argb: DGRAY } }
const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LGRAY } }
const moneyFmt = '$#,##0'
const moneyNeg = '$#,##0;[Red]($#,##0)'
const pctFmt = '0.0%'

function applyHeaderRow(ws: ExcelJS.Worksheet, row: number, count: number) {
  const r = ws.getRow(row)
  for (let c = 1; c <= count; c++) {
    const cell = r.getCell(c)
    cell.fill = headerFill
    cell.font = headerFont
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach(col => {
    let max = 10
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? '').length + 2
      if (len > max) max = Math.min(len, 24)
    })
    col.width = max
  })
}

// ─── Executive Summary Sheet ─────────────────────────────────────────

function buildExecutiveSummary(wb: ExcelJS.Workbook, inp: FinancialInputs, res: ScenarioResults) {
  const ws = wb.addWorksheet('Executive Summary', { properties: { tabColor: { argb: RED } } })

  // Title
  ws.mergeCells('A1:G1')
  const title = ws.getCell('A1')
  title.value = `${inp.programName} - Financial Estimation`
  title.font = { bold: true, size: 16, color: { argb: RED } }

  ws.mergeCells('A2:G2')
  const sub = ws.getCell('A2')
  sub.value = `${inp.projectionYears}-Year Outlook | FY${inp.startFY}-FY${inp.startFY + inp.projectionYears - 1} | ${inp.deliveryFormat} delivery`
  sub.font = { italic: true, size: 10, color: { argb: GRAY } }

  // KPI row
  const kpis = [
    ['Total Revenue', res.totalRevenue],
    ['Total Cost', res.totalCost],
    ['Net P&L', res.totalNet],
    ['Break-Even', res.breakEvenYear ?? 'N/A'],
  ]
  kpis.forEach(([label, val], i) => {
    const col = 1 + i * 2
    ws.getCell(4, col).value = label as string
    ws.getCell(4, col).font = { size: 9, color: { argb: GRAY } }
    ws.getCell(5, col).value = val as string | number
    ws.getCell(5, col).font = { bold: true, size: 18, color: { argb: DGRAY } }
    if (typeof val === 'number') ws.getCell(5, col).numFmt = moneyNeg
  })

  // P&L table
  const hRow = 7
  const headers = ['Fiscal Year', 'Revenue', 'Cost', 'Net', 'Cumulative', 'Net Margin %']
  headers.forEach((h, i) => { ws.getCell(hRow, i + 1).value = h })
  applyHeaderRow(ws, hRow, headers.length)

  res.plSummary.forEach((row, ri) => {
    const r = hRow + 1 + ri
    const isTotal = row.fiscalYear === 'Total'
    const isAlt = ri % 2 === 1 && !isTotal
    const vals = [row.fiscalYear, row.revenue, row.cost, row.net, row.cumulative, row.netMarginPct / 100]
    vals.forEach((v, ci) => {
      const cell = ws.getCell(r, ci + 1)
      cell.value = v
      cell.font = isTotal ? boldFont : bodyFont
      if (isAlt) cell.fill = altFill
      if (ci >= 1 && ci <= 4) cell.numFmt = moneyNeg
      if (ci === 5) cell.numFmt = pctFmt
    })
  })

  autoWidth(ws)
  ws.views = [{ state: 'frozen', ySplit: hRow }]
}

// ─── Cohort Matrix Sheet ─────────────────────────────────────────────

function buildCohortMatrix(wb: ExcelJS.Workbook, _inp: FinancialInputs, res: ScenarioResults) {
  const ws = wb.addWorksheet('Cohort Matrix', { properties: { tabColor: { argb: DGRAY } } })

  const maxT = Math.min(res.cohortMatrix[0]?.activeByTerm.length ?? 10, 10)
  const headers = ['Cohort', 'Intake', ...Array.from({ length: maxT }, (_, i) => `T${i + 1}`)]
  headers.forEach((h, i) => { ws.getCell(1, i + 1).value = h })
  applyHeaderRow(ws, 1, headers.length)

  res.cohortMatrix.forEach((row, ri) => {
    const r = ri + 2
    ws.getCell(r, 1).value = row.label
    ws.getCell(r, 1).font = bodyFont
    ws.getCell(r, 2).value = Math.round(row.initialIntake)
    ws.getCell(r, 2).font = bodyFont
    for (let t = 0; t < maxT; t++) {
      const v = Math.round(row.activeByTerm[t] * 10) / 10
      const cell = ws.getCell(r, 3 + t)
      cell.value = v > 0.5 ? Math.round(v) : ''
      cell.font = bodyFont
      if (ri % 2 === 1) cell.fill = altFill
    }
  })

  // Active per term data
  const chartStart = res.cohortMatrix.length + 4
  ws.getCell(chartStart, 1).value = 'Term'
  ws.getCell(chartStart, 1).font = { ...headerFont, color: { argb: DGRAY } }
  ws.getCell(chartStart, 2).value = 'Total Active'
  ws.getCell(chartStart, 2).font = { ...headerFont, color: { argb: DGRAY } }
  res.termLabels.forEach((lbl, i) => {
    ws.getCell(chartStart + 1 + i, 1).value = lbl
    ws.getCell(chartStart + 1 + i, 2).value = Math.round(res.totalActive[i])
  })

  autoWidth(ws)
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
}

// ─── Revenue Sheet ───────────────────────────────────────────────────

function buildRevenue(wb: ExcelJS.Workbook, _inp: FinancialInputs, res: ScenarioResults) {
  const ws = wb.addWorksheet('Revenue', { properties: { tabColor: { argb: RED } } })

  const headers = ['Term', 'Active Students', 'Tuition/Credit', 'Credits/Term', 'Base Revenue', 'Revenue']
  headers.forEach((h, i) => { ws.getCell(1, i + 1).value = h })
  applyHeaderRow(ws, 1, headers.length)

  res.revenueRows.forEach((row, ri) => {
    const r = ri + 2
    const vals = [row.term, Math.round(row.activeStudents), row.tuitionPerCredit, row.creditsPerSession, row.baseRevenue, row.revenue]
    vals.forEach((v, ci) => {
      const cell = ws.getCell(r, ci + 1)
      cell.value = v
      cell.font = bodyFont
      if (ri % 2 === 1) cell.fill = altFill
      if ([2, 4, 5].includes(ci)) cell.numFmt = moneyFmt
    })
  })

  // Sum row
  const sumR = res.revenueRows.length + 2
  ws.getCell(sumR, 1).value = 'Total'
  ws.getCell(sumR, 1).font = boldFont
  ws.getCell(sumR, 6).value = res.revenueRows.reduce((s, r) => s + r.revenue, 0)
  ws.getCell(sumR, 6).font = boldFont
  ws.getCell(sumR, 6).numFmt = moneyFmt

  autoWidth(ws)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

// ─── Costs Sheet ─────────────────────────────────────────────────────

function buildCosts(wb: ExcelJS.Workbook, _inp: FinancialInputs, res: ScenarioResults) {
  const ws = wb.addWorksheet('Costs', { properties: { tabColor: { argb: DGRAY } } })

  const headers = ['Term', 'Faculty', 'TA', 'Course Dev', 'Variable OH', 'Fixed OH', 'CAC', 'Base Total', 'Total Cost']
  headers.forEach((h, i) => { ws.getCell(1, i + 1).value = h })
  applyHeaderRow(ws, 1, headers.length)

  res.costRows.forEach((row, ri) => {
    const r = ri + 2
    const vals = [row.term, row.faculty, row.ta, row.courseDev, row.variableOH, row.fixedOH, row.cac, row.baseTotal, row.totalCost]
    vals.forEach((v, ci) => {
      const cell = ws.getCell(r, ci + 1)
      cell.value = v
      cell.font = bodyFont
      if (ri % 2 === 1) cell.fill = altFill
      if (ci >= 1) cell.numFmt = moneyFmt
    })
  })

  // Sum row
  const sumR = res.costRows.length + 2
  ws.getCell(sumR, 1).value = 'Total'
  ws.getCell(sumR, 1).font = boldFont
  ws.getCell(sumR, 9).value = res.costRows.reduce((s, r) => s + r.totalCost, 0)
  ws.getCell(sumR, 9).font = boldFont
  ws.getCell(sumR, 9).numFmt = moneyFmt

  autoWidth(ws)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

// ─── Assumptions Sheet ───────────────────────────────────────────────

function buildAssumptions(wb: ExcelJS.Workbook, inp: FinancialInputs) {
  const ws = wb.addWorksheet('Assumptions', { properties: { tabColor: { argb: GRAY } } })

  ws.getCell(1, 1).value = 'Parameter'
  ws.getCell(1, 2).value = 'Value'
  applyHeaderRow(ws, 1, 2)

  const sections: [string, [string, string | number, string?][]][] = [
    ['Program Structure', [
      ['Program Name', inp.programName],
      ['Total Courses', inp.totalCourses],
      ['Credits/Course', inp.creditsPerCourse],
      ['Delivery Format', inp.deliveryFormat],
      ['Include Summer', inp.includeSummer ? 'Yes' : 'No'],
      ['Projection Years', inp.projectionYears],
      ['Starting FY', inp.startFY],
      ['Number of Programs', inp.numberOfPrograms],
    ]],
    ['Course Development', [
      ['Courses to Develop', inp.coursesToDevelop],
      ['Dev Cost/Course', inp.devCostPerCourse, moneyFmt],
      ['Courses to Revise', inp.coursesToRevise],
      ['Revision Cost %', inp.revisionCostPct, pctFmt],
      ['Amortisation Terms', inp.devAmortizationTerms],
    ]],
    ['Enrollment & Growth', [
      ['Initial Intake', inp.initialIntake],
      ...inp.growthByYear.flatMap((yr, i): [string, number, string][] => {
        const sessionKeys = inp.deliveryFormat === '8-week' ? (inp.includeSummer ? SESSION_GROWTH_KEYS : SESSION_GROWTH_KEYS.slice(0, 4)) : null
        const hasAB = sessionKeys?.some(k => typeof yr[k] === 'number')
        if (inp.deliveryFormat === '8-week' && sessionKeys && hasAB) {
          const sessionLabel = (k: typeof sessionKeys[number]) => { const sem = k.startsWith('fall') ? 'Fall' : k.startsWith('spring') ? 'Spring' : 'Summer'; const ab = k.endsWith('A') ? 'A' : 'B'; return `${sem}-${ab}` }
          return sessionKeys.map(k => {
            const v = typeof yr[k] === 'number' ? yr[k]! : (k.startsWith('fall') ? yr.fall : k.startsWith('spring') ? yr.spring : yr.summer)
            return [`Year ${i + 1} ${sessionLabel(k)} Growth`, v, pctFmt]
          })
        }
        return [
          [`Year ${i + 1} Fall Growth`, yr.fall, pctFmt],
          [`Year ${i + 1} Spring Growth`, yr.spring, pctFmt],
          ...(inp.includeSummer ? [[`Year ${i + 1} Summer Growth`, yr.summer, pctFmt] as [string, number, string]] : []),
        ]
      }),
    ]],
    ['Retention', [
      ['Early Retention %', inp.earlyRetentionRate, pctFmt],
      ['Late Retention %', inp.lateRetentionRate, pctFmt],
      ['Threshold Term', inp.retentionThresholdTerm],
    ]],
    ['Tuition & Revenue', [
      ['Tuition/Credit', inp.tuitionPerCredit, moneyFmt],
      ['Credits/Session', inp.creditsPerSession],
      ['Tuition Inflation %/yr', inp.tuitionInflationPct, pctFmt],
    ]],
    ['Faculty & TA', [
      ['Faculty $/Section/Term', inp.facultyCostPerSection, moneyFmt],
      ['Max Students/Section', inp.maxStudentsPerSection],
      ['TA:Student Ratio', inp.taStudentRatio],
      ['TA Hourly Rate', inp.taHourlyRate, moneyFmt],
      ['TA Hours/Week', inp.taHoursPerWeek],
      ['Weeks/Session', inp.weeksPerSession],
    ]],
    ['Overhead & Marketing', [
      ['Variable OH/Student', inp.variableOverheadPerStudent, moneyFmt],
      ['Fixed OH/Term', inp.fixedOverheadPerTerm, moneyFmt],
      ['CAC/Student', inp.cacPerStudent, moneyFmt],
      ['Cost Inflation %/yr', inp.costInflationPct, pctFmt],
    ]],
  ]

  let row = 2
  for (const [section, params] of sections) {
    ws.mergeCells(row, 1, row, 2)
    ws.getCell(row, 1).value = section
    ws.getCell(row, 1).font = { bold: true, size: 11, color: { argb: DGRAY } }
    ws.getCell(row, 1).fill = altFill
    row++

    for (const [label, value, fmt] of params) {
      ws.getCell(row, 1).value = label
      ws.getCell(row, 1).font = bodyFont
      ws.getCell(row, 2).value = value
      ws.getCell(row, 2).font = bodyFont
      if (fmt) ws.getCell(row, 2).numFmt = fmt
      row++
    }
    row++ // blank row between sections
  }

  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 18
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

// ─── Public API ──────────────────────────────────────────────────────

export async function generateExcel(inputs: FinancialInputs, results: ScenarioResults, reportTitle?: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CPE Analytics Dashboard'
  wb.created = new Date()

  const title = reportTitle || inputs.programName

  // Override title in the summary sheet
  const modifiedInputs = { ...inputs, programName: title }

  buildExecutiveSummary(wb, modifiedInputs, results)
  buildCohortMatrix(wb, modifiedInputs, results)
  buildRevenue(wb, modifiedInputs, results)
  buildCosts(wb, modifiedInputs, results)
  buildAssumptions(wb, modifiedInputs)

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${title.replace(/\s+/g, '_')}_Financial_Model.xlsx`)
}
