/**
 * useForecast Hook
 * 
 * Provides forecast data for applications, admits, enrollments, and NTR
 * with support for filtering by category, degree type, and program.
 */

import { useMemo } from 'react'
import { useDataStore } from '@/store/dataStore'
import { useFilterStore, type StudentRecord } from '@/store/filterStore'
import {
  generateForecast,
  forecastByCategory,
  forecastByProgram,
  type ForecastMetrics,
  type ForecastParams,
  type CategoryForecast,
  type ProgramForecast,
} from '@/lib/forecasting'

/**
 * Main forecast hook - returns overall metrics, params, and dynamic cutoff date
 */
export function useForecast() {
  const data = useDataStore((state) => state.data)
  const { categories, schools, degreeTypes } = useFilterStore()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  
  return useMemo(() => {
    if (!data?.students) {
      return {
        metrics: null,
        params: null,
        cutoffDate: null,
        isLoading: true,
      }
    }
    
    let students = data.students as StudentRecord[]
    
    // Apply filters if active
    if (hasFilters) {
      students = students.filter(s => {
        if (categories.length > 0 && !categories.includes(s.category)) return false
        if (schools.length > 0 && !schools.includes(s.school)) return false
        if (degreeTypes.length > 0 && !degreeTypes.includes(s.degreeType)) return false
        return true
      })
    }
    
    // Get average credits and CPC from NTR data if available
    const avgCredits = data.ntr?.totalCredits && data.ntr?.totalStudents
      ? data.ntr.totalCredits / data.ntr.totalStudents
      : 6
    
    const avgCPC = data.ntr?.total && data.ntr?.totalCredits
      ? data.ntr.total / data.ntr.totalCredits
      : 1650
    
    const { metrics, params, cutoffDate } = generateForecast(students, avgCredits, avgCPC)
    
    return {
      metrics,
      params,
      cutoffDate,
      isLoading: false,
    }
  }, [data?.students, data?.ntr, categories, schools, degreeTypes, hasFilters])
}

/**
 * Forecast by category hook
 */
export function useForecastByCategory(): CategoryForecast[] {
  const data = useDataStore((state) => state.data)
  const { categories, schools, degreeTypes } = useFilterStore()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  
  return useMemo(() => {
    if (!data?.students) return []
    
    let students = data.students as StudentRecord[]
    
    // Apply filters if active
    if (hasFilters) {
      students = students.filter(s => {
        if (categories.length > 0 && !categories.includes(s.category)) return false
        if (schools.length > 0 && !schools.includes(s.school)) return false
        if (degreeTypes.length > 0 && !degreeTypes.includes(s.degreeType)) return false
        return true
      })
    }
    
    const avgCredits = data.ntr?.totalCredits && data.ntr?.totalStudents
      ? data.ntr.totalCredits / data.ntr.totalStudents
      : 6
    
    const avgCPC = data.ntr?.total && data.ntr?.totalCredits
      ? data.ntr.total / data.ntr.totalCredits
      : 1650
    
    return forecastByCategory(students, avgCredits, avgCPC)
  }, [data?.students, data?.ntr, categories, schools, degreeTypes, hasFilters])
}

/**
 * Forecast by program hook
 */
export function useForecastByProgram(limit: number = 20): ProgramForecast[] {
  const data = useDataStore((state) => state.data)
  const { categories, schools, degreeTypes } = useFilterStore()
  const hasFilters = useFilterStore((state) => state.hasActiveFilters())
  
  return useMemo(() => {
    if (!data?.students) return []
    
    let students = data.students as StudentRecord[]
    
    // Apply filters if active
    if (hasFilters) {
      students = students.filter(s => {
        if (categories.length > 0 && !categories.includes(s.category)) return false
        if (schools.length > 0 && !schools.includes(s.school)) return false
        if (degreeTypes.length > 0 && !degreeTypes.includes(s.degreeType)) return false
        return true
      })
    }
    
    const avgCredits = data.ntr?.totalCredits && data.ntr?.totalStudents
      ? data.ntr.totalCredits / data.ntr.totalStudents
      : 6
    
    const avgCPC = data.ntr?.total && data.ntr?.totalCredits
      ? data.ntr.total / data.ntr.totalCredits
      : 1650
    
    return forecastByProgram(students, limit, avgCredits, avgCPC)
  }, [data?.students, data?.ntr, categories, schools, degreeTypes, hasFilters, limit])
}

// Re-export types for convenience
export type { ForecastMetrics, ForecastParams, CategoryForecast, ProgramForecast }
