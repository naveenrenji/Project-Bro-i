import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Navigation source labels for Deep Dive breadcrumb
export type DeepDiveSource = 
  | 'ntr-meter' 
  | 'student-metrics' 
  | 'funnel' 
  | 'health-status' 
  | 'performers' 
  | null

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  
  // Command Palette
  commandPaletteOpen: boolean
  
  // Navs Widget
  navsWidgetOpen: boolean
  navsWidgetMinimized: boolean
  
  // Deep Dive
  activeDeepDiveTab: string
  deepDiveSource: DeepDiveSource
  
  // Filters
  selectedYear: string
  selectedCategory: string | null
  selectedSchool: string | null
  selectedDegreeType: string | null
  
  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleCommandPalette: () => void
  toggleNavsWidget: () => void
  setNavsWidgetMinimized: (minimized: boolean) => void
  setActiveDeepDiveTab: (tab: string) => void
  navigateToDeepDive: (tab: string, source: DeepDiveSource) => void
  clearDeepDiveSource: () => void
  setSelectedYear: (year: string) => void
  setSelectedCategory: (category: string | null) => void
  setSelectedSchool: (school: string | null) => void
  setSelectedDegreeType: (degreeType: string | null) => void
  resetFilters: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarOpen: true,
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      navsWidgetOpen: false,
      navsWidgetMinimized: true,
      activeDeepDiveTab: 'revenue',
      deepDiveSource: null,
      selectedYear: '2026',
      selectedCategory: null,
      selectedSchool: null,
      selectedDegreeType: null,
      
      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      toggleNavsWidget: () => set((state) => ({ 
        navsWidgetOpen: !state.navsWidgetOpen,
        navsWidgetMinimized: false,
      })),
      setNavsWidgetMinimized: (minimized) => set({ navsWidgetMinimized: minimized }),
      setActiveDeepDiveTab: (tab) => set({ activeDeepDiveTab: tab }),
      navigateToDeepDive: (tab, source) => set({ activeDeepDiveTab: tab, deepDiveSource: source }),
      clearDeepDiveSource: () => set({ deepDiveSource: null }),
      setSelectedYear: (year) => set({ selectedYear: year }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setSelectedSchool: (school) => set({ selectedSchool: school }),
      setSelectedDegreeType: (degreeType) => set({ selectedDegreeType: degreeType }),
      resetFilters: () => set({
        selectedYear: '2026',
        selectedCategory: null,
        selectedSchool: null,
        selectedDegreeType: null,
      }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeDeepDiveTab: state.activeDeepDiveTab,
      }),
    }
  )
)
