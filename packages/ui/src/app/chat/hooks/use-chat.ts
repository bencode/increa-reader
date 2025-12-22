import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message, Repo, Session } from '@/types/chat'
import type { ContextData } from '@/stores/view-context'
import { parseCommand, extractTextContent, detectToolFromParams } from '../utils'
import { useSessionManager } from './use-session-manager'
import { useCommands } from './use-commands'
import { useEventCallback } from '@/hooks/use-event-callback'

export const useChat = (getContext: () => ContextData) => {
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [repos, setRepos] = useState<Repo[]>([])

  const sessionManager = useSessionManager()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Commands handling
  const { handleCommand } = useCommands({ currentSession, setCurrentSession, sessionManager })

  // Wrap functions with useEventCallback for stable references
  const createSessionEvent = useEventCallback(() => sessionManager.createSession())
  const saveSessionEvent = useEventCallback((session: Session) => sessionManager.saveSession(session))
  const getContextEvent = useEventCallback(() => getContext())

  // 便捷访问
  const messages = currentSession?.messages ?? []
  const sessionId = currentSession?.stats?.sessionId
  const stats = currentSession?.stats

  const addMessage = useEventCallback((role: Message['role'], content: string) => {
    setCurrentSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [...prev.messages, { role, content, timestamp: Date.now() }],
        lastActiveAt: Date.now(),
      }
    })
  })

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return

    const normalized = input.replace(/^／/, '/')
    const cmd = parseCommand(normalized)

    if (cmd) {
      setCurrentSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: 'user',
              content: normalized,
              timestamp: Date.now(),
            },
          ],
          lastActiveAt: Date.now(),
        }
      })

      handleCommand(cmd.name, cmd.args)
      setInput('')
      return
    }

    if (isStreaming) {
      addMessage('error', 'Cannot send message while streaming. Use /abort to stop generation.')
      return
    }

    // 确保有 session（用局部变量）
    let workingSession = currentSession
    if (!workingSession) {
      workingSession = createSessionEvent()
      setCurrentSession(workingSession)
    }

    const userMsg: Message = { role: 'user', content: input, timestamp: Date.now() }
    setCurrentSession(prev => ({
      ...prev!,
      messages: [...prev!.messages, userMsg],
      lastActiveAt: Date.now(),
    }))
    setInput('')
    setIsStreaming(true)

    let assistantContent = ''
    let toolCalls: Message['toolCalls'] = []
    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      toolCalls: [],
    }
    setCurrentSession(prev => ({
      ...prev!,
      messages: [...prev!.messages, assistantMsg],
    }))

    try {
      const context = getContextEvent()

      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          sessionId: workingSession.stats?.sessionId,
          context,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const msg = JSON.parse(data)

              if (msg.type === 'system' && msg.subtype === 'init') {
                setCurrentSession(prev => ({
                  ...prev!,
                  stats: { ...prev!.stats, sessionId: msg.session_id },
                }))
              }

              if (msg.type === 'stream_event') {
                const delta = msg.event?.delta

                const deltaText = extractTextContent(msg)
                if (deltaText) {
                  assistantContent += deltaText
                  setCurrentSession(prev => ({
                    ...prev!,
                    messages: [
                      ...prev!.messages.slice(0, -1),
                      { ...assistantMsg, content: assistantContent, toolCalls, isStreaming: true },
                    ],
                  }))
                }

                if (delta?.type === 'input_json_delta') {
                  try {
                    const params = JSON.parse(delta.partial_json)
                    const toolName = detectToolFromParams(params)

                    const existingIndex = toolCalls?.findIndex(t => t.name === toolName && t.status === 'running')
                    if (existingIndex !== undefined && existingIndex >= 0) {
                      toolCalls![existingIndex].params = params
                    } else {
                      toolCalls = [...(toolCalls || []), { name: toolName, status: 'running', params }]
                    }

                    setCurrentSession(prev => ({
                      ...prev!,
                      messages: [
                        ...prev!.messages.slice(0, -1),
                        { ...assistantMsg, content: assistantContent, toolCalls, isStreaming: true },
                      ],
                    }))
                  } catch {
                    // Partial JSON may not be parseable yet
                  }
                }
              }

              if (msg.type === 'result') {
                const completedTools = toolCalls?.map(t => ({ ...t, status: 'done' as const }))

                setCurrentSession(prev => ({
                  ...prev!,
                  messages: [
                    ...prev!.messages.slice(0, -1),
                    {
                      ...assistantMsg,
                      content: assistantContent,
                      toolCalls: completedTools,
                      isStreaming: false,
                    },
                  ],
                  stats: {
                    sessionId: msg.session_id,
                    duration: msg.duration_ms,
                    usage: msg.usage,
                  },
                  lastActiveAt: Date.now(),
                }))

                setIsStreaming(false)
              }

              if (msg.type === 'error') {
                setCurrentSession(prev => ({
                  ...prev!,
                  messages: prev!.messages.slice(0, -1),
                }))
                addMessage('error', msg.message || 'Unknown error occurred')
                setIsStreaming(false)
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e)
            }
          }
        }
      }
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Unknown error')
      setIsStreaming(false)
    }
  }, [input, currentSession, isStreaming, createSessionEvent, getContextEvent, handleCommand, addMessage])

  // Auto-save session when messages change (debounced)
  useEffect(() => {
    if (!currentSession || currentSession.messages.length === 0) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSessionEvent(currentSession)
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [currentSession, saveSessionEvent])

  const loadSession = useEventCallback(async (id: string) => {
    const session = await sessionManager.loadSession(id)
    setCurrentSession(session)
  })

  const initializeFromStorage = useEventCallback(async () => {
    const data = await sessionManager.loadSessions()
    if (data.lastActiveSessionId) {
      await loadSession(data.lastActiveSessionId)
    }
  })

  return {
    messages,
    input,
    setInput,
    sessionId,
    isStreaming,
    repos,
    setRepos,
    stats,
    currentSession,
    sendMessage,
    loadSession,
    initializeFromStorage,
    sessionManager,
  }
}
