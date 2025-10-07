import { Outlet } from 'react-router-dom'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

import { ChatPanel } from './chat-panel'
import { LeftPanel } from './left-panel'

export function Layout() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="main-layout">
      <ResizablePanel defaultSize={20} minSize={1}>
        <LeftPanel />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50} minSize={1}>
        <div className="h-full bg-white dark:bg-gray-950">
          <Outlet />
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={30} minSize={1}>
        <ChatPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
