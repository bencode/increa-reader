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
  { name: 'sessions', description: 'List recently loaded sessions', group: 'Session Management' },
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
    name: 'refine',
    description: 'Distill chat transcripts into agent memory notes',
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
 * /refine is not handled locally: this prompt is sent to the agent, which runs
 * the refine-memory skill (shipped as a server-side plugin) with its own tools.
 */
export const REFINE_TRIGGER_PROMPT =
  'Use the refine-memory skill: read all transcripts under the memory ' +
  "directory's sessions/ folder and distill durable knowledge into " +
  'topic files under refine/.'

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
