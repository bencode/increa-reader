import { useState, useCallback } from 'react'
import type { Message, Repo } from '@/types/chat'
import type { ViewContext } from '@/stores/view-context'
import { HELP_TEXT, parseCommand, extractTextContent, detectToolFromParams } from '../utils'

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

export const useChat = (getContext: () => ViewContext) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string>()
  const [isStreaming, setIsStreaming] = useState(false)
  const [repos, setRepos] = useState<Repo[]>([])
  const [stats, setStats] = useState<Stats>()

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }])
  }, [])

  const handleSave = useCallback(async () => {
    if (!sessionId || messages.length === 0) {
      addMessage('error', 'No chat history to save')
      return
    }

    try {
      const response = await fetch('/api/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages, stats }),
      })

      if (response.ok) {
        const result = await response.json()
        addMessage('system', `Chat saved to ${result.filename}`)
      } else {
        const error = await response.json()
        addMessage('error', error.detail || 'Failed to save chat')
      }
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Failed to save chat')
    }
  }, [sessionId, messages, stats, addMessage])

  const handleClear = useCallback(async () => {
    if (sessionId && messages.length > 0) {
      await handleSave()
    }

    setMessages([])
    setSessionId(undefined)
    setStats(undefined)
  }, [sessionId, messages.length, handleSave])

  const handleAbort = useCallback(async () => {
    if (!sessionId) {
      addMessage('error', 'No active session to abort')
      return
    }

    try {
      const response = await fetch('/api/chat/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (response.ok) {
        addMessage('system', 'Aborted current generation')
        setIsStreaming(false)
      } else {
        const error = await response.json()
        addMessage('error', error.detail || 'Failed to abort')
      }
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Failed to abort')
    }
  }, [sessionId, addMessage])

  const handleCommand = useCallback(
    (name: string, args: string) => {
      switch (name) {
        case 'help':
          addMessage('system', HELP_TEXT)
          break
        case 'save':
          handleSave()
          break
        case 'clear':
          handleClear()
          break
        case 'abort':
          handleAbort()
          break
        default:
          addMessage('error', `Unknown command: /${name}. Type /help for available commands.`)
      }
    },
    [addMessage, handleSave, handleClear, handleAbort]
  )

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return

    const normalized = input.replace(/^／/, '/')
    const cmd = parseCommand(normalized)

    if (cmd) {
      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: normalized,
          timestamp: Date.now(),
        },
      ])

      handleCommand(cmd.name, cmd.args)
      setInput('')
      return
    }

    if (isStreaming) {
      addMessage('error', 'Cannot send message while streaming. Use /abort to stop generation.')
      return
    }

    const userMsg: Message = { role: 'user', content: input, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
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
    setMessages(prev => [...prev, assistantMsg])

    try {
      const context = getContext()

      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          sessionId,
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
                setSessionId(msg.session_id)
              }

              if (msg.type === 'stream_event') {
                const delta = msg.event?.delta

                const deltaText = extractTextContent(msg)
                if (deltaText) {
                  assistantContent += deltaText
                  setMessages(prev => [
                    ...prev.slice(0, -1),
                    { ...assistantMsg, content: assistantContent, toolCalls, isStreaming: true },
                  ])
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

                    setMessages(prev => [
                      ...prev.slice(0, -1),
                      { ...assistantMsg, content: assistantContent, toolCalls, isStreaming: true },
                    ])
                  } catch {
                    // Partial JSON may not be parseable yet
                  }
                }
              }

              if (msg.type === 'result') {
                const completedTools = toolCalls?.map(t => ({ ...t, status: 'done' as const }))

                setMessages(prev => [
                  ...prev.slice(0, -1),
                  {
                    ...assistantMsg,
                    content: assistantContent,
                    toolCalls: completedTools,
                    isStreaming: false,
                  },
                ])

                const newStats = {
                  sessionId: msg.session_id,
                  duration: msg.duration_ms,
                  usage: msg.usage,
                }
                setStats(newStats)
                localStorage.setItem(`chat_stats_${msg.session_id}`, JSON.stringify(newStats))
                setIsStreaming(false)
              }

              if (msg.type === 'error') {
                setMessages(prev => prev.slice(0, -1))
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
  }, [input, sessionId, isStreaming, getContext, handleCommand, addMessage])

  const restoreSession = useCallback((data: { messages: Message[]; stats?: Stats }) => {
    setMessages(data.messages)
    setStats(data.stats)
    if (data.stats?.sessionId) {
      setSessionId(data.stats.sessionId)
    }
  }, [])

  return {
    messages,
    input,
    setInput,
    sessionId,
    setSessionId,
    isStreaming,
    repos,
    setRepos,
    stats,
    setStats,
    sendMessage,
    restoreSession,
  }
}
