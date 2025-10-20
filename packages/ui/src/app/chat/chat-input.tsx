type ChatInputProps = {
  input: string
  isStreaming: boolean
  onInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export const ChatInput = ({ input, isStreaming, onInputChange, onKeyDown }: ChatInputProps) => {
  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <span className="text-blue-700 dark:text-blue-500">&gt;</span>
      <input
        value={input}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="flex-1 bg-transparent outline-none caret-blue-500 text-blue-700 dark:text-blue-300 placeholder:text-gray-500 dark:placeholder:text-gray-400"
        placeholder="type /help for commands"
        spellCheck={false}
        disabled={isStreaming}
      />
    </div>
  )
}
