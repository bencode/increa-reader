import { useEffect } from 'react'
import type { SSEMessage } from '@/types/chat'
import { executeFrontendTool, type ToolContext } from '../frontend-tools'
import { useVisibleContent } from '../../../contexts/visible-content-context'

export const useFrontendTools = () => {
  const elementsRef = useVisibleContent()
  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      console.log('[Frontend Tools] Connecting to SSE...')
      eventSource = new EventSource('/api/chat/frontend-events')

      eventSource.onopen = () => {
        console.log('[Frontend Tools] SSE connected')
      }

      eventSource.onmessage = async event => {
        try {
          const msg = JSON.parse(event.data) as SSEMessage

          if (msg.type === 'tool_call') {
            const { call_id, name, arguments: args } = msg

            // Build tool context
            const ctx: ToolContext = {
              visibleElements: elementsRef.current,
            }

            const toolResult = await executeFrontendTool(ctx, name, args)
            console.log(`[Frontend Tool] Executing ${name}, args: %o, result: %o`, args, toolResult)

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
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      console.log('[Frontend Tools] Cleaning up SSE connection')
      eventSource?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [elementsRef])
}
