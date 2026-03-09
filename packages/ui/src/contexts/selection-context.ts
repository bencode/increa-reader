/**
 * Selection context queue - stores user text selections for LLM consumption
 *
 * Toolbar pushes context when user clicks an action.
 * Frontend tool handler reads context when LLM calls get_selection.
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

export type SelectionContext = {
  text: string
  before: string
  after: string
}

const MAX_QUEUE_SIZE = 10

type SelectionQueueState = {
  items: SelectionContext[]
  push: (ctx: SelectionContext) => void
  remove: (index: number) => void
  clear: () => void
}

const useSelectionQueueStore = create<SelectionQueueState>((set) => ({
  items: [],
  push: (ctx) => {
    set((state) => {
      const next = state.items.length >= MAX_QUEUE_SIZE
        ? [...state.items.slice(1), ctx]
        : [...state.items, ctx]
      return { items: next }
    })
  },
  remove: (index) => {
    set((state) => ({
      items: state.items.filter((_, i) => i !== index),
    }))
  },
  clear: () => set({ items: [] }),
}))

export const useSelectionQueue = () =>
  useSelectionQueueStore(useShallow((state) => ({
    items: state.items,
    push: state.push,
    remove: state.remove,
    clear: state.clear,
  })))

const collectSurroundingText = (range: Range, maxChars = 500): { before: string; after: string } => {
  try {
    const ancestor = range.commonAncestorContainer
    const element =
      ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as Element) : ancestor.parentElement

    if (!element) return { before: '', after: '' }

    const section =
      element.closest('[data-index], .prose, pre, article, section') || element

    const beforeRange = document.createRange()
    beforeRange.selectNodeContents(section)
    beforeRange.setEnd(range.startContainer, range.startOffset)

    const afterRange = document.createRange()
    afterRange.selectNodeContents(section)
    afterRange.setStart(range.endContainer, range.endOffset)

    return {
      before: beforeRange.toString().slice(-maxChars),
      after: afterRange.toString().slice(0, maxChars),
    }
  } catch {
    return { before: '', after: '' }
  }
}

export const collectSelectionContext = (selection: Selection): SelectionContext | null => {
  const text = selection.toString().trim()
  if (!text) return null

  try {
    const range = selection.getRangeAt(0)
    const { before, after } = collectSurroundingText(range)
    return { text, before, after }
  } catch {
    return { text, before: '', after: '' }
  }
}
