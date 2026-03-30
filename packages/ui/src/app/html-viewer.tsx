import { Code, Eye } from 'lucide-react'
import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'

type HtmlViewerProps = {
  body: string
}

type ViewMode = 'preview' | 'source'

export function HtmlViewer({ body }: HtmlViewerProps) {
  const [mode, setMode] = useState<ViewMode>('preview')

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b bg-background/80 backdrop-blur-sm px-2 py-1">
        <Button
          variant={mode === 'preview' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setMode('preview')}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
        <Button
          variant={mode === 'source' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setMode('source')}
        >
          <Code className="h-3.5 w-3.5" />
          Source
        </Button>
      </div>

      {mode === 'preview' ? (
        <iframe srcDoc={body} className="flex-1 border-0" title="HTML Preview" />
      ) : (
        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter
            language="html"
            style={vscDarkPlus}
            customStyle={{ margin: 0, height: '100%' }}
          >
            {body}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}
