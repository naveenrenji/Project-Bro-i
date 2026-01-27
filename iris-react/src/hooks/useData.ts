import { useEffect } from 'react'
import { useDataStore } from '@/store/dataStore'

/**
 * Hook to access and fetch dashboard data
 */
export function useData() {
  const { data, isLoading, error, fetchData, refreshData } = useDataStore()
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  return {
    data,
    isLoading,
    error,
    refresh: refreshData,
  }
}

/**
 * Hook to get specific KPI data
 */
export function useKPI(key: 'ntr' | 'enrolled' | 'yield' | 'yoyChange') {
  const { data } = useDataStore()
  return data?.kpis[key] ?? null
}

/**
 * Hook to get funnel data
 */
export function useFunnel() {
  const { data } = useDataStore()
  return data?.funnel ?? []
}

/**
 * Hook to get funnel by category
 */
export function useFunnelByCategory(category?: string) {
  const { data } = useDataStore()
  if (!category) return data?.funnelByCategory ?? {}
  return data?.funnelByCategory[category] ?? []
}

/**
 * Hook to get category data
 */
export function useCategories() {
  const { data } = useDataStore()
  return data?.categories ?? []
}

/**
 * Hook to get program data (top or all)
 */
export function usePrograms(all: boolean = false) {
  const { data } = useDataStore()
  if (all) return data?.programsAll ?? data?.programs ?? []
  return data?.programs ?? []
}

/**
 * Hook to get cohort data
 */
export function useCohorts() {
  const { data } = useDataStore()
  return data?.cohorts ?? []
}

/**
 * Hook to get NTR data
 */
export function useNTR() {
  const { data } = useDataStore()
  return data?.ntr ?? null
}

/**
 * Hook to get NTR breakdown for detailed table
 */
export function useNTRBreakdown() {
  const { data } = useDataStore()
  return data?.ntr?.breakdown ?? []
}

/**
 * Hook to get NTR by student type (New vs Current)
 */
export function useNTRByStudentType() {
  const { data } = useDataStore()
  return data?.ntr?.byStudentType ?? []
}

/**
 * Hook to get graduation tracking data
 */
export function useGraduation() {
  const { data } = useDataStore()
  return data?.graduation ?? null
}

/**
 * Hook to get demographics data
 */
export function useDemographics() {
  const { data } = useDataStore()
  return data?.demographics ?? null
}

/**
 * Hook to get YoY comparison data
 */
export function useYoY() {
  const { data } = useDataStore()
  return data?.yoy ?? null
}

/**
 * Hook to get school breakdown
 */
export function useBySchool() {
  const { data } = useDataStore()
  return data?.bySchool ?? []
}

/**
 * Hook to get degree breakdown
 */
export function useByDegree() {
  const { data } = useDataStore()
  return data?.byDegree ?? []
}

/**
 * Hook to get filter options
 */
export function useFilters() {
  const { data } = useDataStore()
  return data?.filters ?? { schools: [], degreeTypes: [], categories: [], programs: [], statuses: [] }
}

/**
 * Hook to get CPC rates reference
 */
export function useCPCRates() {
  const { data } = useDataStore()
  return data?.cpcRates ?? []
}

/**
 * Hook to get historical data
 */
export function useHistorical() {
  const { data } = useDataStore()
  return data?.historical ?? { years: [], applications: [], admits: [], enrollments: [], yields: [] }
}

/**
 * Hook to get enrollment breakdown
 */
export function useEnrollmentBreakdown() {
  const { data } = useDataStore()
  return data?.enrollmentBreakdown ?? { newSlate: 0, continuing: 0, returning: 0, total: 0 }
}

/**
 * Hook to get alerts
 */
export function useAlerts() {
  const { data } = useDataStore()
  return data?.alerts ?? []
}

/**
 * Hook to get insights
 */
export function useInsights() {
  const { data } = useDataStore()
  return data?.insights ?? { topPerformers: [], needsAttention: [] }
}
