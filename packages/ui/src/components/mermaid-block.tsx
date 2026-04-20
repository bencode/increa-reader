import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  // STIX first: the only widely-available font that correctly renders combining
  // marks like x⃗ (U+20D7) and math symbols (∏/∑/·). Mermaid's default
  // 'trebuchet ms' chain renders them as tofu; system-ui renders U+20D7 as
  // horizontal bars on macOS. STIX gives proper math glyphs; Chinese falls back
  // through the chain to system CJK fonts.
  fontFamily: '"STIX Two Math", "STIXGeneral", "Trebuchet MS", Verdana, Arial, sans-serif',
})

let idCounter = 0

// Mermaid 11.x parser breaks on lines that are exactly `%%` (empty comment).
// Non-empty `%% foo` comments are fine. Strip the empty ones before rendering.
function sanitizeMermaidSource(src: string): string {
  return src.replace(/^[ \t]*%%[ \t]*$\n?/gm, '')
}

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

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
    // Fresh id per effect run: avoids collision across React StrictMode /
    // Activity remounts where a stale cleanup can delete the temp element
    // mermaid still needs for the current render.
    const id = `mermaid-${Date.now()}-${idCounter++}`

    const render = async () => {
      try {
        const { svg } = await mermaid.render(id, sanitizeMermaidSource(code))
        if (!cancelled) {
          container.innerHTML = svg
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render mermaid diagram')
          container.innerHTML = ''
        }
      } finally {
        // If render threw, mermaid leaves an error SVG in document.body with this id.
        // If render succeeded, the id is on the SVG we injected into `container` (not body),
        // so this no-ops. Either way, safe to clean orphans off <body>.
        const orphan = document.getElementById(id)
        if (orphan && orphan.parentElement === document.body) orphan.remove()
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
        <div className="text-xs text-red-500 mb-1">Mermaid render error: {error}</div>
        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-auto">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return <div ref={containerRef} className="my-2 overflow-auto rounded-md bg-white p-4" />
}
