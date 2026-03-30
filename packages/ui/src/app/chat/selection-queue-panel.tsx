import { ChevronDown, ChevronUp, Quote, X } from 'lucide-react'
import { useState } from 'react'
import { useSelectionQueue } from '@/contexts/selection-context'

export function QuoteBar() {
  const { items, remove, clear } = useSelectionQueue()
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="border-t border-border bg-muted/30">
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-foreground transition-colors"
        >
          <Quote className="w-3 h-3" />
          <span>
            {items.length} quote{items.length > 1 ? 's' : ''}
          </span>
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            clear()
            setExpanded(false)
          }}
          className="hover:text-destructive transition-colors"
        >
          Clear
        </button>
      </div>
      {expanded && (
        <div className="max-h-48 overflow-y-auto border-t border-border">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-2 px-4 py-2 border-b border-border last:border-b-0 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words">
                  {item.text}
                </p>
                {(item.repo || item.path) && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60 truncate">
                    {[item.repo, item.path].filter(Boolean).join(':')}
                    {item.pageNumber != null && ` p.${item.pageNumber}`}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="shrink-0 p-0.5 rounded hover:bg-accent text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
