export type ViewMode = 'svg' | 'markdown'

export type PDFMetadata = {
  page_count: number
  title: string
  author: string
  subject: string
  creator: string
  producer: string
  creation_date: string
  modification_date: string
  encrypted: boolean
}

export type PDFPageData = {
  type: 'markdown'
  body: string
  page: number
  has_tables: boolean
  has_images: boolean
  estimated_reading_time: number
}

export type PDFPageProps = {
  repo: string
  filePath: string
  pageNum: number
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  notes?: import('@/types/notes').DocumentNote<import('@/types/notes').PDFNotePosition>[]
  draftNotes?: import('@/types/notes').DraftDocumentNote<import('@/types/notes').PDFNotePosition>[]
  onCreateDraft?: (page: number, xRatio: number, yRatio: number) => void
  onMoveNote?: (noteId: string, position: import('@/types/notes').PDFNotePosition) => void
  onChangeColor?: (noteId: string, color: import('@/types/notes').NoteColor) => Promise<void> | void
  onSaveDraft?: (
    note: import('@/types/notes').DraftDocumentNote<import('@/types/notes').PDFNotePosition>,
    content: string,
  ) => Promise<void>
  onSaveNote?: (
    note: import('@/types/notes').DocumentNote<import('@/types/notes').PDFNotePosition>,
    content: string,
  ) => Promise<void>
  onDeleteDraft?: (noteId: string) => void
  onDeleteNote?: (noteId: string) => Promise<void>
  onHeightChange?: (pageNum: number, height: number) => void
}

export type PDFViewerProps = {
  repo: string
  filePath: string
  metadata: PDFMetadata
}
