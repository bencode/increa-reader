type MessageBlock = {
  type: string
  text?: string
}

type StreamMessage = {
  type: string
  content?: string
  message?: {
    content: MessageBlock[]
  }
  event?: {
    type: string
    delta?: {
      text?: string
    }
  }
}

export const HELP_TEXT = `Available commands:
  /save        Save chat history to file
  /clear       Save and clear messages
  /abort       Abort current generation
  /help        Show this help

Tip: Context follows the file you select in the left panel.
`

export const parseCommand = (input: string) => {
  const match = input.match(/^\/(\w+)(?:\s+(.*))?$/)
  if (!match) return null
  return {
    name: match[1],
    args: match[2]?.trim() || '',
  }
}

export const extractTextContent = (msg: StreamMessage): string => {
  // Handle Python SDK assistant message format
  if (msg.type === 'assistant' && msg.content) {
    return msg.content
  }

  // Handle TypeScript SDK message format (backward compatibility)
  if (msg.type === 'assistant' && msg.message?.content) {
    return msg.message.content
      .filter((block: MessageBlock) => block.type === 'text')
      .map((block: MessageBlock) => block.text || '')
      .join('\n')
  }

  // Handle stream events
  if (msg.type === 'stream_event' && msg.event?.type === 'content_block_delta') {
    return msg.event.delta?.text || ''
  }

  return ''
}

export const detectToolFromParams = (params: Record<string, unknown>): string => {
  if ('file_path' in params) return 'Read'
  if ('todos' in params) return 'TodoWrite'
  if ('pattern' in params && 'path' in params) return 'Grep'
  if ('pattern' in params) return 'Glob'
  if ('command' in params) return 'Bash'
  return 'Tool'
}
