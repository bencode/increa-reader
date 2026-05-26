import { useState } from 'react'
import type { CommandSpec } from '../command-registry'
import { filterCommands, matchCommandQuery } from '../command-registry'

type CommandMenuContext = {
  value: string
  setValue: (v: string) => void
}

type NavState = { value: string; index: number; dismissed: boolean }

/**
 * Slash-command autocomplete state machine. Derives the candidate list from
 * the current input and arbitrates keyboard navigation. Self-contained: the
 * only side effect is `setValue` when a command is completed.
 *
 * Selection and dismissal are tracked against the input value they belong to,
 * so they reset automatically when the user types — no effect needed.
 */
export const useCommandMenu = ({ value, setValue }: CommandMenuContext) => {
  const [nav, setNav] = useState<NavState>({ value: '', index: 0, dismissed: false })

  const query = matchCommandQuery(value)
  const items = query === null ? [] : filterCommands(query)

  const fresh = nav.value !== value
  const selectedIndex = fresh ? 0 : Math.min(nav.index, Math.max(items.length - 1, 0))
  const dismissed = fresh ? false : nav.dismissed
  const isOpen = items.length > 0 && !dismissed

  const select = (cmd: CommandSpec) => {
    // Trailing space closes the menu (query no longer matches) and readies args
    setValue(`/${cmd.name} `)
  }

  const handleKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!isOpen) return false

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setNav({ value, index: (selectedIndex + 1) % items.length, dismissed: false })
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setNav({ value, index: (selectedIndex - 1 + items.length) % items.length, dismissed: false })
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      select(items[selectedIndex] ?? items[0])
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setNav({ value, index: selectedIndex, dismissed: true })
      return true
    }
    return false
  }

  return { isOpen, items, selectedIndex, handleKeyDown, select }
}
