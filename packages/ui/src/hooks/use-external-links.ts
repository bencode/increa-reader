import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const decodeAnchorId = (id: string) => {
  try {
    return decodeURIComponent(id)
  } catch {
    return null
  }
}

/**
 * Hook to handle links in markdown content via click delegation:
 * - external http(s) links open in a new window
 * - same-origin /views/... links navigate in-app (no full page reload)
 * - in-document #anchor links smooth-scroll to the target element
 * - modified clicks (cmd/ctrl/shift/alt, non-left button) keep native behavior
 */
export function useExternalLinks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const link = (e.target as HTMLElement).closest('a')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      if (href.startsWith('#')) {
        const id = href.slice(1)
        const element =
          document.getElementById(id) ?? document.getElementById(decodeAnchorId(id) ?? id)
        if (element) {
          e.preventDefault()
          element.scrollIntoView({ behavior: 'smooth' })
        }
        return
      }

      // link.href is resolved by the browser against the current document URL,
      // so relative markdown links already point at /views/<repo>/<path>
      const url = new URL(link.href)

      if (url.origin !== window.location.origin) {
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          e.preventDefault()
          window.open(url.href, '_blank', 'noopener,noreferrer')
        }
        return
      }

      if (url.pathname.startsWith('/views/')) {
        e.preventDefault()
        navigate(url.pathname + url.search + url.hash)
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [navigate])

  return containerRef
}
