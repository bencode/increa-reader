import { X } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { type Tab, useTabsStore } from '@/stores/tabs-store'
import { getFileIcon } from '../file-tree'

export function TabBar() {
  const tabs = useTabsStore(s => s.tabs)
  const activeId = useTabsStore(s => s.activeId)

  if (tabs.length === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center overflow-x-auto border-b bg-muted/30">
      {tabs.map((tab, index) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeId}
          index={index}
          total={tabs.length}
        />
      ))}
    </div>
  )
}

type TabItemProps = {
  tab: Tab
  isActive: boolean
  index: number
  total: number
}

function TabItem({ tab, isActive, index, total }: TabItemProps) {
  const navigate = useNavigate()
  const closeTab = useTabsStore(s => s.closeTab)
  const closeOtherTabs = useTabsStore(s => s.closeOtherTabs)
  const closeTabsToRight = useTabsStore(s => s.closeTabsToRight)
  const closeAllTabs = useTabsStore(s => s.closeAllTabs)
  const filename = tab.path.split('/').pop() ?? tab.path

  // After closing, align the URL with the surviving active tab
  // (zustand set is synchronous, so getState returns the updated state immediately)
  const syncNavigation = () => {
    const { tabs, activeId } = useTabsStore.getState()
    const active = tabs.find(t => t.id === activeId)
    navigate(active ? `/views/${active.repo}/${active.path}` : '/')
  }

  const handleClick = () => {
    if (isActive) return
    navigate(`/views/${tab.repo}/${tab.path}`)
  }

  const handleClose = (event: MouseEvent) => {
    event.stopPropagation()
    closeTab(tab.id)
    syncNavigation()
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={handleClick}
          onAuxClick={event => {
            if (event.button === 1) handleClose(event)
          }}
          title={`${tab.repo}/${tab.path}`}
          className={`group flex h-full cursor-pointer items-center gap-1.5 border-r px-3 text-sm whitespace-nowrap select-none ${
            isActive ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          {getFileIcon(filename)}
          <span className="max-w-[160px] truncate">{filename}</span>
          <button
            type="button"
            onClick={handleClose}
            className={`ml-1 rounded p-0.5 hover:bg-accent ${
              isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-70'
            }`}
            aria-label="Close tab"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={total <= 1}
          onSelect={() => {
            closeOtherTabs(tab.id)
            syncNavigation()
          }}
        >
          Close Others
        </ContextMenuItem>
        <ContextMenuItem
          disabled={index === total - 1}
          onSelect={() => {
            closeTabsToRight(tab.id)
            syncNavigation()
          }}
        >
          Close to the Right
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            closeAllTabs()
            navigate('/')
          }}
        >
          Close All
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
