import { useEffect, useRef } from 'react'

type ChatInputProps = {
  input: string
  isStreaming: boolean
  onInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export const ChatInput = ({ input, isStreaming, onInputChange, onKeyDown }: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to recalculate
    textarea.style.height = '0px'
    // Set new height based on scrollHeight
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [input])

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-start gap-2">
      <span className="text-blue-700 dark:text-blue-500 leading-normal">&gt;</span>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        className="flex-1 bg-transparent outline-none caret-blue-500 text-blue-700 dark:text-blue-300 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none overflow-hidden leading-normal"
        style={{ maxHeight: '12rem' }}
        placeholder={isStreaming ? 'type /abort to stop generation' : 'type /help for commands (Shift+Enter for new line)'}
        spellCheck={false}
      />
    </div>
  )
}
