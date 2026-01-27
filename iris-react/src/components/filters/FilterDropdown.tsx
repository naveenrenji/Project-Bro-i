import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterDropdownProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  maxDisplay?: number
}

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
  className,
  maxDisplay = 2,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const selectAll = () => {
    onChange([...options])
  }

  // Display text
  const getDisplayText = () => {
    if (selected.length === 0) return placeholder
    if (selected.length === 1) return selected[0]
    if (selected.length <= maxDisplay) return selected.join(', ')
    return `${selected.length} selected`
  }

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Label */}
      <label className="block text-xs text-text-faint mb-1 font-medium">{label}</label>
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full min-w-[140px] px-3 py-2',
          'bg-surface-glass/50 border border-border-subtle rounded-lg',
          'text-sm text-text-primary hover:bg-surface-glass/70 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-accent-primary/50',
          isOpen && 'ring-2 ring-accent-primary/50'
        )}
      >
        <span className={cn(
          'truncate',
          selected.length === 0 && 'text-text-muted'
        )}>
          {getDisplayText()}
        </span>
        <div className="flex items-center gap-1 ml-2">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-0.5 hover:bg-surface-elevated rounded"
            >
              <X className="h-3 w-3 text-text-muted" />
            </button>
          )}
          <ChevronDown className={cn(
            'h-4 w-4 text-text-muted transition-transform',
            isOpen && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 mt-1 w-full min-w-[180px] max-h-[280px] overflow-auto',
              'bg-surface-elevated border border-border-subtle rounded-lg shadow-lg',
              'py-1'
            )}
          >
            {/* Quick Actions */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-accent-primary hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Clear
              </button>
            </div>

            {/* Options */}
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted">No options</div>
            ) : (
              options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2 text-sm',
                    'hover:bg-surface-glass/50 transition-colors',
                    selected.includes(option) && 'bg-accent-primary/10'
                  )}
                >
                  <span className="truncate">{option}</span>
                  {selected.includes(option) && (
                    <Check className="h-4 w-4 text-accent-primary flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
