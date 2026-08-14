import { Check, History } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { SessionMetadata, SessionsPage } from '@/types/chat'

const sessionDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type SessionHistoryPopoverProps = {
  sessions: SessionMetadata[]
  total: number
  currentSessionId: string | null
  hasMore: boolean
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  onRefresh: () => Promise<SessionsPage>
  onLoadMore: () => Promise<void>
  onSelect: (sessionId: string) => Promise<void>
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to load session history.'

export const SessionHistoryPopover = ({
  sessions,
  total,
  currentSessionId,
  hasMore,
  isLoading,
  isStreaming,
  error,
  onRefresh,
  onLoadMore,
  onSelect,
}: SessionHistoryPopoverProps) => {
  const [open, setOpen] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) return

    setActionError(null)
    onRefresh().catch(refreshError => setActionError(errorMessage(refreshError)))
  }

  const handleSelect = async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      setOpen(false)
      return
    }

    setSelectingId(sessionId)
    setActionError(null)
    try {
      await onSelect(sessionId)
      setOpen(false)
    } catch (selectError) {
      setActionError(errorMessage(selectError))
    } finally {
      setSelectingId(null)
    }
  }

  const handleLoadMore = () => {
    setActionError(null)
    onLoadMore().catch(loadError => setActionError(errorMessage(loadError)))
  }

  const visibleError = actionError || error
  const showInitialLoading = isLoading && sessions.length === 0

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Session history" title="Session history">
          <History className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">Sessions</h2>
          <span className="text-xs text-muted-foreground">{Math.max(total, sessions.length)}</span>
        </div>

        {visibleError ? (
          <div className="border-b bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <p>{visibleError}</p>
            {sessions.length === 0 ? (
              <button
                type="button"
                className="mt-1 font-medium underline underline-offset-2"
                onClick={() => handleOpenChange(true)}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[min(70vh,36rem)] overflow-y-auto overscroll-contain">
          {showInitialLoading ? (
            <div className="space-y-3 p-3" role="status" aria-label="Loading sessions">
              {[0, 1, 2].map(item => (
                <div key={item} className="space-y-2 motion-safe:animate-pulse">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-2.5 w-1/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 && !visibleError ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No saved sessions yet.
            </p>
          ) : (
            <ul className="divide-y">
              {sessions.map(session => {
                const isCurrent = session.id === currentSessionId
                const isSelecting = selectingId === session.id
                const date = sessionDateFormatter.format(session.lastActiveAt)

                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      aria-current={isCurrent ? 'page' : undefined}
                      disabled={isStreaming || selectingId !== null}
                      title={
                        isStreaming ? 'Wait for the current response to finish' : session.title
                      }
                      onClick={() => handleSelect(session.id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{session.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground" title={date}>
                          {date}
                        </span>
                      </span>
                      {isCurrent ? (
                        <Check className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                      ) : isSelecting ? (
                        <span className="shrink-0 text-xs text-muted-foreground">Loading…</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {hasMore ? (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={isLoading}
              onClick={handleLoadMore}
            >
              {isLoading ? 'Loading…' : 'Load 50 more'}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
