import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Search, Calculator, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'

const iconMap = {
  LayoutDashboard,
  Search,
  Calculator,
  MessageSquare,
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
