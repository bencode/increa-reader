import { useEffect, useRef, useState } from 'react'

import type { Message as MessageType, Repo } from '@/types/chat'
import { useGetContext } from '@/stores/view-context'
import { HELP_TEXT, parseCommand, extractTextContent, detectToolFromParams } from './utils'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { ChatStats } from './chat-stats'

export const ChatPanel = () => {
  const [messages, setMessages] = useState<MessageType[]>([])
  const [input, setInput] = useState('')
  const [currentRepo, setCurrentRepo] = useState<string>('')
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const getContext = useGetContext()

  useEffect(() => {
    fetch('/api/workspace/tree')
      .then(res => res.json())
      .then(data => {
        const repoList = data.data || []
        setRepos(repoList)
        // Set first repo as default
        if (repoList.length > 0 && !currentRepo) {
          setCurrentRepo(repoList[0].name)
        }
      })
      .catch(console.error)
  }, [currentRepo])

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
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (role: MessageType['role'], content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }])
  }

  const handleClear = () => {
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
      case 'cd': {
        if (!args) {
          addMessage('error', 'Usage: /cd <repo>')
          return
        }
        const found = repos.find(r => r.name === args)
        if (found) {
          setCurrentRepo(args)
          addMessage('system', `Context → ${args}`)
        } else {
          addMessage('error', `Repo not found: ${args}`)
        }
        break
      }

      case 'pwd':
        addMessage('system', currentRepo || 'No repo selected')
        break

      case 'help':
        addMessage('system', HELP_TEXT)
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
          repo: currentRepo,
          context,
        }),
      })

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
            console.log('message', { data })
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
    <div className="flex flex-col h-full font-mono bg-gray-50 dark:bg-gray-900">
      <MessageList messages={messages} scrollRef={scrollRef} />
      <ChatInput
        input={input}
        isStreaming={isStreaming}
        onInputChange={setInput}
        onKeyDown={handleKeyDown}
      />
      <ChatStats currentRepo={currentRepo} sessionId={sessionId} stats={stats} />
    </div>
  )
}
