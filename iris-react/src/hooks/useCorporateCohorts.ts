/**
 * useCorporateCohorts Hook
 * 
 * Computes corporate cohort data with program and degree type breakdowns
 * from raw student records. Groups by cohortName (the official cohort identifier).
 */

import { useMemo } from 'react'
import { useDataStore } from '@/store/dataStore'
import { useFilterStore, filterStudents, type StudentRecord } from '@/store/filterStore'

export interface ProgramBreakdown {
  name: string
  count: number
  percentage: number
}

export interface DegreeTypeBreakdown {
  name: string
  count: number
  percentage: number
}

export interface CohortBreakdown {
  cohortName: string  // Primary identifier - the corporate cohort name
  total: number
  newStudents: number
  continuing: number
  programs: ProgramBreakdown[]
  degreeTypes: DegreeTypeBreakdown[]
}

/**
 * Check if a cohort name value is valid (not null, empty, or "Not reported")
 */
function isValidCohortName(cohortName: string | undefined | null): cohortName is string {
  if (!cohortName) return false
  const normalized = cohortName.trim().toLowerCase()
  return normalized !== '' && 
         normalized !== 'not reported' && 
         normalized !== 'n/a' &&
         normalized !== 'none'
}

/**
 * Hook to get all corporate cohorts with program and degree type breakdowns
 * Groups by cohortName (the official cohort identifier from Census)
 */
export function useCorporateCohorts(): CohortBreakdown[] {
  const data = useDataStore((state) => state.data)
  const { categories, schools, degreeTypes, programs, studentTypes, funnelStages, filterMode } = useFilterStore()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  
  return useMemo(() => {
    if (!data?.students) return []
    
    let students = data.students as StudentRecord[]
    
    // Apply filters if active
    if (hasFilters) {
      students = filterStudents(students, {
        categories,
        schools,
        degreeTypes,
        programs,
        studentTypes,
        funnelStages,
        filterMode,
      })
    }
    
    // Filter to only enrolled students with valid cohort name
    const corporateStudents = students.filter(s => 
      isValidCohortName(s.cohortName) && 
      (s.funnelStage === 'enrolled' || s.studentStatus === 'Enrolled' || s.source === 'census')
    )
    
    // Group by cohort name
    const cohortMap = new Map<string, StudentRecord[]>()
    
    corporateStudents.forEach(student => {
      const cohortName = student.cohortName!.trim()
      if (!cohortMap.has(cohortName)) {
        cohortMap.set(cohortName, [])
      }
      cohortMap.get(cohortName)!.push(student)
    })
    
    // Build cohort breakdowns
    const cohorts: CohortBreakdown[] = []
    
    cohortMap.forEach((students, cohortName) => {
      const total = students.length
      const newStudents = students.filter(s => 
        s.studentType === 'New' || s.source === 'slate'
      ).length
      const continuing = total - newStudents
      
      // Program breakdown
      const programCounts = new Map<string, number>()
      students.forEach(s => {
        const program = s.program || 'Unknown'
        programCounts.set(program, (programCounts.get(program) || 0) + 1)
      })
      
      const programBreakdown: ProgramBreakdown[] = Array.from(programCounts.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count)
      
      // Degree type breakdown
      const degreeTypeCounts = new Map<string, number>()
      students.forEach(s => {
        const degreeType = s.degreeType || 'Unknown'
        degreeTypeCounts.set(degreeType, (degreeTypeCounts.get(degreeType) || 0) + 1)
      })
      
      const degreeTypeBreakdown: DegreeTypeBreakdown[] = Array.from(degreeTypeCounts.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count)
      
      cohorts.push({
        cohortName,
        total,
        newStudents,
        continuing,
        programs: programBreakdown,
        degreeTypes: degreeTypeBreakdown,
      })
    })
    
    // Sort by total students (largest first)
    return cohorts.sort((a, b) => b.total - a.total)
  }, [data?.students, categories, schools, degreeTypes, programs, studentTypes, funnelStages, filterMode, hasFilters])
}

/**
 * Hook to get a summary of corporate cohort stats
 */
export function useCorporateCohortSummary() {
  const cohorts = useCorporateCohorts()
  
  return useMemo(() => {
    const totalCohorts = cohorts.length
    const totalStudents = cohorts.reduce((sum, c) => sum + c.total, 0)
    const totalNew = cohorts.reduce((sum, c) => sum + c.newStudents, 0)
    const totalContinuing = cohorts.reduce((sum, c) => sum + c.continuing, 0)
    
    // Unique programs across all cohorts
    const allPrograms = new Set<string>()
    cohorts.forEach(c => c.programs.forEach(p => allPrograms.add(p.name)))
    
    // Unique degree types across all cohorts
    const allDegreeTypes = new Set<string>()
    cohorts.forEach(c => c.degreeTypes.forEach(d => allDegreeTypes.add(d.name)))
    
    return {
      totalCohorts,
      totalStudents,
      totalNew,
      totalContinuing,
      uniquePrograms: allPrograms.size,
      uniqueDegreeTypes: allDegreeTypes.size,
    }
  }, [cohorts])
}
