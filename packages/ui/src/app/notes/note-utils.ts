import type {
  DocumentNote,
  DraftDocumentNote,
  MarkdownNotePosition,
  NoteColor,
  StandardizedNote,
} from '@/types/notes'

export type MarkdownBlockMeta = {
  element: HTMLElement
  index: number
  text: string
  normalizedText: string
  headingPath: string[]
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function createDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createDraftMarkdownNote(
  color: NoteColor,
  position: MarkdownNotePosition,
): DraftDocumentNote<MarkdownNotePosition> {
  const now = new Date().toISOString()
  return {
    id: createDraftId(),
    color,
    content: '',
    createdAt: now,
    updatedAt: now,
    position,
    isDraft: true,
  }
}

export function createDraftPDFNote(
  color: NoteColor,
  position: { page: number; xRatio: number; yRatio: number },
): DraftDocumentNote<{ page: number; xRatio: number; yRatio: number }> {
  const now = new Date().toISOString()
  return {
    id: createDraftId(),
    color,
    content: '',
    createdAt: now,
    updatedAt: now,
    position,
    isDraft: true,
  }
}

function isHeadingElement(element: Element) {
  return /^H[1-6]$/.test(element.tagName)
}

export function collectMarkdownBlocks(root: HTMLElement): MarkdownBlockMeta[] {
  const blocks = Array.from(root.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  )
  const stack: string[] = []

  return blocks.map((element, index) => {
    if (isHeadingElement(element)) {
      const level = Number.parseInt(element.tagName.slice(1), 10)
      stack.splice(level - 1)
      stack[level - 1] = normalizeText(element.textContent || '')
    }

    return {
      element,
      index,
      text: normalizeText(element.textContent || ''),
      normalizedText: normalizeText(element.textContent || '').toLowerCase(),
      headingPath: stack.filter(Boolean),
    }
  })
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function findBestMarkdownBlock(
  blocks: MarkdownBlockMeta[],
  position: MarkdownNotePosition,
): MarkdownBlockMeta | null {
  if (blocks.length === 0) return null

  const normalizedAnchor = normalizeText(position.blockText).toLowerCase()
  const scopedBlocks =
    position.headingPath.length > 0
      ? blocks.filter(block => arraysEqual(block.headingPath, position.headingPath))
      : blocks

  if (normalizedAnchor) {
    const exactMatch = scopedBlocks.find(block => block.normalizedText === normalizedAnchor)
    if (exactMatch) return exactMatch

    const partialMatch = scopedBlocks.find(
      block =>
        block.normalizedText.includes(normalizedAnchor) ||
        normalizedAnchor.includes(block.normalizedText),
    )
    if (partialMatch) return partialMatch

    const globalMatch = blocks.find(
      block =>
        block.normalizedText.includes(normalizedAnchor) ||
        normalizedAnchor.includes(block.normalizedText),
    )
    if (globalMatch) return globalMatch
  }

  const indexMatch = blocks[position.blockIndex]
  if (indexMatch) return indexMatch

  return scopedBlocks[0] ?? blocks[0] ?? null
}

export function buildMarkdownLocator(note: DocumentNote<MarkdownNotePosition>): StandardizedNote {
  const label =
    note.position.headingPath.length > 0 ? note.position.headingPath.join(' / ') : 'Document'

  return {
    id: note.id,
    color: note.color,
    content: note.content,
    locator: {
      label,
      page: null,
      headingPath: note.position.headingPath,
      anchorText: note.position.blockText || null,
    },
    updatedAt: note.updatedAt,
  }
}

export function nearestMarkdownBlockFromPoint(
  blocks: MarkdownBlockMeta[],
  containerRect: DOMRect,
  layout: { left: number; top: number; width: number; height: number },
) {
  if (blocks.length === 0) return null

  const centerX = layout.left + layout.width / 2
  const centerY = layout.top + layout.height / 2

  let closest: MarkdownBlockMeta | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const block of blocks) {
    const rect = block.element.getBoundingClientRect()
    const left = rect.left - containerRect.left
    const top = rect.top - containerRect.top
    const width = rect.width
    const height = rect.height
    const dx = centerX - (left + width / 2)
    const dy = centerY - (top + height / 2)
    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      bestDistance = distance
      closest = block
    }
  }

  return closest
}

export function nearestMarkdownBlockFromClientPoint(
  blocks: MarkdownBlockMeta[],
  clientX: number,
  clientY: number,
) {
  if (blocks.length === 0) return null

  let closest: MarkdownBlockMeta | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const block of blocks) {
    const rect = block.element.getBoundingClientRect()
    const dx =
      clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0
    const dy =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0
    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      bestDistance = distance
      closest = block
    }
  }

  return closest
}
