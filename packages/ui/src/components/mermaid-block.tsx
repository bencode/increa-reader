import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

let idCounter = 0

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${Date.now()}-${idCounter++}`)

  useEffect(() => {
    const pre = containerRef.current?.closest('pre')
    if (pre) {
      pre.style.background = 'transparent'
      pre.style.padding = '0'
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    const render = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, code)
        if (!cancelled) {
          container.innerHTML = svg
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render mermaid diagram')
          container.innerHTML = ''
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <div>
        <div className="text-xs text-red-500 mb-1">Mermaid render error</div>
        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-auto">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return <div ref={containerRef} className="my-2 overflow-auto rounded-md bg-white p-4" />
}
