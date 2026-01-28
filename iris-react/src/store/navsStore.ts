import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NAVS_PERSONA } from '@/lib/navs-persona'
import { useDataStore, type DashboardData } from './dataStore'
import { formatCurrency, formatNumber } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
  charts?: Array<{
    type: string
    data: unknown
    title: string
  }>
  suggestions?: string[]
}

export interface NavsState {
  // Chat
  messages: ChatMessage[]
  isTyping: boolean
  currentModel: 'gemini' | 'gpt-4o' | 'claude'
  
  // Context
  currentPage: string
  selectedContext: string[]
  
  // History
  conversationSummary: string | null
  
  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  setTyping: (isTyping: boolean) => void
  setModel: (model: 'gemini' | 'gpt-4o' | 'claude') => void
  setCurrentPage: (page: string) => void
  setSelectedContext: (context: string[]) => void
  setSummary: (summary: string | null) => void
  clearMessages: () => void
  sendMessage: (content: string) => Promise<void>
}

// Get API key from environment
const getApiKey = (): string => {
  return import.meta.env.VITE_GEMINI_API_KEY || ''
}

// Build context from dashboard data
function buildContext(data: DashboardData | null): string {
  if (!data) return 'Dashboard data is currently unavailable.'
  
  const lines: string[] = []
  
  // Summary
  lines.push('=== CURRENT DATA CONTEXT ===')
  lines.push('')
  
  // Funnel Summary
  lines.push('## Enrollment Funnel (Spring 2026)')
  if (data.funnel?.length) {
    for (const stage of data.funnel) {
      lines.push(`- ${stage.stage}: ${formatNumber(stage.count)} (${stage.conversionRate}% conversion)`)
    }
  }
  lines.push('')
  
  // NTR Summary
  if (data.ntr) {
    lines.push('## NTR (Net Tuition Revenue)')
    lines.push(`- Total NTR: ${formatCurrency(data.ntr.total)}`)
    lines.push(`- Goal: ${formatCurrency(data.ntr.goal)}`)
    lines.push(`- Progress: ${data.ntr.percentOfGoal?.toFixed(1) || ((data.ntr.total / data.ntr.goal) * 100).toFixed(1)}% of goal`)
    lines.push(`- Gap to Goal: ${formatCurrency(data.ntr.gapToGoal || (data.ntr.goal - data.ntr.total))}`)
    lines.push(`- New Student NTR: ${formatCurrency(data.ntr.newNTR)}`)
    lines.push(`- Current Student NTR: ${formatCurrency(data.ntr.currentNTR)}`)
    lines.push(`- Total Students: ${formatNumber(data.ntr.totalStudents || 0)}`)
    lines.push(`- Total Credits: ${formatNumber(data.ntr.totalCredits || 0)}`)
    lines.push('')
    
    // NTR by Category
    if (data.ntr.byCategory?.length) {
      lines.push('### NTR by Category:')
      for (const cat of data.ntr.byCategory.slice(0, 8)) {
        lines.push(`- ${cat.category} (${cat.degreeType}): ${formatCurrency(cat.ntr)} (${cat.students} students)`)
      }
      lines.push('')
    }
  }
  
  // Enrollment Breakdown
  if (data.enrollmentBreakdown) {
    lines.push('## Enrollment Breakdown')
    lines.push(`- New (from Slate): ${formatNumber(data.enrollmentBreakdown.newSlate)}`)
    lines.push(`- Continuing: ${formatNumber(data.enrollmentBreakdown.continuing)}`)
    lines.push(`- Returning: ${formatNumber(data.enrollmentBreakdown.returning)}`)
    lines.push(`- Total: ${formatNumber(data.enrollmentBreakdown.total)}`)
    lines.push('')
  }
  
  // YoY Comparison
  if (data.yoy) {
    lines.push('## Year-over-Year Comparison (2026 vs 2025)')
    lines.push(`- Applications: ${data.yoy.vsLastYear.appsChange > 0 ? '+' : ''}${data.yoy.vsLastYear.appsChange}%`)
    lines.push(`- Admits: ${data.yoy.vsLastYear.admitsChange > 0 ? '+' : ''}${data.yoy.vsLastYear.admitsChange}%`)
    lines.push(`- Enrollments: ${data.yoy.vsLastYear.enrollmentsChange > 0 ? '+' : ''}${data.yoy.vsLastYear.enrollmentsChange}%`)
    lines.push(`- Yield Change: ${data.yoy.vsLastYear.yieldChange > 0 ? '+' : ''}${data.yoy.vsLastYear.yieldChange} points`)
    lines.push('')
  }
  
  // Categories
  if (data.categories?.length) {
    lines.push('## Performance by Category')
    for (const cat of data.categories) {
      lines.push(`- ${cat.category}: ${cat.applications} apps, ${cat.admits} admits, ${cat.enrollments} enrolled, ${cat.yield}% yield`)
    }
    lines.push('')
  }
  
  // Top Programs
  if (data.programs?.length) {
    lines.push('## Top Programs (by enrollments)')
    for (const prog of data.programs.slice(0, 10)) {
      const yoyStr = prog.yoyChange ? ` (${prog.yoyChange > 0 ? '+' : ''}${prog.yoyChange}% YoY)` : ''
      lines.push(`- ${prog.program} (${prog.school}): ${prog.enrollments} enrolled, ${prog.yield}% yield${yoyStr}`)
    }
    lines.push('')
  }
  
  // Corporate Cohorts
  if (data.cohorts?.length) {
    lines.push('## Corporate Cohorts (top companies)')
    for (const cohort of data.cohorts.slice(0, 5)) {
      lines.push(`- ${cohort.company}: ${cohort.enrollments} enrolled (${cohort.newStudents} new, ${cohort.continuingStudents} continuing)`)
    }
    lines.push('')
  }
  
  // Graduation Tracking
  if (data.graduation) {
    lines.push('## Graduation Tracking')
    lines.push(`- Graduating This Term: ${formatNumber(data.graduation.graduatingThisTerm)}`)
    lines.push(`- Within 10 Credits: ${formatNumber(data.graduation.within10Credits)}`)
    lines.push(`- Within 20 Credits: ${formatNumber(data.graduation.within20Credits || 0)}`)
    lines.push(`- 20+ Credits Remaining: ${formatNumber(data.graduation.credits20Plus)}`)
    lines.push(`- Total Students: ${formatNumber(data.graduation.totalStudents || 0)}`)
    if (data.graduation.retentionRate) {
      lines.push(`- Estimated Retention Rate: ${(data.graduation.retentionRate * 100).toFixed(1)}%`)
      lines.push(`- Projected Continuing: ${formatNumber(data.graduation.projectedContinuing || 0)}`)
    }
    
    // Graduation by category
    if (data.graduation.byCategory?.length) {
      lines.push('### Graduation by Category:')
      for (const cat of data.graduation.byCategory) {
        lines.push(`- ${cat.category}: ${cat.graduating} graduating, ${cat.continuing} continuing (${cat.total} total)`)
      }
    }
    lines.push('')
  }
  
  // School Breakdown
  if (data.bySchool?.length) {
    lines.push('## By School')
    for (const school of data.bySchool) {
      lines.push(`- ${school.school}: ${school.enrollments} enrolled, ${school.yield}% yield`)
    }
    lines.push('')
  }
  
  // Historical
  if (data.historical) {
    lines.push('## Historical Trend')
    for (let i = 0; i < data.historical.years.length; i++) {
      lines.push(`- ${data.historical.years[i]}: ${data.historical.applications[i]} apps, ${data.historical.admits[i]} admits, ${data.historical.enrollments[i]} enrolled`)
    }
    lines.push('')
  }
  
  // Historical by category (for projections)
  if (data.historicalByCategory) {
    lines.push('## Historical Enrollments by Category')
    const histByCat = data.historicalByCategory as Record<string, { years: number[]; enrollments: number[] }>
    for (const [category, hist] of Object.entries(histByCat)) {
      if (hist.enrollments?.length) {
        const enrollStr = hist.years?.map((y, i) => `${y}:${hist.enrollments[i]}`).join(', ') || hist.enrollments.join(', ')
        lines.push(`- ${category}: ${enrollStr}`)
      }
    }
    lines.push('')
  }
  
  lines.push('=== END OF DATA CONTEXT ===')
  lines.push('')
  lines.push('DATA LIMITS: There is no program-level NTR or cohort-level NTR. Do not invent numbers.')
  
  return lines.join('\n')
}

// Generate follow-up suggestions based on the question
function generateSuggestions(question: string): string[] {
  const q = question.toLowerCase()
  
  if (q.includes('ntr') || q.includes('revenue')) {
    return [
      'Break down NTR by student type',
      'Which categories drive the most NTR?',
      'How can we close the gap to goal?',
    ]
  }
  
  if (q.includes('projection') || q.includes('next term') || q.includes('forecast')) {
    return [
      'Are my new student targets realistic?',
      'What attrition rate should I use?',
      'Which categories should I focus on for growth?',
    ]
  }
  
  if (q.includes('graduat')) {
    return [
      'How many students are graduating by category?',
      'What is the projected retention rate?',
      'How does graduation impact next term NTR?',
    ]
  }
  
  if (q.includes('yield')) {
    return [
      'Which programs have the best yield?',
      'How does yield compare to last year?',
      'What can we do to improve retail yield?',
    ]
  }
  
  if (q.includes('program') || q.includes('enroll')) {
    return [
      'Show YoY comparison for top programs',
      'Which programs are declining?',
      'Compare programs by yield rate',
    ]
  }
  
  if (q.includes('corporate') || q.includes('cohort')) {
    return [
      'Which companies have the most students?',
      'How are corporate cohorts performing?',
      'New vs continuing corporate students',
    ]
  }
  
  if (q.includes('cpe') || q.includes('professional education')) {
    return [
      'How is CPE performing vs other categories?',
      'What is the CPE NTR contribution?',
      'Show CPE graduation trends',
    ]
  }
  
  return [
    'How are we tracking against NTR goal?',
    'What should I project for next term?',
    'Which programs need attention?',
  ]
}

// Call Gemini API
async function callGemini(
  question: string,
  context: string,
  history: ChatMessage[]
): Promise<string> {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY not configured. Please add it to your .env file.')
  }
  
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
  
  // Build conversation history
  const historyStr = history.slice(-6).map(m => 
    `${m.role === 'user' ? 'User' : 'Navs'}: ${m.content}`
  ).join('\n\n')
  
  const prompt = `${NAVS_PERSONA.systemPrompt}

${context}

${historyStr ? `\n--- Previous conversation ---\n${historyStr}\n---` : ''}

User: ${question}

Navs:`

  // Retry logic
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      const response = result.response
      const text = response.text()
      
      if (!text) {
        throw new Error('Empty response from AI service')
      }
      
      return text
    } catch (error) {
      lastError = error as Error
      const errorStr = String(error)
      
      // Rate limit - wait and retry
      if (errorStr.includes('429') || errorStr.includes('Too Many Requests')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
      
      // Other errors - throw immediately
      throw error
    }
  }
  
  throw lastError || new Error('AI service unavailable')
}

export const useNavsStore = create<NavsState>()(
  persist(
    (set, get) => ({
      messages: [],
      isTyping: false,
      currentModel: 'gemini',
      currentPage: 'command-center',
      selectedContext: [],
      conversationSummary: null,
      
      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
        }
        set((state) => ({
          messages: [...state.messages, newMessage],
        }))
      },
      
      setTyping: (isTyping) => set({ isTyping }),
      setModel: (currentModel) => set({ currentModel }),
      setCurrentPage: (currentPage) => set({ currentPage }),
      setSelectedContext: (selectedContext) => set({ selectedContext }),
      setSummary: (conversationSummary) => set({ conversationSummary }),
      
      clearMessages: () => set({ 
        messages: [], 
        conversationSummary: null 
      }),
      
      sendMessage: async (content) => {
        const { addMessage, setTyping, messages, currentModel } = get()
        
        // Add user message
        addMessage({ role: 'user', content })
        
        // Set typing indicator
        setTyping(true)
        
        try {
          // Get dashboard data from data store
          const data = useDataStore.getState().data
          
          // Build context
          const context = buildContext(data)
          
          // Call Gemini API
          const response = await callGemini(content, context, messages)
          
          // Generate suggestions
          const suggestions = generateSuggestions(content)
          
          addMessage({
            role: 'assistant',
            content: response,
            model: currentModel,
            suggestions,
          })
        } catch (error) {
          console.error('Error calling Gemini:', error)
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Check if it's a configuration error
          if (errorMessage.includes('API_KEY') || errorMessage.includes('not configured')) {
            addMessage({
              role: 'assistant',
              content: `**Configuration needed:** ${errorMessage}\n\nTo enable AI responses, please create a \`.env\` file in the iris-react directory with:\n\n\`\`\`\nVITE_GEMINI_API_KEY=your_api_key_here\n\`\`\`\n\nYou can get a free API key from [Google AI Studio](https://aistudio.google.com/).`,
            })
          } else {
            addMessage({
              role: 'assistant',
              content: NAVS_PERSONA.errorResponses.apiError,
            })
          }
        } finally {
          setTyping(false)
        }
      },
    }),
    {
      name: 'navs-storage',
      partialize: (state) => ({
        messages: state.messages.slice(-50), // Keep last 50 messages
        currentModel: state.currentModel,
        conversationSummary: state.conversationSummary,
      }),
    }
  )
)
