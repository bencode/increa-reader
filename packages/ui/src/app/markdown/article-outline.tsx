import { useEffect, useRef } from 'react'
import type { TocHeading } from './heading-utils'

type ArticleOutlineProps = {
  headings: TocHeading[]
  activeId: string | null
  onNavigate: (id: string) => void
}

export function ArticleOutline({ headings, activeId, onNavigate }: ArticleOutlineProps) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  if (headings.length === 0) return null

  const minLevel = Math.min(...headings.map(h => h.level))

  return (
    <nav className="py-4 pr-2">
      <ul className="space-y-0.5">
        {headings.map(heading => {
          const indent = heading.level - minLevel
          const isActive = heading.id === activeId
          return (
            <li key={heading.id} style={{ paddingLeft: `${indent * 12 + 8}px` }}>
              <a
                ref={isActive ? activeRef : null}
                href={`#${heading.id}`}
                onClick={e => {
                  e.preventDefault()
                  onNavigate(heading.id)
                }}
                className={`block text-xs py-0.5 border-l-2 pl-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                title={heading.text}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
