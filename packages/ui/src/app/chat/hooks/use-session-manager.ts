import { useState, useCallback } from 'react'
import type { Session, SessionMetadata } from '@/types/chat'

type SessionsData = {
  sessions: SessionMetadata[]
  lastActiveSessionId: string | null
}

export const useSessionManager = () => {
  const [sessions, setSessions] = useState<SessionMetadata[]>([])

  const loadSessions = useCallback(async (): Promise<SessionsData> => {
    const response = await fetch('/api/sessions')
    const data: SessionsData = await response.json()
    setSessions(data.sessions)
    return data
  }, [])

  const loadSession = useCallback(async (sessionId: string): Promise<Session> => {
    const response = await fetch(`/api/sessions/${sessionId}`)
    if (!response.ok) {
      throw new Error('Failed to load session')
    }
    return await response.json()
  }, [])

  const saveSession = useCallback(async (session: Session): Promise<void> => {
    await fetch(`/api/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    })

    // Update local sessions list
    setSessions(prev => {
      const existing = prev.find(s => s.id === session.id)
      const metadata: SessionMetadata = {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
      }
      if (existing) {
        return prev.map(s => (s.id === session.id ? metadata : s))
      }
      return [...prev, metadata]
    })
  }, [])

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    })

    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }, [])

  const createSession = useCallback((title?: string): Session => {
    const now = Date.now()
    const sessionId = `session_${now}`
    const session: Session = {
      id: sessionId,
      title: title || 'New Chat',
      messages: [],
      stats: {},
      createdAt: now,
      lastActiveAt: now,
    }

    // 立即添加到本地列表
    setSessions(prev => [
      ...prev,
      {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
      },
    ])

    return session
  }, [])

  return {
    sessions,
    loadSessions,
    loadSession,
    saveSession,
    deleteSession,
    createSession,
  }
}
