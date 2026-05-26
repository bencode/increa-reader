import type { CommandSpec } from './command-registry'

type CommandMenuProps = {
  items: CommandSpec[]
  selectedIndex: number
  onSelect: (cmd: CommandSpec) => void
}

export const CommandMenu = ({ items, selectedIndex, onSelect }: CommandMenuProps) => {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1 z-10">
      {items.map((cmd, i) => (
        <button
          key={cmd.name}
          type="button"
          // onMouseDown (not click) keeps the textarea focused on select
          onMouseDown={e => {
            e.preventDefault()
            onSelect(cmd)
          }}
          className={`w-full flex items-baseline gap-2 px-3 py-1.5 text-left text-sm ${
            i === selectedIndex
              ? 'bg-blue-50 dark:bg-blue-900/40'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <span className="text-blue-700 dark:text-blue-300 whitespace-nowrap">
            /{cmd.name}
            {cmd.args ? (
              <span className="text-gray-400 dark:text-gray-500"> {cmd.args}</span>
            ) : null}
          </span>
          <span className="text-gray-500 dark:text-gray-400 truncate">{cmd.description}</span>
        </button>
      ))}
    </div>
  )
}
