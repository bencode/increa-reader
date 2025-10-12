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
  onHeightChange?: (pageNum: number, height: number) => void
}

export type PDFViewerProps = {
  repo: string
  filePath: string
  metadata: PDFMetadata
}
