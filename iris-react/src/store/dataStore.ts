import { create } from 'zustand'

// Types for dashboard data
export interface KPIData {
  label: string
  value: number
  previousValue?: number
  format: 'currency' | 'number' | 'percent'
  trend?: number[]
}

export interface FunnelStage {
  stage: string
  count: number
  conversionRate?: number
}

export interface CategoryData {
  category: string
  applications: number
  admits: number
  enrollments: number
  yield: number
  ntr?: number
}

export interface ProgramData {
  program: string
  school: string
  degreeType: string
  category?: string
  applications: number
  admits: number
  accepted?: number
  enrollments: number
  yield: number
  admitRate?: number
  yoyChange?: number
  yoyEnrollChange?: number
  prevApps?: number
  prevEnrolls?: number
}

export interface CohortData {
  company: string
  enrollments: number
  applications?: number
  newStudents: number
  continuingStudents: number
}

export interface NTRBreakdownRow {
  category: string
  degreeType: string
  newStudents: number
  currentStudents: number
  totalStudents: number
  newCredits: number
  currentCredits: number
  totalCredits: number
  cpcNew: number
  cpcCurrent: number
  ntrNew: number
  ntrCurrent: number
  totalNtr: number
}

export interface NTRData {
  total: number
  goal: number
  percentOfGoal: number
  gapToGoal: number
  newNTR: number
  currentNTR: number
  newStudents: number
  currentStudents: number
  newCredits: number
  currentCredits: number
  totalStudents: number
  totalCredits: number
  byCategory: Array<{
    category: string
    degreeType: string
    ntr: number
    students: number
    credits: number
  }>
  breakdown: NTRBreakdownRow[]
  byStudentType: Array<{
    type: string
    ntr: number
    students: number
    credits: number
  }>
}

export interface GraduationData {
  graduatingThisTerm: number
  within10Credits: number
  within20Credits: number
  credits20Plus: number
  totalStudents: number
  progressDistribution: Array<{
    label: string
    value: number
    color: string
  }>
  graduatingStudents: Array<{
    name?: string
    program: string
    category?: string
    remaining?: number
    creditsRemaining?: number
    thisTerm?: number
    creditsThisTerm?: number
    afterTerm?: number
    creditsAfterTerm?: number
    willGraduate?: boolean
  }>
  byCategory?: Array<{
    category: string
    graduating: number
    within10: number
    within20: number
    continuing: number
    total: number
  }>
  retentionRate?: number
  projectedContinuing?: number
}

export interface YoYData {
  current: { apps: number; admits: number; enrollments: number; yield: number }
  previous: { apps: number; admits: number; enrollments: number; yield: number }
  twoYearsAgo: { apps: number; admits: number; enrollments: number; yield: number }
  vsLastYear: {
    appsChange: number
    admitsChange: number
    enrollmentsChange: number
    yieldChange: number
  }
  vsTwoYearsAgo: {
    appsChange: number
    admitsChange: number
    enrollmentsChange: number
    yieldChange: number
  }
}

export interface SchoolData {
  school: string
  applications: number
  admits: number
  enrollments: number
  yield: number
}

export interface DegreeData {
  degreeType: string
  applications: number
  admits: number
  enrollments: number
  yield: number
}

export interface FiltersData {
  schools: string[]
  degreeTypes: string[]
  categories: string[]
  programs: string[]
  statuses: string[]
}

export interface DemographicsData {
  totalStudents: number
  domesticInternational: Array<{
    status: string
    count: number
    percentage: number
  }>
  raceEthnicity: Array<{
    race: string
    count: number
    percentage: number
  }>
  ageDistribution: {
    mean: number
    median: number
    min: number
    max: number
    under25: number
    '25to34': number
    '35to44': number
    '45to54': number
    '55plus': number
  }
  gpaDistribution: {
    mean: number
    median: number
    below2: number
    '2to25': number
    '25to3': number
    '3to35': number
    '35to4': number
  }
  topStates: Array<{
    state: string
    count: number
    percentage: number
  }>
  topCountries: Array<{
    country: string
    count: number
    percentage: number
  }>
}

export interface CPCRate {
  category: string
  degreeType: string
  studentType: string
  rate: number
}

// Student record for client-side filtering
export interface StudentRecord {
  id: string
  source: 'slate' | 'census'
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

export interface DashboardData {
  // Metadata
  lastUpdated: string
  semester?: string
  
  // Student-level data for filtering
  students?: StudentRecord[]
  
  // Pre-aggregated summaries for fast load
  summaries?: {
    overall: {
      applications: number
      admits: number
      accepted: number
      enrollments: number
      yield: number
    }
    byCategory: Record<string, { applications: number; admits: number; accepted: number; enrollments: number; yield: number }>
    bySchool: Record<string, { applications: number; admits: number; accepted: number; enrollments: number; yield: number }>
    byDegree: Record<string, { applications: number; admits: number; accepted: number; enrollments: number; yield: number }>
    byProgram: Record<string, { applications: number; admits: number; accepted: number; enrollments: number; yield: number }>
  }
  
  // Summary KPIs
  kpis: {
    ntr: KPIData
    enrolled: KPIData
    yield: KPIData
    yoyChange: KPIData
  }
  
  // Funnel
  funnel: FunnelStage[]
  funnelByCategory: Record<string, FunnelStage[]>
  
  // Categories
  categories: CategoryData[]
  
  // Programs
  programs: ProgramData[]
  programsAll?: ProgramData[]
  
  // Cohorts
  cohorts: CohortData[]
  
  // NTR (enhanced)
  ntr: NTRData
  
  // Historical
  historical: {
    years: string[]
    applications: number[]
    admits: number[]
    enrollments: number[]
    yields?: number[]
  }
  
  // Historical by category (for projections)
  historicalByCategory?: Record<string, {
    years: number[]
    applications: number[]
    enrollments: number[]
  }>
  
  // Enrollment Breakdown
  enrollmentBreakdown: {
    newSlate: number
    continuing: number
    returning: number
    total: number
  }
  
  // Graduation Tracking
  graduation?: GraduationData
  
  // Demographics
  demographics?: DemographicsData
  
  // YoY Comparison
  yoy?: YoYData
  
  // Breakdowns
  bySchool?: SchoolData[]
  byDegree?: DegreeData[]
  
  // Filters
  filters?: FiltersData
  
  // CPC Rates Reference
  cpcRates?: CPCRate[]
  
  // Alerts (AI-generated)
  alerts: Array<{
    type: 'warning' | 'success' | 'info'
    message: string
    metric?: string
    value?: number
  }>
  
  // Insights (AI-generated)
  insights: {
    topPerformers: Array<{ label: string; value: string }>
    needsAttention: Array<{ label: string; value: string }>
  }
}

interface DataState {
  data: DashboardData | null
  isLoading: boolean
  error: string | null
  lastFetched: Date | null
  
  // Actions
  setData: (data: DashboardData) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchData: (forceRefresh?: boolean) => Promise<void>
  refreshData: () => Promise<void>
}

export const useDataStore = create<DataState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastFetched: null,
  
  setData: (data) => set({ data, lastFetched: new Date() }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  fetchData: async (forceRefresh = false) => {
    const { isLoading, lastFetched } = get()
    
    // Don't fetch if already loading
    if (isLoading) return
    
    // Skip if recently fetched (within 5 min) unless force refresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched.getTime() < 5 * 60 * 1000) return
    
    set({ isLoading: true, error: null })
    
    try {
      // Fetch from static JSON file with cache-busting for refresh
      const url = forceRefresh 
        ? `/data/dashboard.json?t=${Date.now()}` 
        : '/data/dashboard.json'
      
      const response = await fetch(url, {
        cache: forceRefresh ? 'no-store' : 'default'
      })
      
      if (response.ok) {
        const data = await response.json()
        set({ data, isLoading: false, lastFetched: new Date() })
        if (forceRefresh) {
          console.log('Data refreshed at', new Date().toLocaleTimeString())
        }
      } else {
        throw new Error('Failed to load dashboard data')
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      set({ error: 'Failed to load data', isLoading: false })
    }
  },
  
  refreshData: async () => {
    // First, trigger the Python script to process fresh data from source files
    try {
      console.log('🔄 Triggering data processing from source files...')
      const response = await fetch('/api/refresh', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ Data processing complete:', result.message)
      } else {
        console.warn('⚠️ Data processing API not available, loading existing data')
      }
    } catch (error) {
      // API might not be available (e.g., in production), just log and continue
      console.warn('⚠️ Data processing API not available:', error)
    }
    
    // Then fetch the (newly processed) data
    await get().fetchData(true)
  },
}))
