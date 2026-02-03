import React from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Search, Calculator, MessageSquare, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import { useDataStore } from '@/store/dataStore'

const iconMap = {
  LayoutDashboard,
  Search,
  Calculator,
  MessageSquare,
}

// Format relative time
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never'
  
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  
  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

function RefreshButton() {
  const { fetchData, isLoading, lastFetched } = useDataStore()
  const [refreshStep, setRefreshStep] = React.useState<'idle' | 'pulling' | 'processing' | 'done' | 'error'>('idle')
  const [refreshResult, setRefreshResult] = React.useState<{ pullSuccess?: boolean; message?: string } | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = React.useState<Date | null>(lastFetched)
  
  // Update local state when store updates
  React.useEffect(() => {
    setLastRefreshTime(lastFetched)
  }, [lastFetched])
  
  const handleRefresh = async () => {
    try {
      setRefreshStep('pulling')
      
      // First call the API to pull and process data
      const response = await fetch('/api/refresh', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const result = await response.json()
        setRefreshResult(result)
        setRefreshStep('done')
        
        // Then fetch the updated data into the store
        await fetchData(true)
      } else {
        setRefreshStep('error')
        setRefreshResult({ message: 'Refresh failed' })
      }
      
      // Reset after 3 seconds
      setTimeout(() => {
        setRefreshStep('idle')
        setRefreshResult(null)
      }, 3000)
    } catch (error) {
      console.error('Refresh failed:', error)
      setRefreshStep('error')
      setRefreshResult({ message: 'Connection error' })
      setTimeout(() => {
        setRefreshStep('idle')
        setRefreshResult(null)
      }, 3000)
    }
  }
  
  const getStatusText = () => {
    switch (refreshStep) {
      case 'pulling': return 'Pulling data...'
      case 'processing': return 'Processing...'
      case 'done': return 'Updated!'
      case 'error': return 'Failed'
      default: return 'Refresh'
    }
  }
  
  const isRefreshing = refreshStep === 'pulling' || refreshStep === 'processing' || isLoading
  const showSuccess = refreshStep === 'done'
  const showError = refreshStep === 'error'
  
  return (
    <div className="relative">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
          'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]',
          'hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-default)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          showSuccess && 'border-[var(--color-success)] bg-[var(--color-success)]/10',
          showError && 'border-[var(--color-danger)] bg-[var(--color-danger)]/10'
        )}
      >
        <RefreshCw className={cn(
          'h-3.5 w-3.5',
          isRefreshing && 'animate-spin text-[var(--color-accent-primary)]',
          showSuccess ? 'text-[var(--color-success)]' : 
          showError ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'
        )} />
        <div className="hidden sm:flex flex-col items-start">
          <span className={cn(
            showSuccess ? 'text-[var(--color-success)]' : 
            showError ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'
          )}>
            {getStatusText()}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {formatRelativeTime(lastRefreshTime)}
          </span>
        </div>
      </button>
      
      {/* Success toast with details */}
      {showSuccess && refreshResult && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[var(--color-success)]/20 border border-[var(--color-success)]/30 rounded-lg text-xs text-[var(--color-success)] whitespace-nowrap animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-1">
            <span>✓</span>
            <span>{refreshResult.pullSuccess ? 'Fresh data pulled & processed' : 'Processed existing data'}</span>
          </div>
        </div>
      )}
      
      {/* Error toast */}
      {showError && refreshResult && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[var(--color-danger)]/20 border border-[var(--color-danger)]/30 rounded-lg text-xs text-[var(--color-danger)] whitespace-nowrap animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-1">
            <span>✗</span>
            <span>{refreshResult.message || 'Refresh failed'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)]">
            <span className="text-lg font-bold text-white">I</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-white">Project Iris</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Stevens CPE Intelligence</p>
          </div>
        </div>
        
        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap]
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                    'hover:bg-[var(--color-bg-surface)]',
                    isActive
                      ? 'text-white'
                      : 'text-[var(--color-text-secondary)] hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="hidden md:inline">{item.label}</span>
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
        
        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Refresh Button with Last Update Time */}
          <RefreshButton />
          
          {/* Keyboard Shortcut Hint */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <kbd className="rounded bg-[var(--color-bg-surface)] px-2 py-1 font-mono">⌘K</kbd>
            <span>Quick actions</span>
          </div>
          
          {/* User Avatar Placeholder */}
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] flex items-center justify-center">
            <span className="text-xs font-medium text-white">U</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
