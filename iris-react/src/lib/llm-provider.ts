/**
 * LLM Provider Interface for Ask Navs
 * Supports Google Gemini (cloud) and Ollama (local) providers
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// =============================================================================
// TYPES
// =============================================================================

export type ProviderType = 'gemini' | 'ollama'
export type OllamaModelFamily = 'qwen3' | 'deepseek-r1'

export interface LLMProvider {
  type: ProviderType
  name: string
  isAvailable: () => Promise<boolean>
  listModels: () => Promise<string[]>
  generate: (prompt: string, model?: string, signal?: AbortSignal) => Promise<string>
}

export interface ProviderStatus {
  gemini: {
    available: boolean
    model: string
    error?: string
  }
  ollama: {
    available: boolean
    models: string[]
    selectedModel: string | null
    error?: string
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Ollama models we support (user can select between these)
export const SUPPORTED_OLLAMA_MODELS: OllamaModelFamily[] = ['qwen3', 'deepseek-r1']

// Default models
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-exp'
export const DEFAULT_OLLAMA_MODEL = 'qwen3'

// Ollama server URL
export const OLLAMA_BASE_URL = 'http://localhost:11434'

// =============================================================================
// GEMINI PROVIDER
// =============================================================================

function getGeminiApiKey(): string | null {
  return import.meta.env.VITE_GEMINI_API_KEY || null
}

export const geminiProvider: LLMProvider = {
  type: 'gemini',
  name: 'Google Gemini (Cloud)',

  async isAvailable(): Promise<boolean> {
    const apiKey = getGeminiApiKey()
    if (!apiKey) return false
    
    try {
      // Quick validation - just check if we can create the client
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL })
      // Don't actually call the API, just verify setup
      return !!model
    } catch {
      return false
    }
  },

  async listModels(): Promise<string[]> {
    // For Gemini, we use a fixed model (as per user request)
    return [DEFAULT_GEMINI_MODEL]
  },

  async generate(prompt: string, model = DEFAULT_GEMINI_MODEL, signal?: AbortSignal): Promise<string> {
    // Check if already aborted
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }
    
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY not configured')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const genModel = genAI.getGenerativeModel({ model })
    
    // Wrap in a race with abort signal
    const resultPromise = genModel.generateContent(prompt)
    
    if (signal) {
      const abortPromise = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Request aborted', 'AbortError'))
        })
      })
      
      const result = await Promise.race([resultPromise, abortPromise])
      const text = result.response.text()
      if (!text) throw new Error('Empty response from Gemini')
      return text
    }
    
    const result = await resultPromise
    const text = result.response.text()
    
    if (!text) {
      throw new Error('Empty response from Gemini')
    }
    
    return text
  },
}

// =============================================================================
// OLLAMA PROVIDER
// =============================================================================

export const ollamaProvider: LLMProvider = {
  type: 'ollama',
  name: 'Ollama (Local)',

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      return res.ok
    } catch {
      return false
    }
  },

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
      if (!res.ok) return []
      
      const data = await res.json()
      const installed: string[] = data.models?.map((m: { name: string }) => m.name) || []
      
      // Filter to only supported model families (qwen3 and deepseek-r1)
      return installed.filter((name: string) =>
        SUPPORTED_OLLAMA_MODELS.some(supported => 
          name.toLowerCase().startsWith(supported.toLowerCase())
        )
      )
    } catch {
      return []
    }
  },

  async generate(prompt: string, model = DEFAULT_OLLAMA_MODEL, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
      signal, // Pass abort signal to fetch
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Ollama error: ${error}`)
    }

    const data = await res.json()
    
    if (!data.response) {
      throw new Error('Empty response from Ollama')
    }
    
    return data.response
  },
}

// =============================================================================
// PROVIDER MANAGER
// =============================================================================

export async function checkProviderStatus(): Promise<ProviderStatus> {
  const [geminiAvailable, ollamaAvailable, ollamaModels] = await Promise.all([
    geminiProvider.isAvailable(),
    ollamaProvider.isAvailable(),
    ollamaProvider.listModels(),
  ])

  return {
    gemini: {
      available: geminiAvailable,
      model: DEFAULT_GEMINI_MODEL,
      error: geminiAvailable ? undefined : 'API key not configured or invalid',
    },
    ollama: {
      available: ollamaAvailable,
      models: ollamaModels,
      selectedModel: ollamaModels.length > 0 ? ollamaModels[0] : null,
      error: ollamaAvailable ? undefined : 'Ollama server not running',
    },
  }
}

export function getProvider(type: ProviderType): LLMProvider {
  return type === 'gemini' ? geminiProvider : ollamaProvider
}

/**
 * Generate a response using the specified provider
 */
export async function generateWithProvider(
  prompt: string,
  providerType: ProviderType,
  model?: string,
  signal?: AbortSignal
): Promise<string> {
  const provider = getProvider(providerType)
  return provider.generate(prompt, model, signal)
}

/**
 * Check if an error is an abort error
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

// =============================================================================
// MODEL HELPERS
// =============================================================================

/**
 * Get display name for a model
 */
export function getModelDisplayName(modelId: string): string {
  const lower = modelId.toLowerCase()
  
  if (lower.startsWith('qwen3')) {
    const size = modelId.split(':')[1] || ''
    return `Qwen 3${size ? ` (${size})` : ''}`
  }
  
  if (lower.startsWith('deepseek-r1')) {
    const size = modelId.split(':')[1] || ''
    return `DeepSeek R1${size ? ` (${size})` : ''}`
  }
  
  if (lower.includes('gemini')) {
    return 'Gemini 2.0 Flash'
  }
  
  return modelId
}

/**
 * Get model family from model ID
 */
export function getModelFamily(modelId: string): OllamaModelFamily | 'gemini' {
  const lower = modelId.toLowerCase()
  
  if (lower.startsWith('qwen3')) return 'qwen3'
  if (lower.startsWith('deepseek-r1')) return 'deepseek-r1'
  return 'gemini'
}

/**
 * Group models by family
 */
export function groupModelsByFamily(models: string[]): Record<OllamaModelFamily, string[]> {
  const grouped: Record<OllamaModelFamily, string[]> = {
    'qwen3': [],
    'deepseek-r1': [],
  }
  
  for (const model of models) {
    const family = getModelFamily(model)
    if (family !== 'gemini' && grouped[family]) {
      grouped[family].push(model)
    }
  }
  
  return grouped
}
