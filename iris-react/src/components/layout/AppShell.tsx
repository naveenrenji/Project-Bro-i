import { Outlet, useLocation } from 'react-router-dom'
import { Navigation } from './Navigation'
import { NavsWidget } from '../navs/NavsWidget'
import { GlobalFilterBar } from '../filters/GlobalFilterBar'

export function AppShell() {
  const location = useLocation()
  
  // Show filter bar on data-heavy pages (not on AskNavs)
  const showFilterBar = location.pathname !== '/ask-navs'
  
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      <Navigation />
      
      {/* Main Content */}
      <main className="pt-16 min-h-screen">
        <div className="p-6">
          {/* Global Filter Bar */}
          {showFilterBar && (
            <div className="mb-6">
              <GlobalFilterBar />
            </div>
          )}
          
          <Outlet />
        </div>
      </main>
      
      {/* Floating Navs Widget */}
      <NavsWidget />
    </div>
  )
}
