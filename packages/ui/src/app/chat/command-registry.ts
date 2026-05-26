export type CommandGroup = 'Basic' | 'Session Management' | 'Model'

export type CommandSpec = {
  name: string
  args?: string
  description: string
  group: CommandGroup
}

export const COMMANDS: CommandSpec[] = [
  { name: 'save', description: 'Save chat history to file', group: 'Basic' },
  { name: 'clear', description: 'Clear messages and start new session', group: 'Basic' },
  { name: 'abort', description: 'Abort current generation', group: 'Basic' },
  { name: 'help', description: 'Show available commands', group: 'Basic' },
  { name: 'sessions', description: 'List all sessions', group: 'Session Management' },
  {
    name: 'new',
    args: '[title]',
    description: 'Create new session with optional title',
    group: 'Session Management',
  },
  {
    name: 'switch',
    args: '<id>',
    description: 'Switch to session by id or index',
    group: 'Session Management',
  },
  {
    name: 'rename',
    args: '<title>',
    description: 'Rename current session',
    group: 'Session Management',
  },
  {
    name: 'autoname',
    description: 'Summarize current conversation into a title',
    group: 'Session Management',
  },
  {
    name: 'delete',
    args: '<id>',
    description: 'Delete session by id or index',
    group: 'Session Management',
  },
  {
    name: 'model',
    args: '[name]',
    description: 'Switch model (sonnet, opus, haiku) or show current',
    group: 'Model',
  },
]

/**
 * Whether the input is still in the "picking a command" stage:
 * a leading slash followed by a command name, with no space yet.
 * Returns the typed command fragment (may be empty), or null otherwise.
 */
export const matchCommandQuery = (input: string): string | null => {
  const match = input.match(/^[/／](\w*)$/)
  return match ? match[1] : null
}

export const filterCommands = (query: string): CommandSpec[] => {
  const q = query.toLowerCase()
  return COMMANDS.filter(c => c.name.startsWith(q))
}
