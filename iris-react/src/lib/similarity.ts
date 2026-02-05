/**
 * Similarity Search Module
 * Provides semantic and keyword-based similarity matching for the knowledge base
 */

import { 
  getAllKnowledgeEntries, 
  touchKnowledgeEntry,
  getCachedEmbedding,
  cacheEmbedding,
  type KnowledgeEntry 
} from './indexed-db'
import { generateEmbedding, isEmbeddingModelAvailable } from './llm-provider'

// =============================================================================
// TYPES
// =============================================================================

export interface SimilarityMatch {
  entry: KnowledgeEntry
  similarity: number
  matchType: 'semantic' | 'keyword'
}

export interface SearchResult {
  matches: SimilarityMatch[]
  searchType: 'semantic' | 'keyword' | 'none'
  duration: number
}

// =============================================================================
// COSINE SIMILARITY
// =============================================================================

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  if (a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0
  
  return dotProduct / magnitude
}

// =============================================================================
// KEYWORD SIMILARITY (Fallback)
// =============================================================================

/**
 * Normalize text for keyword matching
 */
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2) // Skip short words
}

/**
 * Extract key terms from a question
 */
function extractKeyTerms(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'were', 'being',
    'what', 'when', 'where', 'which', 'who', 'how', 'why', 'this', 'that',
    'with', 'from', 'they', 'will', 'would', 'could', 'should', 'there',
    'their', 'about', 'into', 'than', 'then', 'some', 'such', 'only',
    'tell', 'show', 'give', 'find', 'many', 'much', 'more', 'most'
  ])
  
  const words = normalizeText(text)
  return new Set(words.filter(word => !stopWords.has(word)))
}

/**
 * Calculate keyword similarity using Jaccard index
 */
export function keywordSimilarity(text1: string, text2: string): number {
  const terms1 = extractKeyTerms(text1)
  const terms2 = extractKeyTerms(text2)
  
  if (terms1.size === 0 || terms2.size === 0) return 0
  
  const intersection = new Set([...terms1].filter(x => terms2.has(x)))
  const union = new Set([...terms1, ...terms2])
  
  return intersection.size / union.size
}

// =============================================================================
// SEMANTIC SEARCH
// =============================================================================

/**
 * Get or generate embedding for a question
 * Uses cache to avoid recomputing embeddings
 */
async function getQuestionEmbedding(question: string): Promise<number[]> {
  // Check cache first
  const cached = await getCachedEmbedding(question)
  if (cached && cached.length > 0) {
    return cached
  }
  
  // Generate new embedding
  const embedding = await generateEmbedding(question)
  
  // Cache it if successful
  if (embedding.length > 0) {
    await cacheEmbedding(question, embedding)
  }
  
  return embedding
}

/**
 * Search knowledge base using semantic similarity
 */
export async function semanticSearch(
  question: string,
  threshold: number = 0.85
): Promise<SimilarityMatch[]> {
  // Get embedding for the question
  const queryEmbedding = await getQuestionEmbedding(question)
  
  if (queryEmbedding.length === 0) {
    // Embedding failed, return empty (caller should fallback to keyword)
    return []
  }
  
  // Get all active knowledge entries
  const entries = await getAllKnowledgeEntries()
  
  // Calculate similarity for each entry
  const matches: SimilarityMatch[] = entries
    .map(entry => ({
      entry,
      similarity: cosineSimilarity(queryEmbedding, entry.embedding),
      matchType: 'semantic' as const
    }))
    .filter(match => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
  
  return matches
}

/**
 * Search knowledge base using keyword similarity
 */
export async function keywordSearch(
  question: string,
  threshold: number = 0.4
): Promise<SimilarityMatch[]> {
  const entries = await getAllKnowledgeEntries()
  
  const matches: SimilarityMatch[] = entries
    .map(entry => ({
      entry,
      similarity: keywordSimilarity(question, entry.question),
      matchType: 'keyword' as const
    }))
    .filter(match => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
  
  return matches
}

// =============================================================================
// UNIFIED SEARCH
// =============================================================================

/**
 * Search knowledge base with automatic fallback
 * 1. Try semantic search first (if embedding model available)
 * 2. Fall back to keyword search if semantic fails or returns no results
 */
export async function searchKnowledgeBase(
  question: string,
  options: {
    semanticThreshold?: number
    keywordThreshold?: number
    maxResults?: number
  } = {}
): Promise<SearchResult> {
  const {
    semanticThreshold = 0.85,
    keywordThreshold = 0.4,
    maxResults = 5
  } = options
  
  const startTime = performance.now()
  
  // Check if embedding model is available
  const embeddingAvailable = await isEmbeddingModelAvailable()
  
  if (embeddingAvailable) {
    // Try semantic search first
    const semanticMatches = await semanticSearch(question, semanticThreshold)
    
    if (semanticMatches.length > 0) {
      // Touch accessed entries (update access time)
      await Promise.all(
        semanticMatches.slice(0, maxResults).map(m => touchKnowledgeEntry(m.entry.id))
      )
      
      return {
        matches: semanticMatches.slice(0, maxResults),
        searchType: 'semantic',
        duration: performance.now() - startTime
      }
    }
  }
  
  // Fall back to keyword search
  const keywordMatches = await keywordSearch(question, keywordThreshold)
  
  if (keywordMatches.length > 0) {
    // Touch accessed entries
    await Promise.all(
      keywordMatches.slice(0, maxResults).map(m => touchKnowledgeEntry(m.entry.id))
    )
    
    return {
      matches: keywordMatches.slice(0, maxResults),
      searchType: 'keyword',
      duration: performance.now() - startTime
    }
  }
  
  return {
    matches: [],
    searchType: 'none',
    duration: performance.now() - startTime
  }
}

/**
 * Find the best matching cached answer for a question
 * Returns null if no good match found
 */
export async function findCachedAnswer(
  question: string,
  threshold: number = 0.85
): Promise<{
  entry: KnowledgeEntry
  similarity: number
  matchType: 'semantic' | 'keyword'
} | null> {
  const result = await searchKnowledgeBase(question, {
    semanticThreshold: threshold,
    keywordThreshold: 0.5, // Higher threshold for keyword to ensure relevance
    maxResults: 1
  })
  
  if (result.matches.length > 0) {
    return result.matches[0]
  }
  
  return null
}

// =============================================================================
// REFERENCE DETECTION
// =============================================================================

/**
 * Patterns that indicate a reference to previous conversation
 */
const REFERENCE_PATTERNS = [
  /\btop\s+(\d+)\b/i,                    // "top 3", "top 5"
  /\bthose\s+(states?|programs?|schools?|students?)\b/i,
  /\bthat\s+(number|total|list|data|result)\b/i,
  /\bthe\s+same\b/i,
  /\bbreak(?:down|\s+it\s+down)\b/i,
  /\bmore\s+details?\b/i,
  /\babove\b/i,
  /\bprevious(?:ly)?\b/i,
  /\bearlier\b/i,
  /\bmentioned\b/i,
  /\bjust\s+(?:said|showed|listed)\b/i,
  /\bthese\s+\w+s?\b/i,                  // "these programs", "these students"
]

/**
 * Detect if a question contains references to previous context
 */
export function detectReferences(question: string): {
  hasReferences: boolean
  patterns: string[]
} {
  const matchedPatterns: string[] = []
  
  for (const pattern of REFERENCE_PATTERNS) {
    const match = question.match(pattern)
    if (match) {
      matchedPatterns.push(match[0])
    }
  }
  
  return {
    hasReferences: matchedPatterns.length > 0,
    patterns: matchedPatterns
  }
}

/**
 * Find relevant previous results for context injection
 * Returns the most recent result with computed data that matches the reference
 */
export async function findRelevantContext(
  question: string,
  recentEntries: KnowledgeEntry[]
): Promise<KnowledgeEntry | null> {
  const { hasReferences } = detectReferences(question)
  
  if (!hasReferences || recentEntries.length === 0) {
    return null
  }
  
  // Sort by most recent
  const sorted = [...recentEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  // Find first entry with meaningful computed data
  for (const entry of sorted) {
    if (entry.computedData && 
        entry.computedData.entities && 
        entry.computedData.entities.length > 0) {
      return entry
    }
  }
  
  // Fall back to most recent entry
  return sorted[0]
}

/**
 * Inject previous context into a question for the LLM
 */
export function injectPreviousContext(
  question: string,
  previousEntry: KnowledgeEntry
): string {
  const { computedData } = previousEntry
  
  let contextStr = `\n\n[Context from previous query: "${previousEntry.question}"]`
  
  if (computedData) {
    if (computedData.entities && computedData.entities.length > 0) {
      contextStr += `\n- Entities: ${computedData.entities.slice(0, 10).join(', ')}`
    }
    
    if (computedData.values && Object.keys(computedData.values).length > 0) {
      const valueStr = Object.entries(computedData.values)
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      contextStr += `\n- Values: ${valueStr}`
    }
    
    if (computedData.type) {
      contextStr += `\n- Result type: ${computedData.type}`
    }
  }
  
  return question + contextStr
}
