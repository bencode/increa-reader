import { FileQuestion } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useVisibleContent } from '@/contexts/visible-content-context'
import { useNoteToolStore } from '@/stores/note-tool-store'
import { useRefreshKey, useSetContext } from '@/stores/view-context'
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

export function FileViewer() {
  const { repoName, '*': filePath } = useParams<{ repoName: string; '*': string }>()
  const [state, setState] = useState<{
    preview: PreviewData | null
    loading: boolean
    error: string | null
  }>({
    preview: null,
    loading: true,
    error: null,
  })
  const setContext = useSetContext()
  const refreshKey = useRefreshKey()
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const elementsRef = useVisibleContent()
  const prevRouteRef = useRef({ repoName, filePath })
  const fetchIdRef = useRef(0)

  useEffect(() => {
    if (!repoName || !filePath) return

    const isRouteChange =
      prevRouteRef.current.repoName !== repoName || prevRouteRef.current.filePath !== filePath
    prevRouteRef.current = { repoName, filePath }

    // Update view context (clear pageNumber for non-PDF files)
    setContext({ repo: repoName, path: filePath, pageNumber: null })

    // Only show loading state on route change, not on refresh
    if (isRouteChange) {
      setState({ preview: null, loading: true, error: null })
    }

    const id = ++fetchIdRef.current
    fetchPreview(repoName, filePath)
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
  }, [repoName, filePath, setContext, refreshKey])

  // Setup IntersectionObserver to track visible elements
  useEffect(() => {
    const scrollBody = scrollBodyRef.current
    if (!scrollBody) return

    // Capture ref value for cleanup
    const elements = elementsRef.current

    // Clear previous elements
    elements.clear()

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            elementsRef.current.add(entry.target as HTMLElement)
          } else {
            elementsRef.current.delete(entry.target as HTMLElement)
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
    })

    return () => {
      observer.disconnect()
      elements.clear()
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
          repoName={repoName!}
          filePath={filePath!}
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
        <ImageViewer src={`/api/raw/${repoName}/${preview.path}`} alt={preview.path} />
      )}

      {preview.type === 'pdf' && (
        <PDFViewer repo={repoName!} filePath={preview.path} metadata={preview.metadata} />
      )}

      {preview.type === 'board' && (
        <BoardViewer repo={repoName} filePath={preview.path} data={preview.data} />
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
