import { PanelTop, PanelTopClose } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ChatHeaderProps = {
  isSplitView: boolean
  onToggleSplit: () => void
}

export const ChatHeader = ({ isSplitView, onToggleSplit }: ChatHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Chat</div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleSplit}
        title={isSplitView ? 'Exit split view' : 'Split view'}
        className="h-7 w-7 p-0"
      >
        {isSplitView ? (
          <PanelTopClose className="h-4 w-4" />
        ) : (
          <PanelTop className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
