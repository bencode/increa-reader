import type { Session } from '@/types/chat'
import type { useSessionManager } from './use-session-manager'
import { useEventCallback } from '@/hooks/use-event-callback'
import { HELP_TEXT } from '../utils'

type CommandContext = {
  currentSession: Session | null
  setCurrentSession: (session: Session | null) => void
  sessionManager: ReturnType<typeof useSessionManager>
}

export const useCommands = (ctx: CommandContext) => {
  const { currentSession, setCurrentSession, sessionManager } = ctx

  const addMessage = (role: 'user' | 'assistant' | 'system' | 'error', content: string) => {
    setCurrentSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [...prev.messages, { role, content, timestamp: Date.now() }],
        lastActiveAt: Date.now(),
      }
    })
  }

  const handleSave = async () => {
    if (!currentSession || currentSession.messages.length === 0) {
      addMessage('error', 'No chat history to save')
      return
    }

    try {
      const response = await fetch('/api/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.stats?.sessionId,
          messages: currentSession.messages,
          stats: currentSession.stats,
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
    if (!currentSession) {
      addMessage('error', 'No active session to clear')
      return
    }

    // Clear messages and Claude SDK session, but keep the session itself
    const clearedSession = {
      ...currentSession,
      messages: [],
      stats: {}, // Clear Claude SDK sessionId to start fresh context
      lastActiveAt: Date.now(),
    }
    setCurrentSession(clearedSession)

    // Save cleared session to backend
    await sessionManager.saveSession(clearedSession)

    // Add system message to indicate clearing
    addMessage('system', 'Messages cleared. Starting fresh conversation.')
  }

  const handleAbort = async () => {
    const claudeSessionId = currentSession?.stats?.sessionId
    if (!claudeSessionId) {
      addMessage('error', 'No active session to abort')
      return
    }

    try {
      const response = await fetch('/api/chat/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: claudeSessionId }),
      })

      if (response.ok) {
        addMessage('system', 'Aborted current generation')
      } else {
        const error = await response.json()
        addMessage('error', error.detail || 'Failed to abort')
      }
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Failed to abort')
    }
  }

  const loadSession = async (id: string) => {
    const session = await sessionManager.loadSession(id)
    setCurrentSession(session)
  }

  const handleCommand = useEventCallback(async (name: string, args: string) => {
    const commands: Record<string, () => void | Promise<void>> = {
      help: () => addMessage('system', HELP_TEXT),
      save: () => handleSave(),
      clear: () => handleClear(),
      abort: () => handleAbort(),

      sessions: () => {
        const sessions = sessionManager.sessions
        if (sessions.length === 0) {
          addMessage('system', 'No sessions found. Create one with `/new [title]`')
          return
        }
        const list = sessions
          .map((s, i) => {
            const isCurrent = s.id === currentSession?.id
            const date = new Date(s.lastActiveAt).toLocaleString()
            const marker = isCurrent ? ' (current)' : ''
            return `${i + 1}. **${s.title}**${marker} - ${date}`
          })
          .join('\n')
        addMessage('system', `## Sessions (${sessions.length})\n\n${list}`)
      },

      new: async () => {
        if (currentSession && currentSession.messages.length > 0) {
          await sessionManager.saveSession(currentSession)
        }
        const newSession = sessionManager.createSession(args || 'New Chat')
        setCurrentSession(newSession)
        addMessage('system', `Created new session: **${newSession.title}**`)
      },

      switch: async () => {
        if (!args) {
          addMessage('error', 'Usage: /switch <id or index>')
          return
        }
        const sessions = sessionManager.sessions
        let targetId = args
        const index = parseInt(args, 10)
        if (!isNaN(index) && index > 0 && index <= sessions.length) {
          targetId = sessions[index - 1].id
        }
        try {
          if (currentSession && currentSession.messages.length > 0) {
            await sessionManager.saveSession(currentSession)
          }
          await loadSession(targetId)
          const session = sessionManager.sessions.find(s => s.id === targetId)
          addMessage('system', `Switched to session: **${session?.title || targetId}**`)
        } catch {
          addMessage('error', 'Session not found')
        }
      },

      rename: async () => {
        if (!args) {
          addMessage('error', 'Usage: /rename <new title>')
          return
        }
        if (!currentSession) {
          addMessage('error', 'No active session to rename')
          return
        }
        const updatedSession = { ...currentSession, title: args, lastActiveAt: Date.now() }
        setCurrentSession(updatedSession)
        await sessionManager.saveSession(updatedSession)
        addMessage('system', `Session renamed to: **${args}**`)
      },

      delete: async () => {
        if (!args) {
          addMessage('error', 'Usage: /delete <id or index>')
          return
        }
        const sessions = sessionManager.sessions
        let targetId = args
        const index = parseInt(args, 10)
        if (!isNaN(index) && index > 0 && index <= sessions.length) {
          targetId = sessions[index - 1].id
        }
        try {
          await sessionManager.deleteSession(targetId)
          addMessage('system', 'Session deleted')
          if (currentSession?.id === targetId) {
            setCurrentSession(null)
          }
        } catch {
          addMessage('error', 'Failed to delete session')
        }
      },
    }

    const handler = commands[name]
    if (handler) {
      await handler()
    } else {
      addMessage('error', `Unknown command: /${name}. Type /help for available commands.`)
    }
  })

  return { handleCommand }
}
