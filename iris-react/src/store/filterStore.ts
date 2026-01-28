import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Student record type for filtering
export interface StudentRecord {
  id: string
  source: 'slate' | 'census'
  year?: string  // '2024', '2025', '2026'
  category: string
  school: string
  degreeType: string
  program: string
  studentType: 'New' | 'Current' | string
  studentStatus: string
  funnelStage?: 'application' | 'admitted' | 'accepted' | 'enrolled'
  credits?: number
  creditsRemaining?: number
  creditsAfterTerm?: number
  graduatingThisTerm?: boolean
  cpcRate?: number
  ntr?: number
  domesticInternational?: string
  state?: string
  country?: string
  canvasLastLogin?: string
  canvasWeeksSinceLogin?: number
  company?: string
}

export interface FilterOptions {
  categories: string[]
  schools: string[]
  degreeTypes: string[]
  programs: string[]
  studentTypes: string[]
  studentStatuses: string[]
}

interface FilterState {
  // Active filters (multi-select)
  year: number
  semester: 'Spring' | 'Summer' | 'Fall'
  categories: string[]
  schools: string[]
  degreeTypes: string[]
  programs: string[]
  studentTypes: string[]
  funnelStages: string[]
  
  // Filter options (derived from data)
  options: FilterOptions
  
  // Filter mode
  filterMode: 'all' | 'any' // Match all filters or any filter
  
  // Actions
  setYear: (year: number) => void
  setSemester: (semester: 'Spring' | 'Summer' | 'Fall') => void
  setCategories: (categories: string[]) => void
  toggleCategory: (category: string) => void
  setSchools: (schools: string[]) => void
  toggleSchool: (school: string) => void
  setDegreeTypes: (degreeTypes: string[]) => void
  toggleDegreeType: (degreeType: string) => void
  setPrograms: (programs: string[]) => void
  toggleProgram: (program: string) => void
  setStudentTypes: (studentTypes: string[]) => void
  toggleStudentType: (studentType: string) => void
  setFunnelStages: (stages: string[]) => void
  toggleFunnelStage: (stage: string) => void
  setFilterMode: (mode: 'all' | 'any') => void
  setOptions: (options: FilterOptions) => void
  resetFilters: () => void
  hasActiveFilters: () => boolean
}

const DEFAULT_STATE = {
  year: 2026,
  semester: 'Spring' as const,
  categories: [] as string[],
  schools: [] as string[],
  degreeTypes: [] as string[],
  programs: [] as string[],
  studentTypes: [] as string[],
  funnelStages: [] as string[],
  filterMode: 'all' as const,
  options: {
    categories: [],
    schools: [],
    degreeTypes: [],
    programs: [],
    studentTypes: ['New', 'Current'],
    studentStatuses: ['New', 'Continuing', 'Returning'],
  },
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      
      // Actions
      setYear: (year) => set({ year }),
      setSemester: (semester) => set({ semester }),
      
      setCategories: (categories) => set({ categories }),
      toggleCategory: (category) => set((state) => ({
        categories: state.categories.includes(category)
          ? state.categories.filter(c => c !== category)
          : [...state.categories, category]
      })),
      
      setSchools: (schools) => set({ schools }),
      toggleSchool: (school) => set((state) => ({
        schools: state.schools.includes(school)
          ? state.schools.filter(s => s !== school)
          : [...state.schools, school]
      })),
      
      setDegreeTypes: (degreeTypes) => set({ degreeTypes }),
      toggleDegreeType: (degreeType) => set((state) => ({
        degreeTypes: state.degreeTypes.includes(degreeType)
          ? state.degreeTypes.filter(d => d !== degreeType)
          : [...state.degreeTypes, degreeType]
      })),
      
      setPrograms: (programs) => set({ programs }),
      toggleProgram: (program) => set((state) => ({
        programs: state.programs.includes(program)
          ? state.programs.filter(p => p !== program)
          : [...state.programs, program]
      })),
      
      setStudentTypes: (studentTypes) => set({ studentTypes }),
      toggleStudentType: (studentType) => set((state) => ({
        studentTypes: state.studentTypes.includes(studentType)
          ? state.studentTypes.filter(t => t !== studentType)
          : [...state.studentTypes, studentType]
      })),
      
      setFunnelStages: (funnelStages) => set({ funnelStages }),
      toggleFunnelStage: (stage) => set((state) => ({
        funnelStages: state.funnelStages.includes(stage)
          ? state.funnelStages.filter(s => s !== stage)
          : [...state.funnelStages, stage]
      })),
      
      setFilterMode: (filterMode) => set({ filterMode }),
      
      setOptions: (options) => set({ options }),
      
      resetFilters: () => set({
        categories: [],
        schools: [],
        degreeTypes: [],
        programs: [],
        studentTypes: [],
        funnelStages: [],
      }),
      
      hasActiveFilters: () => {
        const state = get()
        return (
          state.categories.length > 0 ||
          state.schools.length > 0 ||
          state.degreeTypes.length > 0 ||
          state.programs.length > 0 ||
          state.studentTypes.length > 0 ||
          state.funnelStages.length > 0
        )
      },
    }),
    {
      name: 'filter-storage',
      partialize: (state) => ({
        year: state.year,
        semester: state.semester,
        // Don't persist filter selections - start fresh each session
      }),
    }
  )
)

/**
 * Filter a list of student records based on current filter state
 */
export function filterStudents(
  students: StudentRecord[],
  filters: Pick<FilterState, 'categories' | 'schools' | 'degreeTypes' | 'programs' | 'studentTypes' | 'funnelStages' | 'filterMode'>
): StudentRecord[] {
  const { categories, schools, degreeTypes, programs, studentTypes, funnelStages, filterMode } = filters
  
  // If no filters are active, return all students
  if (
    categories.length === 0 &&
    schools.length === 0 &&
    degreeTypes.length === 0 &&
    programs.length === 0 &&
    studentTypes.length === 0 &&
    funnelStages.length === 0
  ) {
    return students
  }
  
  return students.filter(student => {
    const checks: boolean[] = []
    
    if (categories.length > 0) {
      checks.push(categories.includes(student.category))
    }
    
    if (schools.length > 0) {
      checks.push(schools.includes(student.school))
    }
    
    if (degreeTypes.length > 0) {
      checks.push(degreeTypes.includes(student.degreeType))
    }
    
    if (programs.length > 0) {
      checks.push(programs.includes(student.program))
    }
    
    if (studentTypes.length > 0) {
      checks.push(studentTypes.includes(student.studentType))
    }
    
    if (funnelStages.length > 0 && student.funnelStage) {
      checks.push(funnelStages.includes(student.funnelStage))
    }
    
    // If no checks were made, include the student
    if (checks.length === 0) return true
    
    // Apply filter mode
    return filterMode === 'all' 
      ? checks.every(Boolean)
      : checks.some(Boolean)
  })
}

/**
 * Calculate aggregated metrics from filtered student records
 */
export function aggregateStudentMetrics(students: StudentRecord[]) {
  const slateStudents = students.filter(s => s.source === 'slate')
  const censusStudents = students.filter(s => s.source === 'census')
  
  // Funnel metrics from Slate
  const applications = slateStudents.length
  const admits = slateStudents.filter(s => s.funnelStage === 'admitted' || s.funnelStage === 'accepted' || s.funnelStage === 'enrolled').length
  const accepted = slateStudents.filter(s => s.funnelStage === 'accepted' || s.funnelStage === 'enrolled').length
  const enrolled = slateStudents.filter(s => s.funnelStage === 'enrolled').length
  
  // NTR metrics from Census
  const totalNTR = censusStudents.reduce((sum, s) => sum + (s.ntr || 0), 0)
  const totalCredits = censusStudents.reduce((sum, s) => sum + (s.credits || 0), 0)
  const newStudents = censusStudents.filter(s => s.studentType === 'New').length
  const currentStudents = censusStudents.filter(s => s.studentType === 'Current').length
  
  // Graduation metrics
  const graduating = censusStudents.filter(s => s.graduatingThisTerm).length
  const within10Credits = censusStudents.filter(s => {
    const after = s.creditsAfterTerm
    return after !== undefined && after > 0 && after <= 10
  }).length
  
  return {
    funnel: {
      applications,
      admits,
      accepted,
      enrolled,
      admitRate: applications > 0 ? (admits / applications) * 100 : 0,
      yieldRate: admits > 0 ? (enrolled / admits) * 100 : 0,
    },
    enrollment: {
      total: censusStudents.length,
      newStudents,
      currentStudents,
    },
    ntr: {
      total: totalNTR,
      credits: totalCredits,
    },
    graduation: {
      graduating,
      within10Credits,
      continuing: censusStudents.length - graduating,
    },
  }
}

/**
 * Group students by a specific field
 */
export function groupStudentsBy<K extends keyof StudentRecord>(
  students: StudentRecord[],
  field: K
): Record<string, StudentRecord[]> {
  return students.reduce((acc, student) => {
    const key = String(student[field] || 'Unknown')
    if (!acc[key]) acc[key] = []
    acc[key].push(student)
    return acc
  }, {} as Record<string, StudentRecord[]>)
}
