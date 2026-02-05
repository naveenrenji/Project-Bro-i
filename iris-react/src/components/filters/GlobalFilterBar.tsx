import { useEffect, useState } from 'react'
import { Filter, RotateCcw, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FilterDropdown } from './FilterDropdown'
import { useFilterStore } from '@/store/filterStore'
import { useDataStore } from '@/store/dataStore'
import { cn } from '@/lib/utils'

interface GlobalFilterBarProps {
  className?: string
  compact?: boolean
}

export function GlobalFilterBar({ className, compact = false }: GlobalFilterBarProps) {
  const {
    categories,
    schools,
    degreeTypes,
    studentTypes,
    options,
    setCategories,
    setSchools,
    setDegreeTypes,
    setStudentTypes,
    setOptions,
    resetFilters,
    hasActiveFilters,
  } = useFilterStore()

  const data = useDataStore((state) => state.data)

  // Initialize filter options from data
  useEffect(() => {
    if (data?.filters) {
      setOptions({
        categories: data.filters.categories || [],
        schools: data.filters.schools || [],
        degreeTypes: data.filters.degreeTypes || [],
        programs: data.filters.programs || [],
        studentTypes: ['New', 'Current'],
        studentStatuses: data.filters.statuses || ['New', 'Continuing', 'Returning'],
      })
    }
  }, [data?.filters, setOptions])

  const activeFilterCount = [
    categories,
    schools,
    degreeTypes,
    studentTypes,
  ].filter(arr => arr.length > 0).length

  if (compact) {
    return (
      <CompactFilterBar
        activeCount={activeFilterCount}
        onReset={resetFilters}
        className={className}
      />
    )
  }

  return (
    <div className={cn(
      'flex flex-wrap items-end gap-3 p-3 bg-surface-glass/30 rounded-xl border border-border-subtle',
      className
    )}>
      {/* Filter Icon */}
      <div className="flex items-center gap-2 text-text-muted">
        <Filter className="h-4 w-4" />
        <span className="text-xs font-medium">Filters</span>
      </div>

      {/* Category Filter */}
      <FilterDropdown
        label="Category"
        options={options.categories}
        selected={categories}
        onChange={setCategories}
        placeholder="All Categories"
      />

      {/* School Filter */}
      <FilterDropdown
        label="School"
        options={options.schools}
        selected={schools}
        onChange={setSchools}
        placeholder="All Schools"
      />

      {/* Degree Type Filter */}
      <FilterDropdown
        label="Degree"
        options={options.degreeTypes}
        selected={degreeTypes}
        onChange={setDegreeTypes}
        placeholder="All Degrees"
      />

      {/* Student Type Filter */}
      <FilterDropdown
        label="Student Type"
        options={options.studentTypes}
        selected={studentTypes}
        onChange={setStudentTypes}
        placeholder="New + Current"
      />

      {/* Reset Button */}
      <AnimatePresence>
        {hasActiveFilters() && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            type="button"
            onClick={resetFilters}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 mt-5',
              'text-xs text-text-muted hover:text-text-primary',
              'bg-surface-glass/50 hover:bg-surface-glass/70',
              'border border-border-subtle rounded-lg transition-colors'
            )}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </motion.button>
        )}
      </AnimatePresence>

      {/* Active Filter Count Badge */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-accent-primary/20 text-accent-primary rounded-full text-xs font-medium">
          {activeFilterCount} active
        </div>
      )}
    </div>
  )
}

// Compact version for tight spaces
function CompactFilterBar({
  activeCount,
  onReset: _onReset,
  className,
}: {
  activeCount: number
  onReset: () => void
  className?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-2',
          'bg-surface-glass/50 border border-border-subtle rounded-lg',
          'text-sm text-text-primary hover:bg-surface-glass/70 transition-colors'
        )}
      >
        <Filter className="h-4 w-4" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-accent-primary text-white text-xs rounded-full">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn(
          'h-4 w-4 transition-transform',
          isExpanded && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 z-50"
          >
            <GlobalFilterBar compact={false} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

