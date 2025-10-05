import { Outlet } from 'react-router-dom'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

export function Layout() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen">
      <ResizablePanel defaultSize={30} minSize={1}>
        <div className="h-full p-4">
          <h2 className="text-lg font-semibold mb-4">Left Panel</h2>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={70} minSize={1}>
        <div className="h-full">
          <Outlet />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
