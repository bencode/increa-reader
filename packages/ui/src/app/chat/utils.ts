export const HELP_TEXT = `Available commands:
  /cd <repo>   Switch to repo context
  /pwd         Show current context
  /clear       Clear messages
  /help        Show this help

Examples:
  $ /cd pages
  $ where is FileTree?
  $ /cd book
`

export const parseCommand = (input: string) => {
  const match = input.match(/^\/(\w+)(?:\s+(.*))?$/)
  if (!match) return null
  return {
    name: match[1],
    args: match[2]?.trim() || '',
  }
}

export const extractTextContent = (msg: any): string => {
  // Handle Python SDK assistant message format
  if (msg.type === 'assistant' && msg.content) {
    return msg.content
  }

  // Handle TypeScript SDK message format (backward compatibility)
  if (msg.type === 'assistant' && msg.message?.content) {
    return msg.message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')
  }

  // Handle stream events
  if (msg.type === 'stream_event' && msg.event?.type === 'content_block_delta') {
    return msg.event.delta?.text || ''
  }

  return ''
}

export const detectToolFromParams = (params: Record<string, any>): string => {
  if ('file_path' in params) return 'Read'
  if ('todos' in params) return 'TodoWrite'
  if ('pattern' in params && 'path' in params) return 'Grep'
  if ('pattern' in params) return 'Glob'
  if ('command' in params) return 'Bash'
  return 'Tool'
}
