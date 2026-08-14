import { useCallback, useRef, useState } from 'react'
import type { Message, Session, SessionMetadata, SessionsPage } from '@/types/chat'

const PAGE_SIZE = 50

const sortSessions = (sessions: SessionMetadata[]) =>
  [...sessions].sort(
    (left, right) => right.lastActiveAt - left.lastActiveAt || right.id.localeCompare(left.id),
  )

const mergeSessions = (current: SessionMetadata[], incoming: SessionMetadata[]) => {
  const sessionsById = incoming.reduce(
    (byId, session) => byId.set(session.id, session),
    new Map(current.map(session => [session.id, session])),
  )
  return sortSessions([...sessionsById.values()])
}

export const useSessionManager = () => {
  const [sessions, setSessions] = useState<SessionMetadata[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const nextOffsetRef = useRef(0)
  const requestIdRef = useRef(0)

  const loadSessions = useCallback(async (append = false): Promise<SessionsPage> => {
    const offset = append ? nextOffsetRef.current : 0
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoadingSessions(true)
    setSessionsError(null)

    try {
      const response = await fetch(`/api/sessions?limit=${PAGE_SIZE}&offset=${offset}`)
      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.status} ${response.statusText}`)
      }

      const data: SessionsPage = await response.json()
      if (requestId !== requestIdRef.current) return data

      nextOffsetRef.current = data.offset + data.sessions.length
      setSessions(current =>
        append ? mergeSessions(current, data.sessions) : sortSessions(data.sessions),
      )
      setTotalSessions(data.total)
      setHasMoreSessions(data.hasMore)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load sessions'
      if (requestId === requestIdRef.current) setSessionsError(message)
      throw error
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingSessions(false)
    }
  }, [])

  const loadMoreSessions = useCallback(async (): Promise<void> => {
    if (isLoadingSessions || !hasMoreSessions) return
    await loadSessions(true)
  }, [hasMoreSessions, isLoadingSessions, loadSessions])

  const loadSession = useCallback(async (sessionId: string): Promise<Session> => {
    const response = await fetch(`/api/sessions/${sessionId}`)
    if (!response.ok) {
      throw new Error(`Failed to load session: ${response.status} ${response.statusText}`)
    }
    return await response.json()
  }, [])

  const saveSession = useCallback(async (session: Session): Promise<void> => {
    const response = await fetch(`/api/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    })
    if (!response.ok) {
      throw new Error(`Failed to save session: ${response.status} ${response.statusText}`)
    }

    setSessions(prev => {
      const metadata: SessionMetadata = {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
      }
      return mergeSessions(prev, [metadata])
    })
  }, [])

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.status} ${response.statusText}`)
    }

    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setTotalSessions(prev => Math.max(0, prev - 1))
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

    setSessions(prev =>
      mergeSessions(prev, [
        {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
        },
      ]),
    )

    return session
  }, [])

  const generateTitle = useCallback(async (messages: Message[]): Promise<string | null> => {
    const res = await fetch('/api/chat/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    if (!res.ok) return null
    const data: { title: string | null } = await res.json()
    return data.title || null
  }, [])

  return {
    sessions,
    totalSessions,
    hasMoreSessions,
    isLoadingSessions,
    sessionsError,
    loadSessions,
    loadMoreSessions,
    loadSession,
    saveSession,
    deleteSession,
    createSession,
    generateTitle,
  }
}
