import { useCallback } from 'react'
import { useNavsStore } from '@/store/navsStore'
import { NAVS_PERSONA } from '@/lib/navs-persona'
import type { ProviderType } from '@/lib/llm-provider'

/**
 * Hook for interacting with Navs AI
 */
export function useNavs() {
  const {
    messages,
    isTyping,
    provider,
    model,
    sendMessage,
    clearMessages,
    setProvider,
    setModel,
    stopGeneration,
  } = useNavsStore()
  
  const ask = useCallback(async (question: string) => {
    await sendMessage(question)
  }, [sendMessage])
  
  const clear = useCallback(() => {
    clearMessages()
  }, [clearMessages])
  
  const changeProvider = useCallback((newProvider: ProviderType) => {
    setProvider(newProvider)
  }, [setProvider])
  
  const changeModel = useCallback((newModel: string) => {
    setModel(newModel)
  }, [setModel])
  
  const stop = useCallback(() => {
    stopGeneration()
  }, [stopGeneration])
  
  return {
    messages,
    isTyping,
    provider,
    model,
    ask,
    clear,
    changeProvider,
    changeModel,
    stop,
    persona: NAVS_PERSONA,
  }
}

/**
 * Hook to get greeting based on time of day
 */
export function useNavsGreeting() {
  const hour = new Date().getHours()
  
  if (hour < 12) return NAVS_PERSONA.greetings.morning
  if (hour < 17) return NAVS_PERSONA.greetings.afternoon
  if (hour < 21) return NAVS_PERSONA.greetings.evening
  return NAVS_PERSONA.greetings.default
}

/**
 * Hook to get contextual suggestions
 */
export function useNavsSuggestions(context: keyof typeof NAVS_PERSONA.suggestions = 'commandCenter') {
  return NAVS_PERSONA.suggestions[context] ?? NAVS_PERSONA.suggestions.commandCenter
}
