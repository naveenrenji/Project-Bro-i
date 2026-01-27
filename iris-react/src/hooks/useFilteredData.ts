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
 * Hook to get aggregated metrics from filtered students
 */
export function useFilteredMetrics() {
  const students = useFilteredStudents()
  
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
 * Hook to get filtered NTR data
 */
export function useFilteredNTR() {
  const students = useFilteredStudents()
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
 * Hook to get filtered graduation data
 */
export function useFilteredGraduation() {
  const students = useFilteredStudents()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  const data = useDataStore((state) => state.data)
  
  return useMemo(() => {
    // If no filters active, return original data
    if (!hasFilters) {
      return data?.graduation ?? null
    }
    
    // Calculate graduation from filtered census students
    const censusStudents = students.filter(s => s.source === 'census')
    
    const graduating = censusStudents.filter(s => s.graduatingThisTerm)
    const within10 = censusStudents.filter(s => {
      const after = s.creditsAfterTerm
      return after !== undefined && after > 0 && after <= 10
    })
    const within20 = censusStudents.filter(s => {
      const after = s.creditsAfterTerm
      return after !== undefined && after > 10 && after <= 20
    })
    const credits30Plus = censusStudents.filter(s => {
      const after = s.creditsAfterTerm
      return after !== undefined && after > 30
    })
    
    // Calculate by category
    const byCategory = Object.entries(groupStudentsBy(censusStudents, 'category'))
      .filter(([cat]) => cat !== 'Unknown' && cat !== '')
      .map(([category, catStudents]) => ({
        category,
        graduating: catStudents.filter(s => s.graduatingThisTerm).length,
        within10: catStudents.filter(s => {
          const after = s.creditsAfterTerm
          return after !== undefined && after > 0 && after <= 10
        }).length,
        within20: catStudents.filter(s => {
          const after = s.creditsAfterTerm
          return after !== undefined && after > 10 && after <= 20
        }).length,
        continuing: catStudents.filter(s => !s.graduatingThisTerm).length,
        total: catStudents.length,
      }))
      .sort((a, b) => b.total - a.total)
    
    return {
      graduatingThisTerm: graduating.length,
      within10Credits: within10.length,
      within20Credits: within20.length,
      credits30Plus: credits30Plus.length,
      totalStudents: censusStudents.length,
      progressDistribution: [
        { label: 'Graduating', value: graduating.length, color: '#22c55e' },
        { label: '1-10 remaining', value: within10.length, color: '#3b82f6' },
        { label: '11-20 remaining', value: within20.length, color: '#f59e0b' },
        { label: '30+ remaining', value: credits30Plus.length, color: '#ef4444' },
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
 * Hook to get filtered categories with metrics
 */
export function useFilteredCategories() {
  const students = useFilteredStudents()
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
