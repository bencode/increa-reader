import { Activity, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useTabsStore } from '@/stores/tabs-store'
import { useSetContext } from '@/stores/view-context'
import { FileViewer } from '../file-viewer'
import { TabBar } from './tab-bar'

export function TabbedViewer() {
  const { repoName, '*': filePath } = useParams<{ repoName: string; '*': string }>()
  const openTab = useTabsStore(s => s.openTab)
  const tabs = useTabsStore(s => s.tabs)
  const activeId = useTabsStore(s => s.activeId)
  const activeView = useTabsStore(
    useShallow(s => {
      const active = s.tabs.find(t => t.id === s.activeId)
      return active ? { repo: active.repo, path: active.path, pageNumber: active.pageNumber } : null
    }),
  )
  const setContext = useSetContext()

  useEffect(() => {
    if (!repoName || !filePath) return
    openTab(repoName, filePath)
  }, [repoName, filePath, openTab])

  useEffect(() => {
    if (!activeView) return
    setContext(activeView)
  }, [activeView, setContext])

  return (
    <div className="flex h-full flex-col">
      <TabBar />
      <div className="relative min-h-0 flex-1">
        {tabs.map(tab => (
          <Activity key={tab.id} mode={tab.id === activeId ? 'visible' : 'hidden'}>
            <div className="absolute inset-0">
              <FileViewer repo={tab.repo} path={tab.path} />
            </div>
          </Activity>
        ))}
      </div>
    </div>
  )
}
