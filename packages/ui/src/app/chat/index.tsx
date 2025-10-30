import { useEffect, useRef, useState } from 'react'

import type { Message as MessageType, Repo, SSEMessage } from '@/types/chat'
import { useGetContext } from '@/stores/view-context'
import { HELP_TEXT, parseCommand, extractTextContent, detectToolFromParams } from './utils'
import { executeFrontendTool } from './frontend-tools'
import { ChatHeader } from './chat-header'
import { HistoryPanel } from './history-panel'
import { ActiveChatPanel } from './active-chat-panel'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

export const ChatPanel = () => {
  const [messages, setMessages] = useState<MessageType[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string>()
  const [isStreaming, setIsStreaming] = useState(false)
  const [repos, setRepos] = useState<Repo[]>([])
  const [stats, setStats] = useState<{
    sessionId?: string
    duration?: number
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }>()
  const [isSplitView, setIsSplitView] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const getContext = useGetContext()

  useEffect(() => {
    fetch('/api/workspace/tree')
      .then(res => res.json())
      .then(data => {
        const repoList = data.data || []
        setRepos(repoList)
      })
      .catch(console.error)
  }, [])

  // Establish persistent SSE connection for frontend tool calls
  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      console.log('[Frontend Tools] Connecting to SSE...')
      eventSource = new EventSource('/api/chat/frontend-events')

      eventSource.onopen = () => {
        console.log('[Frontend Tools] SSE connected')
      }

      eventSource.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data) as SSEMessage

          if (msg.type === 'tool_call') {
            const { call_id, name, arguments: args } = msg
            console.log(`[Frontend Tool] Executing ${name}`, args)

            // Execute tool
            const toolResult = await executeFrontendTool(name, args)

            // Send result back to backend
            await fetch('/api/chat/tool-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                call_id,
                ...toolResult,
              }),
            })
          }
        } catch (error) {
          console.error('[Frontend Tool] Error:', error)
        }
      }

      eventSource.onerror = () => {
        console.log('[Frontend Tools] SSE disconnected, reconnecting in 2s...')
        eventSource?.close()

        // Reconnect after 2 seconds
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      console.log('[Frontend Tools] Cleaning up SSE connection')
      eventSource?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  useEffect(() => {
    const lastSessionId = localStorage.getItem('chat_session_id')
    if (lastSessionId) {
      const history = localStorage.getItem(`chat_history_${lastSessionId}`)
      const savedStats = localStorage.getItem(`chat_stats_${lastSessionId}`)

      if (history) {
        setMessages(JSON.parse(history))
        setSessionId(lastSessionId)

        // Restore full stats if available, otherwise just sessionId
        if (savedStats) {
          setStats(JSON.parse(savedStats))
        } else {
          setStats({ sessionId: lastSessionId })
        }
      }
    }
  }, [])

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('chat_session_id', sessionId)
      localStorage.setItem(`chat_history_${sessionId}`, JSON.stringify(messages))
    }
  }, [messages, sessionId])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const addMessage = (role: MessageType['role'], content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }])
  }

  const handleSave = async () => {
    if (!sessionId || messages.length === 0) {
      addMessage('error', 'No chat history to save')
      return
    }

    try {
      const response = await fetch('/api/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages,
          stats,
        }),
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
  }

  const handleClear = async () => {
    // Save before clearing if there's content
    if (sessionId && messages.length > 0) {
      await handleSave()
    }

    setMessages([])
    setSessionId(undefined)
    setStats(undefined)
    localStorage.removeItem('chat_session_id')
    // Clean up stats for the current session
    if (sessionId) {
      localStorage.removeItem(`chat_stats_${sessionId}`)
    }
  }

  const handleAbort = async () => {
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
  }

  const handleCommand = (name: string, args: string) => {
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
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    const normalized = input.replace(/^／/, '/')
    const cmd = parseCommand(normalized)

    // Allow commands even during streaming
    if (cmd) {
      // Add command as user message to history
      setMessages(prev => [...prev, {
        role: 'user',
        content: normalized,
        timestamp: Date.now()
      }])

      handleCommand(cmd.name, cmd.args)
      setInput('')
      return
    }

    // Block non-command messages during streaming
    if (isStreaming) {
      addMessage('error', 'Cannot send message while streaming. Use /abort to stop generation.')
      return
    }

    const userMsg: MessageType = { role: 'user', content: input, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    let assistantContent = ''
    let toolCalls: MessageType['toolCalls'] = []
    const assistantMsg: MessageType = {
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

      // Check for HTTP errors
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

              // Step 1: Only use stream_event for incremental updates
              // Ignore assistant messages during streaming (they are just snapshots)
              if (msg.type === 'stream_event') {
                const delta = msg.event?.delta

                // Handle text delta
                const deltaText = extractTextContent(msg)
                if (deltaText) {
                  assistantContent += deltaText
                  setMessages(prev => [
                    ...prev.slice(0, -1),
                    { ...assistantMsg, content: assistantContent, toolCalls, isStreaming: true },
                  ])
                }

                // Step 2: Handle tool calls (input_json_delta)
                if (delta?.type === 'input_json_delta') {
                  try {
                    const params = JSON.parse(delta.partial_json)
                    const toolName = detectToolFromParams(params)

                    // Add or update tool call
                    const existingIndex = toolCalls?.findIndex(t => t.name === toolName && t.status === 'running')
                    if (existingIndex !== undefined && existingIndex >= 0) {
                      // Update existing tool call
                      toolCalls![existingIndex].params = params
                    } else {
                      // Add new tool call
                      toolCalls = [...(toolCalls || []), { name: toolName, status: 'running', params }]
                    }

                    setMessages(prev => [
                      ...prev.slice(0, -1),
                      { ...assistantMsg, content: assistantContent, toolCalls, isStreaming: true },
                    ])
                  } catch {
                    // Partial JSON may not be parseable yet, ignore
                  }
                }
              }

              if (msg.type === 'result') {
                // Mark all tools as done
                const completedTools = toolCalls?.map(t => ({ ...t, status: 'done' as const }))

                // Mark streaming complete
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  {
                    ...assistantMsg,
                    content: assistantContent,
                    toolCalls: completedTools,
                    isStreaming: false,
                  },
                ])
                // Update and persist statistics
                const newStats = {
                  sessionId: msg.session_id,
                  duration: msg.duration_ms,
                  usage: msg.usage,
                }
                setStats(newStats)
                localStorage.setItem(`chat_stats_${msg.session_id}`, JSON.stringify(newStats))
                setIsStreaming(false)
              }

              // Handle error messages from backend
              if (msg.type === 'error') {
                // Remove streaming assistant message
                setMessages(prev => prev.slice(0, -1))
                // Add error message
                addMessage('error', msg.message || 'Unknown error occurred')
                // Reset streaming state
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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full font-mono">
      <ChatHeader isSplitView={isSplitView} onToggleSplit={() => setIsSplitView(!isSplitView)} />

      {isSplitView ? (
        <ResizablePanelGroup direction="vertical" className="flex-1">
          <ResizablePanel defaultSize={70} minSize={30}>
            <HistoryPanel messages={messages} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={30} minSize={20}>
            <ActiveChatPanel
              messages={messages}
              scrollRef={scrollRef}
              input={input}
              isStreaming={isStreaming}
              onInputChange={setInput}
              onKeyDown={handleKeyDown}
              context={getContext()}
              repos={repos}
              sessionId={sessionId}
              stats={stats}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <ActiveChatPanel
          messages={messages}
          scrollRef={scrollRef}
          input={input}
          isStreaming={isStreaming}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          context={getContext()}
          repos={repos}
          sessionId={sessionId}
          stats={stats}
        />
      )}
    </div>
  )
}
