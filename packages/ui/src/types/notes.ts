export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink'

export type MarkdownNotePosition = {
  headingPath: string[]
  blockText: string
  blockIndex: number
  xRatio: number
  yRatio: number
}

export type PDFNotePosition = {
  page: number
  xRatio: number
  yRatio: number
}

export type NotePosition = MarkdownNotePosition | PDFNotePosition

export type DocumentFileType = 'markdown' | 'pdf'

export type DocumentNote<TPosition extends NotePosition = NotePosition> = {
  id: string
  color: NoteColor
  content: string
  createdAt: string
  updatedAt: string
  position: TPosition
}

export type DraftDocumentNote<TPosition extends NotePosition = NotePosition> =
  DocumentNote<TPosition> & {
    isDraft: true
  }

export type NoteDocumentContext = {
  repo: string
  path: string
  fileType: DocumentFileType
}

export type NoteLocator = {
  label: string
  page: number | null
  headingPath: string[] | null
  anchorText: string | null
}

export type StandardizedNote = {
  id: string
  color: NoteColor
  content: string
  locator: NoteLocator
  updatedAt: string
}

export const NOTE_COLORS: NoteColor[] = ['yellow', 'blue', 'green', 'pink']

export function isPDFNotePosition(position: NotePosition): position is PDFNotePosition {
  return 'page' in position
}

export function isMarkdownNotePosition(position: NotePosition): position is MarkdownNotePosition {
  return 'blockIndex' in position
}
