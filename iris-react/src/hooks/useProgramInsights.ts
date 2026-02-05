/**
 * useProgramInsights Hook
 * 
 * Provides classified program data with enrollment tiers (top/middle/needsAttention)
 * and metrics including Total, New, Continuing students and YoY change.
 */

import { useMemo } from 'react'
import { useDataStore } from '@/store/dataStore'
import { useFilterStore, filterStudents, groupStudentsBy, type StudentRecord } from '@/store/filterStore'
import { classifyProgram, type ClassifiedProgram, type PerformanceTier } from '@/lib/program-classification'

interface ProgramInsights {
  topPerformers: ClassifiedProgram[]
  middleBunch: ClassifiedProgram[]
  needsAttention: ClassifiedProgram[]
  allPrograms: ClassifiedProgram[]
  summary: {
    topCount: number
    middleCount: number
    attentionCount: number
    totalPrograms: number
  }
}

/**
 * Get program insights with tier classification
 */
export function useProgramInsights(): ProgramInsights {
  const data = useDataStore((state) => state.data)
  const { categories, schools, degreeTypes, programs, studentTypes, funnelStages } = useFilterStore()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  
  return useMemo(() => {
    const emptyResult: ProgramInsights = {
      topPerformers: [],
      middleBunch: [],
      needsAttention: [],
      allPrograms: [],
      summary: { topCount: 0, middleCount: 0, attentionCount: 0, totalPrograms: 0 },
    }
    
    if (!data?.students) return emptyResult
    
    // Get current year students (2026) from census (enrolled)
    let students = (data.students as StudentRecord[]).filter(s => 
      s.source === 'census' && s.year === '2026'
    )
    
    // Get previous year students for YoY comparison
    let prevStudents = (data.students as StudentRecord[]).filter(s => 
      s.source === 'census' && s.year === '2025'
    )
    
    // Apply filters if active
    if (hasFilters) {
      const filterConfig = { categories, schools, degreeTypes, programs, studentTypes, funnelStages, filterMode: 'all' as const }
      students = filterStudents(students, filterConfig)
      prevStudents = filterStudents(prevStudents, filterConfig)
    }
    
    // Group by program
    const currentByProgram = groupStudentsBy(students, 'program')
    const prevByProgram = groupStudentsBy(prevStudents, 'program')
    
    // Build classified programs
    const classifiedPrograms: ClassifiedProgram[] = []
    
    Object.entries(currentByProgram).forEach(([program, programStudents]) => {
      if (!program || program === 'Unknown' || program === '') return
      
      const total = programStudents.length
      const newStudents = programStudents.filter(s => s.studentType === 'New').length
      const continuing = programStudents.filter(s => s.studentType === 'Current').length
      
      // Previous year total for YoY
      const prevTotal = prevByProgram[program]?.length || 0
      const yoyChange = prevTotal > 0 
        ? Math.round(((total - prevTotal) / prevTotal) * 100 * 10) / 10
        : (total > 0 ? 100 : 0)
      
      // Get metadata from first student
      const firstStudent = programStudents[0]
      
      classifiedPrograms.push({
        program,
        school: firstStudent?.school || 'Unknown',
        degreeType: firstStudent?.degreeType || 'Unknown',
        category: firstStudent?.category || 'Unknown',
        total,
        newStudents,
        continuing,
        yoyChange,
        tier: classifyProgram(total),
      })
    })
    
    // Sort by total descending
    classifiedPrograms.sort((a, b) => b.total - a.total)
    
    // Split by tier
    const topPerformers = classifiedPrograms.filter(p => p.tier === 'top')
    const middleBunch = classifiedPrograms.filter(p => p.tier === 'middle')
    const needsAttention = classifiedPrograms
      .filter(p => p.tier === 'needsAttention')
      .sort((a, b) => a.total - b.total) // Sort by lowest first for attention
    
    return {
      topPerformers,
      middleBunch,
      needsAttention,
      allPrograms: classifiedPrograms,
      summary: {
        topCount: topPerformers.length,
        middleCount: middleBunch.length,
        attentionCount: needsAttention.length,
        totalPrograms: classifiedPrograms.length,
      },
    }
  }, [data?.students, categories, schools, degreeTypes, programs, studentTypes, funnelStages, hasFilters])
}

/**
 * Get top N performers
 */
export function useTopPerformers(limit: number = 5): ClassifiedProgram[] {
  const { topPerformers } = useProgramInsights()
  return topPerformers.slice(0, limit)
}

/**
 * Get bottom N programs needing attention
 */
export function useNeedsAttention(limit: number = 5): ClassifiedProgram[] {
  const { needsAttention } = useProgramInsights()
  return needsAttention.slice(0, limit)
}

/**
 * Get student type metrics (Total, New, Continuing)
 */
export function useStudentMetrics() {
  const data = useDataStore((state) => state.data)
  const { categories, schools, degreeTypes, programs, studentTypes, funnelStages } = useFilterStore()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  
  return useMemo(() => {
    if (!data?.students) {
      return {
        total: { current: 0, previous: 0, yoyChange: 0 },
        new: { current: 0, previous: 0, yoyChange: 0 },
        continuing: { current: 0, previous: 0, yoyChange: 0 },
      }
    }
    
    // Get current year students (2026) from census
    let currentStudents = (data.students as StudentRecord[]).filter(s => 
      s.source === 'census' && s.year === '2026'
    )
    
    // Get previous year students (2025) from census
    let prevStudents = (data.students as StudentRecord[]).filter(s => 
      s.source === 'census' && s.year === '2025'
    )
    
    // Apply filters if active
    if (hasFilters) {
      const filterConfig = { categories, schools, degreeTypes, programs, studentTypes, funnelStages, filterMode: 'all' as const }
      currentStudents = filterStudents(currentStudents, filterConfig)
      prevStudents = filterStudents(prevStudents, filterConfig)
    }
    
    // Calculate metrics
    const currentTotal = currentStudents.length
    const currentNew = currentStudents.filter(s => s.studentType === 'New').length
    const currentContinuing = currentStudents.filter(s => s.studentType === 'Current').length
    
    const prevTotal = prevStudents.length
    const prevNew = prevStudents.filter(s => s.studentType === 'New').length
    const prevContinuing = prevStudents.filter(s => s.studentType === 'Current').length
    
    const calcYoY = (curr: number, prev: number) => 
      prev > 0 ? Math.round(((curr - prev) / prev) * 100 * 10) / 10 : (curr > 0 ? 100 : 0)
    
    return {
      total: {
        current: currentTotal,
        previous: prevTotal,
        yoyChange: calcYoY(currentTotal, prevTotal),
      },
      new: {
        current: currentNew,
        previous: prevNew,
        yoyChange: calcYoY(currentNew, prevNew),
      },
      continuing: {
        current: currentContinuing,
        previous: prevContinuing,
        yoyChange: calcYoY(currentContinuing, prevContinuing),
      },
    }
  }, [data?.students, categories, schools, degreeTypes, programs, studentTypes, funnelStages, hasFilters])
}

// Re-export types
export type { ClassifiedProgram, PerformanceTier }
