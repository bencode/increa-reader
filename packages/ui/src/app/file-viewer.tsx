import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { FileQuestion } from 'lucide-react'

import { fetchPreview } from './api'

type PreviewData =
  | { type: 'markdown'; body: string }
  | { type: 'code'; lang: string; body: string }
  | { type: 'image'; path: string }
  | { type: 'unsupported'; path: string }

export function FileViewer() {
  const { repoName, '*': filePath } = useParams<{ repoName: string; '*': string }>()
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!repoName || !filePath) return

    setLoading(true)
    setError(null)

    fetchPreview(repoName, filePath)
      .then(data => {
        setPreview(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Failed to load file')
        setLoading(false)
      })
  }, [repoName, filePath])

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
    <div className="h-full overflow-auto">
      {preview.type === 'markdown' && (
        <div className="prose prose-sm max-w-none p-8">
          <ReactMarkdown>{preview.body}</ReactMarkdown>
        </div>
      )}

      {preview.type === 'code' && (
        <div className="h-full">
          <SyntaxHighlighter language={preview.lang} style={vscDarkPlus} customStyle={{ margin: 0, height: '100%' }}>
            {preview.body}
          </SyntaxHighlighter>
        </div>
      )}

      {preview.type === 'image' && (
        <div className="h-full flex items-center justify-center p-8">
          <img src={`/api/views/${repoName}/${preview.path}`} alt={preview.path} className="max-w-full max-h-full object-contain" />
        </div>
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
