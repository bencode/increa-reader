import { useEffect, useRef } from 'react'

/**
 * Hook to handle external links in markdown content
 * Intercepts click events and opens external links in new tab
 */
export function useExternalLinks() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // Check if it's an external link (http/https)
      if (href.startsWith('http://') || href.startsWith('https://')) {
        e.preventDefault()
        window.open(href, '_blank', 'noopener,noreferrer')
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [])

  return containerRef
}
