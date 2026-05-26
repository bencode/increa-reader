import { useCallback, useEffect, useRef } from 'react'
import { uploadImage } from '@/lib/upload'
import { CommandMenu } from './command-menu'
import { useCommandMenu } from './hooks/use-command-menu'

type ChatInputProps = {
  input: string
  isStreaming: boolean
  onInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onInsertText: (text: string) => void
}

export const ChatInput = ({
  input,
  isStreaming,
  onInputChange,
  onKeyDown,
  onInsertText,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menu = useCommandMenu({ value: input, setValue: onInputChange })

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (menu.handleKeyDown(e)) return
      onKeyDown(e)
    },
    [menu, onKeyDown],
  )

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to recalculate
    textarea.style.height = '0px'
    // Set new height based on scrollHeight
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [input])

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (!item.type.startsWith('image/')) continue

        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue

        try {
          const { absolutePath } = await uploadImage(blob)
          onInsertText(`![screenshot](${absolutePath})`)
        } catch (err) {
          console.error('Failed to upload image:', err)
        }
        return
      }
    },
    [onInsertText],
  )

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-start gap-2">
      <span className="text-blue-700 dark:text-blue-500 leading-normal">&gt;</span>
      <div className="relative flex-1">
        {menu.isOpen && (
          <CommandMenu
            items={menu.items}
            selectedIndex={menu.selectedIndex}
            onSelect={menu.select}
          />
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          className="w-full bg-transparent outline-none caret-blue-500 text-blue-700 dark:text-blue-300 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none overflow-hidden leading-normal"
          style={{ maxHeight: '12rem' }}
          placeholder={
            isStreaming
              ? 'type /abort to stop generation'
              : 'type /help for commands (Shift+Enter for new line)'
          }
          spellCheck={false}
        />
      </div>
    </div>
  )
}
