import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

import { fetchOnboardingState } from './api'
import { ChatPanel } from './chat'
import { LeftPanel } from './left-panel'

export function Layout() {
  const navigate = useNavigate()
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)

  useEffect(() => {
    fetchOnboardingState()
      .then(state => {
        if (state.needs_onboarding) navigate('/onboarding', { replace: true })
      })
      .catch(console.error)
      .finally(() => setCheckingOnboarding(false))
  }, [navigate])

  if (checkingOnboarding) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Preparing workspace...
      </div>
    )
  }

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
