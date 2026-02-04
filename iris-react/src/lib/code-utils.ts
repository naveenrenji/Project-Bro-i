/**
 * Code Utilities for Ask Navs AI
 * Provides functions for extracting and processing AI-generated code
 */

// =============================================================================
// CODE EXTRACTION
// =============================================================================

/**
 * Extract JavaScript code from a markdown code block in AI response
 * Handles various formats: ```javascript, ```js, or just ```
 */
export function extractCodeBlock(response: string): string | null {
  // Try to match code block with language specifier
  const patterns = [
    /```(?:javascript|js)\s*\n([\s\S]*?)```/i,
    /```\s*\n([\s\S]*?)```/,
  ]
  
  for (const pattern of patterns) {
    const match = response.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  return null
}

/**
 * Extract multiple code blocks from a response
 */
export function extractAllCodeBlocks(response: string): string[] {
  const blocks: string[] = []
  const pattern = /```(?:javascript|js)?\s*\n([\s\S]*?)```/gi
  
  let match
  while ((match = pattern.exec(response)) !== null) {
    if (match[1]) {
      blocks.push(match[1].trim())
    }
  }
  
  return blocks
}

// =============================================================================
// JSON EXTRACTION
// =============================================================================

/**
 * Extract and parse JSON from an AI response
 * Handles JSON embedded in markdown code blocks or raw JSON
 */
export function extractJSON<T = unknown>(response: string): T | null {
  // Try to extract from code block first
  const codeBlockPatterns = [
    /```(?:json)?\s*\n([\s\S]*?)```/i,
    /```([\s\S]*?)```/,
  ]
  
  for (const pattern of codeBlockPatterns) {
    const match = response.match(pattern)
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim()) as T
      } catch {
        // Continue to next pattern
      }
    }
  }
  
  // Try to find raw JSON object in response
  const jsonPattern = /\{[\s\S]*\}/
  const match = response.match(jsonPattern)
  if (match) {
    try {
      return JSON.parse(match[0]) as T
    } catch {
      // Continue
    }
  }
  
  // Try parsing the entire response as JSON
  try {
    return JSON.parse(response.trim()) as T
  } catch {
    return null
  }
}

// =============================================================================
// TIER 1 RESPONSE PARSING
// =============================================================================

export interface Tier1Response {
  canAnswer: boolean
  confidence: 'high' | 'medium' | 'low'
  answer?: string
  needsComputation: boolean
  reason?: string
}

/**
 * Parse a Tier 1 AI response into structured format
 */
export function parseTier1Response(response: string): Tier1Response | null {
  const parsed = extractJSON<Tier1Response>(response)
  
  if (!parsed) {
    return null
  }
  
  // Validate required fields
  if (typeof parsed.canAnswer !== 'boolean') {
    return null
  }
  
  // Set defaults for optional fields
  return {
    canAnswer: parsed.canAnswer,
    confidence: parsed.confidence || 'medium',
    answer: parsed.answer,
    needsComputation: parsed.needsComputation ?? false,
    reason: parsed.reason,
  }
}

/**
 * Check if Tier 2 fallback is needed based on Tier 1 response
 */
export function needsTier2Fallback(tier1Response: Tier1Response | null): boolean {
  if (!tier1Response) {
    // Failed to parse, try Tier 2
    return true
  }
  
  if (!tier1Response.canAnswer) {
    return true
  }
  
  if (tier1Response.confidence === 'low') {
    return true
  }
  
  if (tier1Response.needsComputation) {
    return true
  }
  
  return false
}

// =============================================================================
// CODE CLEANING
// =============================================================================

/**
 * Clean up AI-generated code before execution
 */
export function cleanCode(code: string): string {
  // Remove any markdown artifacts
  let cleaned = code
    .replace(/^```(?:javascript|js)?\s*$/gm, '')
    .replace(/^```\s*$/gm, '')
    .trim()
  
  // Remove any "return" at the start if the code doesn't have a function wrapper
  // This helps when AI generates just the return statement
  if (!cleaned.includes('function') && !cleaned.includes('=>')) {
    // If code is just an expression, wrap it in a return
    if (!cleaned.startsWith('return ') && !cleaned.includes('\n')) {
      cleaned = `return ${cleaned}`
    }
  }
  
  return cleaned
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Format a number for display
 */
export function formatDisplayNumber(value: unknown): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString()
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(value)
}

/**
 * Check if a response indicates the AI couldn't answer
 */
export function isNonAnswer(response: string): boolean {
  const nonAnswerPhrases = [
    "i don't have",
    "i cannot",
    "i can't",
    "not available",
    "don't have that data",
    "need more information",
    "unable to",
    "insufficient data",
  ]
  
  const lower = response.toLowerCase()
  return nonAnswerPhrases.some(phrase => lower.includes(phrase))
}

// =============================================================================
// DEEPSEEK R1 REASONING EXTRACTION
// =============================================================================

export interface R1ParsedResponse {
  reasoning?: string  // Content from <think> tags
  content: string     // Response with <think> tags removed
}

/**
 * Extract DeepSeek R1's internal reasoning from <think> tags
 * R1 models output chain-of-thought in <think>...</think> before the answer
 */
export function extractR1Reasoning(response: string): R1ParsedResponse {
  // Match <think> tags (case insensitive, may have newlines)
  const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/i)
  
  if (thinkMatch && thinkMatch[1]) {
    const reasoning = thinkMatch[1].trim()
    const content = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    
    return {
      reasoning: reasoning.length > 0 ? reasoning : undefined,
      content
    }
  }
  
  return { content: response }
}

/**
 * Summarize R1 reasoning for display (truncate if too long)
 */
export function summarizeR1Reasoning(reasoning: string, maxLength = 500): string {
  if (reasoning.length <= maxLength) {
    return reasoning
  }
  
  // Find a good break point (sentence or line ending)
  const truncated = reasoning.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const breakPoint = Math.max(lastPeriod, lastNewline)
  
  if (breakPoint > maxLength * 0.5) {
    return truncated.substring(0, breakPoint + 1) + '\n\n[... reasoning continues ...]'
  }
  
  return truncated + '...'
}

/**
 * Generate a human-readable thinking summary from R1 reasoning
 */
export function generateThinkingSummary(reasoning: string): string {
  // Extract key phrases from the reasoning
  const lines = reasoning.split('\n').filter(l => l.trim())
  
  // Look for key action phrases
  const actionPhrases: string[] = []
  
  for (const line of lines.slice(0, 5)) { // First 5 non-empty lines
    const lower = line.toLowerCase()
    if (lower.includes('need to') || 
        lower.includes('i will') || 
        lower.includes('let me') ||
        lower.includes('i should') ||
        lower.includes('first') ||
        lower.includes('then')) {
      actionPhrases.push(line.trim())
    }
  }
  
  if (actionPhrases.length > 0) {
    return actionPhrases[0]
  }
  
  // Default: first line of reasoning
  return lines[0]?.substring(0, 150) || 'Analyzing the question...'
}
