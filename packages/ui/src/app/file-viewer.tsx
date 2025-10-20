import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { FileQuestion } from 'lucide-react'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { fetchPreview } from './api'
import { PDFViewer } from './pdf-viewer'
import { useSetContext } from '@/stores/view-context'

type PreviewData =
  | { type: 'markdown'; body: string }
  | { type: 'code'; lang: string; body: string }
  | { type: 'image'; path: string }
  | { type: 'pdf'; path: string; metadata: PDFMetadata }
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

  useEffect(() => {
    if (!repoName || !filePath) return

    // Update view context
    setContext({ repo: repoName, path: filePath })

    // eslint-disable-next-line
    setState({ preview: null, loading: true, error: null })

    fetchPreview(repoName, filePath)
      .then(data => {
        setState({ preview: data, loading: false, error: null })
      })
      .catch(err => {
        setState({ preview: null, loading: false, error: err.message || 'Failed to load file' })
      })
  }, [repoName, filePath, setContext])

  const { loading, error, preview } = state

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

  return (
    <div className="h-full overflow-auto scroll-body">
      {preview.type === 'markdown' && (
        <div className="prose prose-slate dark:prose-invert max-w-none p-4 prose-headings:text-lg prose-headings:my-2 prose-h1:text-2xl prose-h1:my-3 prose-h2:text-xl prose-h2:my-2.5 prose-h3:text-lg prose-h3:my-2 prose-h4:text-base prose-h4:my-1.5 prose-h5:text-sm prose-h5:my-1 prose-h6:text-xs prose-h6:my-1 prose-p:my-1 prose-p:leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                return match ? (
                  <SyntaxHighlighter
                    language={match[1]}
                    style={vscDarkPlus}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: 0, background: 'transparent' }}
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {preview.body}
          </ReactMarkdown>
        </div>
      )}

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
        <div className="h-full flex items-center justify-center p-8">
          <img
            src={`/api/views/${repoName}/${preview.path}`}
            alt={preview.path}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {preview.type === 'pdf' && (
        <PDFViewer repo={repoName!} filePath={preview.path} metadata={preview.metadata} />
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
