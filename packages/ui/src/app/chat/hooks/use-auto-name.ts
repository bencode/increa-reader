import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import type { Message, Session } from '@/types/chat'

const DEFAULT_TITLE = 'New Chat'

type AutoNameContext = {
  currentSession: Session | null
  setCurrentSession: Dispatch<SetStateAction<Session | null>>
  isStreaming: boolean
  generateTitle: (messages: Message[]) => Promise<string | null>
}

/**
 * Auto-summarize a session into a title after its first reply completes,
 * while the title is still the default. Fires at most once per session id;
 * failures stay silent and keep the default title.
 */
export const useAutoName = (ctx: AutoNameContext) => {
  const { currentSession, setCurrentSession, isStreaming, generateTitle } = ctx
  const namingRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentSession || isStreaming) return
    if (currentSession.title !== DEFAULT_TITLE) return
    if (namingRef.current === currentSession.id) return

    const hasReply = currentSession.messages.some(m => m.role === 'assistant' && m.content.trim())
    if (!hasReply) return

    const { id, messages } = currentSession
    namingRef.current = id

    generateTitle(messages).then(title => {
      if (!title) return
      setCurrentSession(prev =>
        prev && prev.id === id && prev.title === DEFAULT_TITLE
          ? { ...prev, title, lastActiveAt: Date.now() }
          : prev,
      )
    })
  }, [currentSession, isStreaming, generateTitle, setCurrentSession])
}
