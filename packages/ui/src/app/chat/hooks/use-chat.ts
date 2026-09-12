import { useCallback, useEffect, useRef, useState } from 'react'
import { useEventCallback } from '@/hooks/use-event-callback'
import { useSuggestionStore } from '@/stores/suggestion-store'
import type { ContextData } from '@/stores/view-context'
import type { Message, Repo, Session } from '@/types/chat'
import { REFINE_TRIGGER_PROMPT } from '../command-registry'
import { detectToolFromParams, extractTextContent, parseCommand, splitSseLines } from '../utils'
import { useAutoName } from './use-auto-name'
import { useCommands } from './use-commands'
import { useSessionManager } from './use-session-manager'

export const useChat = (getContext: () => ContextData) => {
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [repos, setRepos] = useState<Repo[]>([])

  const sessionManager = useSessionManager()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const activeRequestRef = useRef<AbortController | null>(null)
  const activeSdkSessionIdRef = useRef<string | undefined>(undefined)
  const abortRequestedRef = useRef(false)

  // Commands handling
  const { handleCommand } = useCommands({ currentSession, setCurrentSession, sessionManager })

  // Auto-summarize session title after the first reply
  useAutoName({
    currentSession,
    setCurrentSession,
    isStreaming,
    generateTitle: sessionManager.generateTitle,
  })

  // Wrap functions with useEventCallback for stable references
  const createSessionEvent = useEventCallback(() => sessionManager.createSession())
  const saveSessionEvent = useEventCallback((session: Session) =>
    sessionManager.saveSession(session),
  )
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

  const finishStreamingMessages = useEventCallback(() => {
    setCurrentSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        messages: prev.messages.map(message =>
          message.isStreaming ? { ...message, isStreaming: false } : message,
        ),
      }
    })
  })

  const abortGeneration = useEventCallback(async () => {
    const controller = activeRequestRef.current
    if (!controller || controller.signal.aborted || abortRequestedRef.current) return

    abortRequestedRef.current = true
    finishStreamingMessages()
    const activeSessionId = activeSdkSessionIdRef.current

    try {
      if (activeSessionId) {
        const response = await fetch('/api/chat/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSessionId }),
        })
        if (!response.ok && response.status !== 404) {
          console.error(
            `Failed to interrupt server generation: ${response.status} ${response.statusText}`,
          )
        }
      }
    } catch (error) {
      console.error('Failed to interrupt server generation:', error)
    } finally {
      controller.abort()
    }
  })

  const sendMessage = useCallback(
    async (directMessage?: string) => {
      const text = directMessage ?? input
      if (!text.trim()) return

      if (isStreaming) return

      useSuggestionStore.getState().clear()

      const normalized = text.replace(/^／/, '/')
      const cmd = parseCommand(normalized)

      // /refine passes through to the agent (refine-memory skill) instead of a local handler
      if (cmd && cmd.name !== 'refine') {
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
        if (!directMessage) setInput('')
        return
      }

      // 确保有 session（用局部变量）
      let workingSession = currentSession
      if (!workingSession) {
        workingSession = createSessionEvent()
        setCurrentSession(workingSession)
      }

      const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() }
      setCurrentSession(prev => ({
        ...prev!,
        messages: [...prev!.messages, userMsg],
        lastActiveAt: Date.now(),
      }))
      if (!directMessage) setInput('')
      setIsStreaming(true)

      const requestController = new AbortController()
      activeRequestRef.current = requestController
      activeSdkSessionIdRef.current = workingSession.stats?.sessionId
      abortRequestedRef.current = false

      let assistantContent = ''
      let toolCalls: NonNullable<Message['toolCalls']> = []
      const assistantMsg: Message = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: false,
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
          signal: requestController.signal,
          body: JSON.stringify({
            prompt: cmd?.name === 'refine' ? REFINE_TRIGGER_PROMPT : text,
            sessionId: workingSession.stats?.sessionId,
            clientSessionId: workingSession.id,
            context,
            options: workingSession.model ? { model: workingSession.model } : undefined,
          }),
        })

        if (!response.ok) {
          const errorData: unknown = await response.json().catch(error => {
            console.error('Failed to parse chat error response:', error)
            return null
          })
          const detail =
            errorData &&
            typeof errorData === 'object' &&
            'detail' in errorData &&
            typeof errorData.detail === 'string'
              ? errorData.detail
              : undefined
          throw new Error(detail || `HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) throw new Error('No response body')

        const handleSseLine = (line: string) => {
          if (!line.startsWith('data: ') || abortRequestedRef.current) return

          const data = line.slice(6)
          try {
            const msg = JSON.parse(data)

            if (msg.type === 'system' && msg.subtype === 'init') {
              activeSdkSessionIdRef.current = msg.session_id
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
                    {
                      ...assistantMsg,
                      content: assistantContent,
                      toolCalls,
                      isStreaming: true,
                    },
                  ],
                }))
              }

              if (delta?.type === 'input_json_delta' && delta.partial_json) {
                try {
                  const params = JSON.parse(delta.partial_json)
                  const toolName = detectToolFromParams(params)
                  const existingIndex = toolCalls.findIndex(
                    tool => tool.name === toolName && tool.status === 'running',
                  )

                  toolCalls =
                    existingIndex >= 0
                      ? toolCalls.map((tool, index) =>
                          index === existingIndex ? { ...tool, params } : tool,
                        )
                      : [...toolCalls, { name: toolName, status: 'running', params }]

                  setCurrentSession(prev => ({
                    ...prev!,
                    messages: [
                      ...prev!.messages.slice(0, -1),
                      {
                        ...assistantMsg,
                        content: assistantContent,
                        toolCalls,
                        isStreaming: false,
                      },
                    ],
                  }))
                } catch (error) {
                  if (!(error instanceof SyntaxError)) {
                    console.error('Failed to parse tool parameters:', error)
                  }
                }
              }
            }

            if (msg.type === 'assistant') {
              finishStreamingMessages()
            }

            if (msg.type === 'result') {
              const completedTools = toolCalls.map(tool => ({ ...tool, status: 'done' as const }))

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
                  model: msg.model ?? undefined,
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
          } catch (error) {
            console.error('Failed to parse SSE message:', error)
          }
        }

        let remainder = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const parsed = splitSseLines(remainder, chunk)
          remainder = parsed.remainder
          parsed.lines.forEach(handleSseLine)
        }

        const final = splitSseLines(remainder, decoder.decode())
        final.lines.forEach(handleSseLine)
        if (final.remainder) handleSseLine(final.remainder)
      } catch (error) {
        if (!requestController.signal.aborted) {
          addMessage('error', error instanceof Error ? error.message : 'Unknown error')
        }
      } finally {
        if (activeRequestRef.current === requestController) {
          const wasInterrupted = abortRequestedRef.current
          activeRequestRef.current = null
          activeSdkSessionIdRef.current = undefined
          abortRequestedRef.current = false
          finishStreamingMessages()
          setIsStreaming(false)
          if (wasInterrupted) addMessage('system', 'Generation interrupted')
        }
      }
    },
    [
      input,
      currentSession,
      isStreaming,
      createSessionEvent,
      getContextEvent,
      handleCommand,
      addMessage,
      finishStreamingMessages,
    ],
  )

  // Auto-save session when messages change (debounced)
  useEffect(() => {
    if (!currentSession || currentSession.messages.length === 0) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSessionEvent(currentSession).catch(error => {
        console.error('Failed to auto-save session:', error)
      })
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

  const switchSession = useEventCallback(async (id: string) => {
    if (id === currentSession?.id) return
    if (isStreaming) {
      throw new Error('Wait for the current response to finish before switching sessions.')
    }
    if (currentSession && currentSession.messages.length > 0) {
      await sessionManager.saveSession(currentSession)
    }

    const targetSession = await sessionManager.loadSession(id)
    const activatedSession = { ...targetSession, lastActiveAt: Date.now() }
    await sessionManager.saveSession(activatedSession)
    setCurrentSession(activatedSession)
    setInput('')
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
    abortGeneration,
    loadSession,
    switchSession,
    initializeFromStorage,
    sessionManager,
  }
}
