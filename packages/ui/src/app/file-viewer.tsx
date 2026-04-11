import { FileQuestion } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useVisibleContent } from '@/contexts/visible-content-context'
import { useNoteToolStore } from '@/stores/note-tool-store'
import { useRefreshKey } from '@/stores/view-context'
import type { BoardFile } from '@/types/board'
import { fetchPreview } from './api'
import { BoardViewer } from './board-viewer'
import { HtmlViewer } from './html-viewer'
import { ImageViewer } from './image-viewer'
import { MarkdownViewer } from './markdown/markdown-viewer'
import { PDFViewer } from './pdf-viewer'
import { SelectionToolbar } from './selection/selection-toolbar'

type PreviewData =
  | { type: 'markdown'; body: string }
  | { type: 'code'; lang: string; body: string }
  | { type: 'image'; path: string }
  | { type: 'pdf'; path: string; metadata: PDFMetadata }
  | { type: 'board'; path: string; data: BoardFile }
  | { type: 'html'; path: string; body: string }
  | { type: 'unsupported'; path: string }

type PDFMetadata = {
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

type FileViewerProps = {
  repo: string
  path: string
}

export function FileViewer({ repo, path }: FileViewerProps) {
  const [state, setState] = useState<{
    preview: PreviewData | null
    loading: boolean
    error: string | null
  }>({
    preview: null,
    loading: true,
    error: null,
  })
  const refreshKey = useRefreshKey()
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const elementsRef = useVisibleContent()
  const fetchedFileRef = useRef<string | null>(null)
  const fetchedRefreshKeyRef = useRef<number | null>(null)
  const fetchIdRef = useRef(0)

  useEffect(() => {
    if (!repo || !path) return

    const fileKey = `${repo}:${path}`
    const isSameFetch =
      fetchedFileRef.current === fileKey && fetchedRefreshKeyRef.current === refreshKey
    if (isSameFetch) return

    const isRouteChange = fetchedFileRef.current !== fileKey
    fetchedFileRef.current = fileKey
    fetchedRefreshKeyRef.current = refreshKey

    if (isRouteChange) {
      setState({ preview: null, loading: true, error: null })
    }

    const id = ++fetchIdRef.current
    fetchPreview(repo, path)
      .then(data => {
        if (id === fetchIdRef.current) {
          setState({ preview: data, loading: false, error: null })
        }
      })
      .catch(err => {
        if (id === fetchIdRef.current) {
          setState({ preview: null, loading: false, error: err.message || 'Failed to load file' })
        }
      })
  }, [repo, path, refreshKey])

  // Setup IntersectionObserver to track visible elements
  useEffect(() => {
    const scrollBody = scrollBodyRef.current
    if (!scrollBody) return

    const elementsSet = elementsRef.current
    const observedElements = new Set<HTMLElement>()

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            elementsSet.add(entry.target as HTMLElement)
          } else {
            elementsSet.delete(entry.target as HTMLElement)
          }
        })
      },
      {
        root: scrollBody,
        rootMargin: '100px',
        threshold: 0.1,
      },
    )

    // Observe target elements (prose content, code blocks, PDF pages)
    const targets = scrollBody.querySelectorAll('.prose > *, pre, code, [data-index]')
    targets.forEach(el => {
      observer.observe(el)
      observedElements.add(el as HTMLElement)
    })

    return () => {
      observer.disconnect()
      observedElements.forEach(el => {
        elementsSet.delete(el)
      })
    }
  }, [state.preview, elementsRef])

  const { loading, error, preview } = state

  useEffect(() => {
    if (!preview || (preview.type !== 'markdown' && preview.type !== 'pdf')) {
      useNoteToolStore.getState().clear()
    }
  }, [preview])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (!preview) {
    return null
  }

  if (preview.type === 'html') {
    return <HtmlViewer body={preview.body} />
  }

  if (preview.type === 'markdown') {
    return (
      <div className="h-full relative">
        <MarkdownViewer
          body={preview.body}
          repoName={repo}
          filePath={path}
          elementsRef={elementsRef}
        />
      </div>
    )
  }

  return (
    <div ref={scrollBodyRef} className="h-full overflow-auto scroll-body">
      <SelectionToolbar containerRef={scrollBodyRef} />

      {preview.type === 'code' && (
        <div>
          <SyntaxHighlighter
            language={preview.lang}
            style={vscDarkPlus}
            customStyle={{ margin: 0, height: '100%' }}
          >
            {preview.body}
          </SyntaxHighlighter>
        </div>
      )}

      {preview.type === 'image' && (
        <ImageViewer src={`/api/raw/${repo}/${preview.path}`} alt={preview.path} />
      )}

      {preview.type === 'pdf' && (
        <PDFViewer repo={repo} filePath={preview.path} metadata={preview.metadata} />
      )}

      {preview.type === 'board' && (
        <BoardViewer repo={repo} filePath={preview.path} data={preview.data} />
      )}

      {preview.type === 'unsupported' && (
        <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <FileQuestion size={48} />
          <p>Unsupported file type</p>
          <p className="text-sm font-mono">{preview.path}</p>
        </div>
      )}
    </div>
  )
}
