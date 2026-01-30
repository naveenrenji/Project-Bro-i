import { useMemo } from 'react'
import { useDataStore } from '@/store/dataStore'
import { 
  useFilterStore, 
  filterStudents, 
  aggregateStudentMetrics,
  groupStudentsBy,
  type StudentRecord 
} from '@/store/filterStore'

/**
 * Hook to get filtered student records based on current filter state
 * Returns ALL years (for YoY comparisons)
 */
export function useFilteredStudents() {
  const data = useDataStore((state) => state.data)
  const { categories, schools, degreeTypes, programs, studentTypes, funnelStages, filterMode } = useFilterStore()
  
  const students = useMemo(() => {
    if (!data?.students) return []
    return filterStudents(data.students as StudentRecord[], {
      categories,
      schools,
      degreeTypes,
      programs,
      studentTypes,
      funnelStages,
      filterMode,
    })
  }, [data?.students, categories, schools, degreeTypes, programs, studentTypes, funnelStages, filterMode])
  
  return students
}

/**
 * Hook to get filtered student records for CURRENT YEAR ONLY (2026)
 * Use this for student tab, graduation, enrollment metrics
 */
export function useFilteredStudentsCurrentYear() {
  const students = useFilteredStudents()
  
  return useMemo(() => {
    return students.filter(s => s.year === '2026')
  }, [students])
}

/**
 * Hook to get aggregated metrics from filtered students (current year only)
 */
export function useFilteredMetrics() {
  const students = useFilteredStudentsCurrentYear()
  
  return useMemo(() => {
    return aggregateStudentMetrics(students)
  }, [students])
}

/**
 * Hook to get filtered students grouped by a field
 */
export function useFilteredStudentsByField<K extends keyof StudentRecord>(field: K) {
  const students = useFilteredStudents()
  
  return useMemo(() => {
    return groupStudentsBy(students, field)
  }, [students, field])
}

/**
 * Hook to get filtered funnel data
 */
export function useFilteredFunnel() {
  const metrics = useFilteredMetrics()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  // If no filters active, return original data
  if (!hasFilters) {
    return data?.funnel ?? []
  }
  
  // Return computed funnel from filtered students
  const { funnel } = metrics
  return [
    { stage: 'Applications', count: funnel.applications, conversionRate: 100 },
    { stage: 'Admits', count: funnel.admits, conversionRate: funnel.admitRate },
    { stage: 'Accepted', count: funnel.accepted, conversionRate: funnel.admits > 0 ? (funnel.accepted / funnel.admits) * 100 : 0 },
    { stage: 'Enrolled', count: funnel.enrollments, conversionRate: funnel.yieldRate },
  ]
}

/**
 * Hook to get filtered NTR data (current year only)
 */
export function useFilteredNTR() {
  const students = useFilteredStudentsCurrentYear()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  return useMemo(() => {
    // If no filters active, return original data
    if (!hasFilters) {
      return data?.ntr ?? null
    }
    
    // Calculate NTR from filtered census students
    const censusStudents = students.filter(s => s.source === 'census')
    
    const newStudents = censusStudents.filter(s => s.studentType === 'New')
    const currentStudents = censusStudents.filter(s => s.studentType === 'Current')
    
    const newNTR = newStudents.reduce((sum, s) => sum + (s.ntr || 0), 0)
    const currentNTR = currentStudents.reduce((sum, s) => sum + (s.ntr || 0), 0)
    const totalNTR = newNTR + currentNTR
    
    const newCredits = newStudents.reduce((sum, s) => sum + (s.credits || 0), 0)
    const currentCredits = currentStudents.reduce((sum, s) => sum + (s.credits || 0), 0)
    
    const goal = data?.ntr?.goal || 9_800_000
    
    return {
      total: totalNTR,
      goal,
      percentOfGoal: goal > 0 ? (totalNTR / goal) * 100 : 0,
      gapToGoal: Math.max(0, goal - totalNTR),
      newNTR,
      currentNTR,
      newStudents: newStudents.length,
      currentStudents: currentStudents.length,
      newCredits,
      currentCredits,
      totalStudents: censusStudents.length,
      totalCredits: newCredits + currentCredits,
      byCategory: calculateNTRByCategory(censusStudents),
      breakdown: [],
      byStudentType: [
        { type: 'New', ntr: newNTR, students: newStudents.length, credits: newCredits },
        { type: 'Current', ntr: currentNTR, students: currentStudents.length, credits: currentCredits },
      ],
    }
  }, [students, hasFilters, data?.ntr])
}

/**
 * Hook to get filtered graduation data (current year only)
 */
export function useFilteredGraduation() {
  const students = useFilteredStudentsCurrentYear()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  return useMemo(() => {
    // If no filters active, return original data
    if (!hasFilters) {
      return data?.graduation ?? null
    }
    
    // Calculate graduation from filtered census students
    const censusStudents = students.filter(s => s.source === 'census')
    
    // Graduating = credits after term <= 0
    const graduating = censusStudents.filter(s => s.graduatingThisTerm)
    // Non-graduating students
    const notGraduating = censusStudents.filter(s => !s.graduatingThisTerm)
    
    // MUTUALLY EXCLUSIVE buckets based on credits AFTER term
    const within10 = notGraduating.filter(s => {
      const after = s.creditsAfterTerm
      return after !== undefined && after > 0 && after <= 10
    })
    const within20 = notGraduating.filter(s => {
      const after = s.creditsAfterTerm
      return after !== undefined && after > 10 && after <= 20
    })
    const credits20Plus = notGraduating.filter(s => {
      const after = s.creditsAfterTerm
      return after === undefined || after > 20
    })
    
    // Calculate by category - MUTUALLY EXCLUSIVE buckets
    const byCategory = Object.entries(groupStudentsBy(censusStudents, 'category'))
      .filter(([cat]) => cat !== 'Unknown' && cat !== '')
      .map(([category, catStudents]) => {
        const catGraduating = catStudents.filter(s => s.graduatingThisTerm)
        const catNotGraduating = catStudents.filter(s => !s.graduatingThisTerm)
        
        return {
          category,
          graduating: catGraduating.length,
          within10: catNotGraduating.filter(s => {
            const after = s.creditsAfterTerm
            return after !== undefined && after > 0 && after <= 10
          }).length,
          within20: catNotGraduating.filter(s => {
            const after = s.creditsAfterTerm
            return after !== undefined && after > 10 && after <= 20
          }).length,
          continuing: catNotGraduating.length,
          total: catStudents.length,
        }
      })
      .sort((a, b) => b.total - a.total)
    
    return {
      graduatingThisTerm: graduating.length,
      within10Credits: within10.length,
      within20Credits: within20.length,
      credits20Plus: credits20Plus.length,
      totalStudents: censusStudents.length,
      progressDistribution: [
        { label: 'Graduating', value: graduating.length, color: '#22c55e' },
        { label: '1-10 remaining', value: within10.length, color: '#3b82f6' },
        { label: '11-20 remaining', value: within20.length, color: '#f59e0b' },
        { label: '20+ remaining', value: credits20Plus.length, color: '#ef4444' },
      ],
      graduatingStudents: graduating.slice(0, 30).map(s => ({
        program: s.program,
        category: s.category,
        creditsRemaining: s.creditsRemaining || 0,
        creditsThisTerm: s.credits || 0,
        creditsAfterTerm: s.creditsAfterTerm || 0,
        willGraduate: true,
      })),
      byCategory,
      retentionRate: data?.graduation?.retentionRate || 0.92,
      projectedContinuing: Math.round((censusStudents.length - graduating.length) * 0.92),
    }
  }, [students, hasFilters, data?.graduation])
}

/**
 * Hook to get filtered categories with metrics (current year only)
 */
export function useFilteredCategories() {
  const students = useFilteredStudentsCurrentYear()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  return useMemo(() => {
    if (!hasFilters) {
      return data?.categories ?? []
    }
    
    const slateStudents = students.filter(s => s.source === 'slate')
    const byCategory = groupStudentsBy(slateStudents, 'category')
    
    return Object.entries(byCategory)
      .filter(([cat]) => cat !== 'Unknown' && cat !== '')
      .map(([category, catStudents]) => {
        const apps = catStudents.length
        const admits = catStudents.filter(s => 
          s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled'
        ).length
        const enrolled = catStudents.filter(s => s.funnelStage === 'enrolled').length
        
        return {
          category,
          applications: apps,
          admits,
          enrollments: enrolled,
          yield: admits > 0 ? Math.round((enrolled / admits) * 100 * 10) / 10 : 0,
        }
      })
      .sort((a, b) => b.enrollments - a.enrollments)
  }, [students, hasFilters, data?.categories])
}

// Helper function to calculate NTR by category
function calculateNTRByCategory(students: StudentRecord[]) {
  const byCategory = groupStudentsBy(students, 'category')
  
  return Object.entries(byCategory)
    .filter(([cat]) => cat !== 'Unknown' && cat !== '')
    .map(([category, catStudents]) => ({
      category,
      degreeType: catStudents[0]?.degreeType || '',
      ntr: catStudents.reduce((sum, s) => sum + (s.ntr || 0), 0),
      students: catStudents.length,
      credits: catStudents.reduce((sum, s) => sum + (s.credits || 0), 0),
    }))
    .sort((a, b) => b.ntr - a.ntr)
}

/**
 * Hook to get filtered demographics data (current year only)
 */
export function useFilteredDemographics() {
  const students = useFilteredStudentsCurrentYear()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  return useMemo(() => {
    // If no filters active, return original data
    if (!hasFilters) {
      return data?.demographics ?? null
    }
    
    // Calculate demographics from filtered census students
    const censusStudents = students.filter(s => s.source === 'census')
    const total = censusStudents.length
    
    if (total === 0) {
      return {
        totalStudents: 0,
        domesticInternational: [],
        raceEthnicity: [],
        ageDistribution: null,
        gpaDistribution: null,
        topStates: [],
        topCountries: [],
      }
    }
    
    // Domestic vs International
    const domIntCounts: Record<string, number> = {}
    censusStudents.forEach(s => {
      const status = s.domesticInternational || 'Unknown'
      domIntCounts[status] = (domIntCounts[status] || 0) + 1
    })
    const domesticInternational = Object.entries(domIntCounts)
      .filter(([status]) => status && status !== 'Unknown' && status !== '')
      .map(([status, count]) => ({
        status,
        count,
        percentage: Math.round((count / total) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
    
    // Top States
    const stateCounts: Record<string, number> = {}
    censusStudents.forEach(s => {
      const state = s.state || ''
      if (state && state !== 'Not reported' && state !== '') {
        stateCounts[state] = (stateCounts[state] || 0) + 1
      }
    })
    const topStates = Object.entries(stateCounts)
      .map(([state, count]) => ({
        state,
        count,
        percentage: Math.round((count / total) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    // Top Countries
    const countryCounts: Record<string, number> = {}
    censusStudents.forEach(s => {
      const country = s.country || ''
      if (country && country !== 'Not reported' && country !== '') {
        countryCounts[country] = (countryCounts[country] || 0) + 1
      }
    })
    const topCountries = Object.entries(countryCounts)
      .map(([country, count]) => ({
        country,
        count,
        percentage: Math.round((count / total) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    return {
      totalStudents: total,
      domesticInternational,
      raceEthnicity: data?.demographics?.raceEthnicity || [], // Keep original for now (not in student records)
      ageDistribution: data?.demographics?.ageDistribution || null, // Keep original for now
      gpaDistribution: data?.demographics?.gpaDistribution || null, // Keep original for now
      topStates,
      topCountries,
    }
  }, [students, hasFilters, data?.demographics])
}

/**
 * Hook to get filtered YoY/historical data
 * Filters all years (2024, 2025, 2026) using student-level data
 */
export function useFilteredHistorical() {
  const students = useFilteredStudents()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  return useMemo(() => {
    const rawHistorical = data?.historical
    const rawYoY = data?.yoy
    
    if (!hasFilters || !rawHistorical) {
      return {
        historical: rawHistorical,
        yoy: rawYoY,
        isFiltered: false,
      }
    }
    
    // Calculate metrics for each year from filtered students
    const years = ['2024', '2025', '2026']
    const yearStats = years.map(year => {
      const yearSlate = students.filter(s => s.source === 'slate' && s.year === year)
      const yearCensus = students.filter(s => s.source === 'census' && s.year === year)
      
      const apps = yearSlate.length
      const admits = yearSlate.filter(s => 
        s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled'
      ).length
      const accepted = yearSlate.filter(s => 
        s.funnelStage === 'accepted' || s.funnelStage === 'enrolled'
      ).length
      const slateEnrolled = yearSlate.filter(s => s.funnelStage === 'enrolled').length
      
      // Census enrollment (total students from census for that year)
      const censusTotal = yearCensus.length
      const censusNew = yearCensus.filter(s => s.studentType === 'New').length
      
      const yieldRate = admits > 0 ? Math.round((slateEnrolled / admits) * 100 * 10) / 10 : 0
      
      return {
        apps,
        admits,
        accepted,
        enrolled: slateEnrolled,
        censusTotal,
        censusNew,
        yield: yieldRate,
      }
    })
    
    // Build filtered historical
    const filteredHistorical = {
      years,
      applications: yearStats.map(s => s.apps),
      admits: yearStats.map(s => s.admits),
      enrollments: yearStats.map(s => s.enrolled),
      yields: yearStats.map(s => s.yield),
      // Census data
      censusTotal: yearStats.map(s => s.censusTotal),
      censusNew: yearStats.map(s => s.censusNew),
    }
    
    // Calculate YoY changes (2026 vs 2025)
    const curr = yearStats[2] // 2026
    const prev = yearStats[1] // 2025
    const twoYears = yearStats[0] // 2024
    
    const calcChange = (curr: number, prev: number) => 
      prev > 0 ? Math.round(((curr - prev) / prev) * 100 * 10) / 10 : 0
    
    const filteredYoY = {
      current: { apps: curr.apps, admits: curr.admits, enrollments: curr.enrolled, yield: curr.yield },
      previous: { apps: prev.apps, admits: prev.admits, enrollments: prev.enrolled, yield: prev.yield },
      twoYearsAgo: { apps: twoYears.apps, admits: twoYears.admits, enrollments: twoYears.enrolled, yield: twoYears.yield },
      vsLastYear: {
        appsChange: calcChange(curr.apps, prev.apps),
        admitsChange: calcChange(curr.admits, prev.admits),
        enrollmentsChange: calcChange(curr.enrolled, prev.enrolled),
        yieldChange: Math.round((curr.yield - prev.yield) * 10) / 10,
      },
      vsTwoYearsAgo: {
        appsChange: calcChange(curr.apps, twoYears.apps),
        admitsChange: calcChange(curr.admits, twoYears.admits),
        enrollmentsChange: calcChange(curr.enrolled, twoYears.enrolled),
        yieldChange: Math.round((curr.yield - twoYears.yield) * 10) / 10,
      },
    }
    
    return {
      historical: filteredHistorical,
      yoy: filteredYoY,
      isFiltered: true,
    }
  }, [students, hasFilters, data?.historical, data?.yoy])
}

/**
 * Normalize program name for consistent grouping (case-insensitive, trimmed)
 */
function normalizeProgram(name: string): string {
  if (!name) return ''
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Title case a program name for display
 */
function titleCaseProgram(name: string): string {
  if (!name) return ''
  return name.trim().split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

/**
 * Hook to get filtered programs with metrics (current year only)
 * Calculates YoY enrollment change vs 2024 and 2025 Spring Final Census
 */
export function useFilteredPrograms() {
  const allStudents = useFilteredStudents() // All years
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  return useMemo(() => {
    if (!hasFilters) {
      return {
        programs: data?.programs ?? [],
        programsAll: data?.programsAll ?? data?.programs ?? [],
      }
    }
    
    // Get students for current year (2026) and 2024/2025 for YoY comparison
    const students2026 = allStudents.filter(s => s.year === '2026')
    const students2025 = allStudents.filter(s => s.year === '2025')
    const students2024 = allStudents.filter(s => s.year === '2024')
    
    // Group students by program
    const slateStudents = students2026.filter(s => s.source === 'slate')
    const censusStudents2026 = students2026.filter(s => s.source === 'census')
    const censusStudents2025 = students2025.filter(s => s.source === 'census')
    const censusStudents2024 = students2024.filter(s => s.source === 'census')
    
    // Build enrollment lookup by program (normalized key)
    const enrollments2024: Record<string, number> = {}
    const enrollments2025: Record<string, number> = {}
    
    censusStudents2024.forEach(s => {
      const progKey = normalizeProgram(s.program || '')
      enrollments2024[progKey] = (enrollments2024[progKey] || 0) + 1
    })
    
    censusStudents2025.forEach(s => {
      const progKey = normalizeProgram(s.program || '')
      enrollments2025[progKey] = (enrollments2025[progKey] || 0) + 1
    })
    
    // Build program metrics from filtered data
    // Use normalized key for grouping, store display name
    const programMap: Record<string, {
      program: string
      school: string
      degreeType: string
      category: string
      applications: number
      admits: number
      accepted: number
      enrollments: number
      enrollments2024: number
      enrollments2025: number
      vs2024: number
      vs2025: number
    }> = {}
    
    // Aggregate Slate data (applications, admits, accepted)
    slateStudents.forEach(s => {
      const progRaw = s.program || 'Unknown'
      const progKey = normalizeProgram(progRaw)
      
      if (!programMap[progKey]) {
        programMap[progKey] = {
          program: titleCaseProgram(progRaw),
          school: s.school || '',
          degreeType: s.degreeType || '',
          category: s.category || '',
          applications: 0,
          admits: 0,
          accepted: 0,
          enrollments: 0,
          enrollments2024: enrollments2024[progKey] || 0,
          enrollments2025: enrollments2025[progKey] || 0,
          vs2024: 0,
          vs2025: 0,
        }
      }
      
      programMap[progKey].applications++
      if (s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled') {
        programMap[progKey].admits++
      }
      if (s.funnelStage === 'accepted' || s.funnelStage === 'enrolled') {
        programMap[progKey].accepted++
      }
    })
    
    // Aggregate Census data (enrollments for 2026)
    censusStudents2026.forEach(s => {
      const progRaw = s.program || 'Unknown'
      const progKey = normalizeProgram(progRaw)
      
      if (!programMap[progKey]) {
        programMap[progKey] = {
          program: titleCaseProgram(progRaw),
          school: s.school || '',
          degreeType: s.degreeType || '',
          category: s.category || '',
          applications: 0,
          admits: 0,
          accepted: 0,
          enrollments: 0,
          enrollments2024: enrollments2024[progKey] || 0,
          enrollments2025: enrollments2025[progKey] || 0,
          vs2024: 0,
          vs2025: 0,
        }
      }
      
      programMap[progKey].enrollments++
      // Update school/degree/category if not set
      if (!programMap[progKey].school && s.school) programMap[progKey].school = s.school
      if (!programMap[progKey].degreeType && s.degreeType) programMap[progKey].degreeType = s.degreeType
      if (!programMap[progKey].category && s.category) programMap[progKey].category = s.category
    })
    
    // Calculate YoY enrollment change vs 2024 and 2025 for each program
    const calcChange = (curr: number, prev: number) => {
      if (prev > 0) return Math.round(((curr - prev) / prev) * 100)
      return curr > 0 ? 100 : 0 // New program = 100% growth, or 0 if no enrollments
    }
    
    const programsAll = Object.values(programMap)
      .map(p => ({
        ...p,
        vs2024: calcChange(p.enrollments, p.enrollments2024),
        vs2025: calcChange(p.enrollments, p.enrollments2025),
      }))
      .filter(p => p.program && p.program.toLowerCase() !== 'unknown')
      .sort((a, b) => b.enrollments - a.enrollments)
    
    return {
      programs: programsAll.slice(0, 15),
      programsAll,
    }
  }, [allStudents, hasFilters, data?.programs, data?.programsAll])
}

/**
 * Hook to check if data is being filtered
 */
export function useIsFiltered() {
  return useFilterStore((state) => state.hasActiveFilters())
}

/**
 * Hook to get filter summary text
 */
export function useFilterSummary() {
  const { categories, schools, degreeTypes, studentTypes } = useFilterStore()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  
  if (!hasFilters) return null
  
  const parts: string[] = []
  if (categories.length > 0) {
    parts.push(categories.length === 1 ? categories[0] : `${categories.length} categories`)
  }
  if (schools.length > 0) {
    parts.push(schools.length === 1 ? schools[0] : `${schools.length} schools`)
  }
  if (degreeTypes.length > 0) {
    parts.push(degreeTypes.length === 1 ? degreeTypes[0] : `${degreeTypes.length} degrees`)
  }
  if (studentTypes.length > 0) {
    parts.push(studentTypes.join(' & '))
  }
  
  return parts.join(' • ')
}
