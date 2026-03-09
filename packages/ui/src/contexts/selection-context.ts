/**
 * Selection context queue - stores user text selections for LLM consumption
 *
 * Toolbar pushes context when user clicks an action.
 * Frontend tool handler shifts context when LLM calls get_selection.
 */

export type SelectionContext = {
  text: string
  before: string
  after: string
}

const queue: SelectionContext[] = []
const MAX_QUEUE_SIZE = 10

export const pushContext = (ctx: SelectionContext) => {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift()
  }
  queue.push(ctx)
}

export const shiftContext = (): SelectionContext | null => {
  return queue.shift() ?? null
}

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
