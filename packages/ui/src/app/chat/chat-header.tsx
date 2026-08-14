import { PanelTop, PanelTopClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SessionMetadata, SessionsPage } from '@/types/chat'
import { SessionHistoryPopover } from './session-history-popover'

type ChatHeaderProps = {
  isSplitView: boolean
  sessions: SessionMetadata[]
  totalSessions: number
  currentSessionId: string | null
  hasMoreSessions: boolean
  isLoadingSessions: boolean
  isStreaming: boolean
  sessionsError: string | null
  onToggleSplit: () => void
  onRefreshSessions: () => Promise<SessionsPage>
  onLoadMoreSessions: () => Promise<void>
  onSelectSession: (sessionId: string) => Promise<void>
}

export const ChatHeader = ({
  isSplitView,
  sessions,
  totalSessions,
  currentSessionId,
  hasMoreSessions,
  isLoadingSessions,
  isStreaming,
  sessionsError,
  onToggleSplit,
  onRefreshSessions,
  onLoadMoreSessions,
  onSelectSession,
}: ChatHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Chat</span>
      <div className="flex items-center gap-0.5">
        <SessionHistoryPopover
          sessions={sessions}
          total={totalSessions}
          currentSessionId={currentSessionId}
          hasMore={hasMoreSessions}
          isLoading={isLoadingSessions}
          isStreaming={isStreaming}
          error={sessionsError}
          onRefresh={onRefreshSessions}
          onLoadMore={onLoadMoreSessions}
          onSelect={onSelectSession}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSplit}
          title={isSplitView ? 'Exit split view' : 'Split view'}
          aria-label={isSplitView ? 'Exit split view' : 'Split view'}
        >
          {isSplitView ? <PanelTopClose className="size-4" /> : <PanelTop className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
