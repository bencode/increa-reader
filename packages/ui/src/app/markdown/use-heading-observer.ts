import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import type { TocHeading } from './heading-utils'

export function useHeadingObserver(
  scrollRef: RefObject<HTMLElement | null>,
  headings: TocHeading[],
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const root = scrollRef.current
    if (!root || headings.length === 0) return

    const idOrder = headings.map(h => h.id)
    const visible = new Set<string>()

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) {
            visible.add(id)
          } else {
            visible.delete(id)
          }
        }
        const first = idOrder.find(id => visible.has(id))
        if (first) setActiveId(first)
      },
      { root, rootMargin: '0px 0px -80% 0px', threshold: 0 },
    )

    for (const { id } of headings) {
      const el = root.querySelector(`#${CSS.escape(id)}`)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [scrollRef, headings])

  return activeId
}
