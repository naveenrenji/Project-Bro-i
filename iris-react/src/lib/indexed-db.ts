/**
 * IndexedDB Knowledge Base
 * Persistent storage for Q&A with 15-day per-entry TTL
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const DB_NAME = 'navs-knowledge-base'
const DB_VERSION = 1
const ENTRY_TTL_DAYS = 15
const DASHBOARD_TTL_DAYS = 15

// Store names
const STORES = {
  KNOWLEDGE: 'knowledge',
  DASHBOARD: 'dashboard',
  EMBEDDINGS: 'embeddings'
} as const

// =============================================================================
// TYPES
// =============================================================================

export interface ComputedData {
  type: 'list' | 'aggregation' | 'filter' | 'comparison' | 'count' | 'unknown'
  entities: string[]                    // e.g., ['NJ', 'NY', 'PA']
  values: Record<string, unknown>       // e.g., { NJ: 234, NY: 189 }
  filters?: Record<string, unknown>     // Any filters applied
  code?: string                         // The code that generated this
}

export interface KnowledgeEntry {
  id: string
  question: string
  answer: string
  computedData: ComputedData
  embedding: number[]
  createdAt: Date
  expiresAt: Date
  accessCount: number
  lastAccessedAt: Date
}

export interface DashboardCacheEntry {
  id: 'dashboard'
  data: unknown
  cachedAt: Date
  expiresAt: Date
  needsRevalidation: boolean
}

export interface EmbeddingCacheEntry {
  id: string
  text: string
  embedding: number[]
  createdAt: Date
}

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

let dbInstance: IDBDatabase | null = null

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Knowledge store - Q&A with embeddings
      if (!db.objectStoreNames.contains(STORES.KNOWLEDGE)) {
        const knowledgeStore = db.createObjectStore(STORES.KNOWLEDGE, { keyPath: 'id' })
        knowledgeStore.createIndex('expiresAt', 'expiresAt', { unique: false })
        knowledgeStore.createIndex('createdAt', 'createdAt', { unique: false })
        knowledgeStore.createIndex('question', 'question', { unique: false })
      }

      // Dashboard cache store
      if (!db.objectStoreNames.contains(STORES.DASHBOARD)) {
        db.createObjectStore(STORES.DASHBOARD, { keyPath: 'id' })
      }

      // Embeddings cache store (for avoiding re-computation)
      if (!db.objectStoreNames.contains(STORES.EMBEDDINGS)) {
        const embeddingsStore = db.createObjectStore(STORES.EMBEDDINGS, { keyPath: 'id' })
        embeddingsStore.createIndex('text', 'text', { unique: false })
      }
    }
  })
}

export async function getDB(): Promise<IDBDatabase> {
  if (!dbInstance) {
    return initDB()
  }
  return dbInstance
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function isExpired(entry: { expiresAt: Date }): boolean {
  return new Date() > new Date(entry.expiresAt)
}

// =============================================================================
// KNOWLEDGE STORE OPERATIONS
// =============================================================================

export async function addKnowledgeEntry(
  entry: Omit<KnowledgeEntry, 'id' | 'expiresAt' | 'accessCount' | 'lastAccessedAt' | 'createdAt'>
): Promise<string> {
  const db = await getDB()
  const now = new Date()
  
  const fullEntry: KnowledgeEntry = {
    ...entry,
    id: generateId(),
    createdAt: now,
    expiresAt: addDays(now, ENTRY_TTL_DAYS),
    accessCount: 0,
    lastAccessedAt: now
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KNOWLEDGE, 'readwrite')
    const store = tx.objectStore(STORES.KNOWLEDGE)
    const request = store.add(fullEntry)

    request.onsuccess = () => resolve(fullEntry.id)
    request.onerror = () => reject(request.error)
  })
}

export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KNOWLEDGE, 'readonly')
    const store = tx.objectStore(STORES.KNOWLEDGE)
    const request = store.get(id)

    request.onsuccess = () => {
      const entry = request.result
      if (entry && !isExpired(entry)) {
        resolve(entry)
      } else {
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getAllKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  const db = await getDB()
  const now = new Date()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KNOWLEDGE, 'readonly')
    const store = tx.objectStore(STORES.KNOWLEDGE)
    const request = store.getAll()

    request.onsuccess = () => {
      // Filter out expired entries
      const entries = request.result.filter(
        (entry: KnowledgeEntry) => new Date(entry.expiresAt) > now
      )
      resolve(entries)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function touchKnowledgeEntry(id: string): Promise<void> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KNOWLEDGE, 'readwrite')
    const store = tx.objectStore(STORES.KNOWLEDGE)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const entry = getRequest.result
      if (entry) {
        entry.accessCount++
        entry.lastAccessedAt = new Date()
        const putRequest = store.put(entry)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KNOWLEDGE, 'readwrite')
    const store = tx.objectStore(STORES.KNOWLEDGE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// =============================================================================
// TTL CLEANUP
// =============================================================================

export async function cleanupExpiredEntries(): Promise<number> {
  const db = await getDB()
  const now = new Date()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KNOWLEDGE, 'readwrite')
    const store = tx.objectStore(STORES.KNOWLEDGE)
    const index = store.index('expiresAt')
    
    // Get all entries that have expired
    const range = IDBKeyRange.upperBound(now)
    const request = index.openCursor(range)
    
    let deletedCount = 0

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        deletedCount++
        cursor.continue()
      } else {
        resolve(deletedCount)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getKnowledgeStats(): Promise<{
  totalEntries: number
  activeEntries: number
  expiredEntries: number
  oldestEntry: Date | null
  newestEntry: Date | null
}> {
  const db = await getDB()
  const now = new Date()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KNOWLEDGE, 'readonly')
    const store = tx.objectStore(STORES.KNOWLEDGE)
    const request = store.getAll()

    request.onsuccess = () => {
      const entries = request.result as KnowledgeEntry[]
      const active = entries.filter(e => new Date(e.expiresAt) > now)
      const expired = entries.filter(e => new Date(e.expiresAt) <= now)
      
      const dates = active.map(e => new Date(e.createdAt).getTime())
      
      resolve({
        totalEntries: entries.length,
        activeEntries: active.length,
        expiredEntries: expired.length,
        oldestEntry: dates.length > 0 ? new Date(Math.min(...dates)) : null,
        newestEntry: dates.length > 0 ? new Date(Math.max(...dates)) : null
      })
    }
    request.onerror = () => reject(request.error)
  })
}

// =============================================================================
// DASHBOARD CACHE OPERATIONS
// =============================================================================

export async function getDashboardCache(): Promise<DashboardCacheEntry | null> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DASHBOARD, 'readonly')
    const store = tx.objectStore(STORES.DASHBOARD)
    const request = store.get('dashboard')

    request.onsuccess = () => {
      const entry = request.result
      if (entry && !isExpired(entry)) {
        resolve(entry)
      } else {
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function setDashboardCache(data: unknown): Promise<void> {
  const db = await getDB()
  const now = new Date()

  const entry: DashboardCacheEntry = {
    id: 'dashboard',
    data,
    cachedAt: now,
    expiresAt: addDays(now, DASHBOARD_TTL_DAYS),
    needsRevalidation: false
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DASHBOARD, 'readwrite')
    const store = tx.objectStore(STORES.DASHBOARD)
    const request = store.put(entry)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function flagDashboardForRevalidation(): Promise<void> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DASHBOARD, 'readwrite')
    const store = tx.objectStore(STORES.DASHBOARD)
    const getRequest = store.get('dashboard')

    getRequest.onsuccess = () => {
      const entry = getRequest.result
      if (entry) {
        entry.needsRevalidation = true
        const putRequest = store.put(entry)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export async function clearDashboardCache(): Promise<void> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DASHBOARD, 'readwrite')
    const store = tx.objectStore(STORES.DASHBOARD)
    const request = store.delete('dashboard')

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// =============================================================================
// EMBEDDING CACHE OPERATIONS
// =============================================================================

export async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const db = await getDB()
  const id = btoa(text.slice(0, 100)) // Use base64 of first 100 chars as ID

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EMBEDDINGS, 'readonly')
    const store = tx.objectStore(STORES.EMBEDDINGS)
    const request = store.get(id)

    request.onsuccess = () => {
      const entry = request.result
      resolve(entry?.embedding || null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function cacheEmbedding(text: string, embedding: number[]): Promise<void> {
  const db = await getDB()
  const id = btoa(text.slice(0, 100))

  const entry: EmbeddingCacheEntry = {
    id,
    text: text.slice(0, 500), // Store first 500 chars for reference
    embedding,
    createdAt: new Date()
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EMBEDDINGS, 'readwrite')
    const store = tx.objectStore(STORES.EMBEDDINGS)
    const request = store.put(entry)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// =============================================================================
// KNOWLEDGE BASE INITIALIZATION
// =============================================================================

let cleanupInterval: ReturnType<typeof setInterval> | null = null

export async function initKnowledgeBase(): Promise<{
  stats: Awaited<ReturnType<typeof getKnowledgeStats>>
  cleanedUp: number
}> {
  // Initialize database
  await initDB()
  
  // Clean expired entries on startup
  const cleanedUp = await cleanupExpiredEntries()
  if (cleanedUp > 0) {
    console.log(`[Knowledge Base] Cleaned up ${cleanedUp} expired entries`)
  }
  
  // Get current stats
  const stats = await getKnowledgeStats()
  console.log(`[Knowledge Base] Initialized with ${stats.activeEntries} active entries`)
  
  // Schedule hourly cleanup
  if (!cleanupInterval) {
    cleanupInterval = setInterval(async () => {
      const removed = await cleanupExpiredEntries()
      if (removed > 0) {
        console.log(`[Knowledge Base] Hourly cleanup: removed ${removed} expired entries`)
      }
    }, 60 * 60 * 1000) // Every hour
  }
  
  return { stats, cleanedUp }
}

export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

// =============================================================================
// CLEAR ALL DATA (for testing/debugging)
// =============================================================================

export async function clearAllData(): Promise<void> {
  const db = await getDB()

  const stores = [STORES.KNOWLEDGE, STORES.DASHBOARD, STORES.EMBEDDINGS]
  
  await Promise.all(
    stores.map(storeName => 
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    )
  )
}
