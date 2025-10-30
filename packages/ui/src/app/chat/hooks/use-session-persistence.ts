import { useEffect } from 'react'
import type { Message } from '@/types/chat'

type Stats = {
  sessionId?: string
  duration?: number
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

type RestoreResult = {
  messages: Message[]
  stats?: Stats
}

export const useSessionPersistence = (
  sessionId: string | undefined,
  messages: Message[],
  stats: Stats | undefined,
  onRestore: (data: RestoreResult) => void
) => {
  // Restore from localStorage on mount
  useEffect(() => {
    const lastSessionId = localStorage.getItem('chat_session_id')
    if (lastSessionId) {
      const history = localStorage.getItem(`chat_history_${lastSessionId}`)
      const savedStats = localStorage.getItem(`chat_stats_${lastSessionId}`)

      if (history) {
        const restoredMessages = JSON.parse(history)
        const restoredStats = savedStats ? JSON.parse(savedStats) : { sessionId: lastSessionId }

        onRestore({
          messages: restoredMessages,
          stats: restoredStats,
        })
      }
    }
  }, [onRestore])

  // Persist to localStorage when sessionId or messages change
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('chat_session_id', sessionId)
      localStorage.setItem(`chat_history_${sessionId}`, JSON.stringify(messages))
    }
  }, [messages, sessionId])

  // Persist stats when they change
  useEffect(() => {
    if (sessionId && stats) {
      localStorage.setItem(`chat_stats_${sessionId}`, JSON.stringify(stats))
    }
  }, [stats, sessionId])

  const clearSession = () => {
    localStorage.removeItem('chat_session_id')
    if (sessionId) {
      localStorage.removeItem(`chat_stats_${sessionId}`)
    }
  }

  return { clearSession }
}
