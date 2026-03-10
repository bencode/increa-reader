import { useCallback, useEffect, useState } from 'react'
import { Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { fetchRepos, type RepoInfo } from './api'
import { RepoPanel } from './repo-panel'
import { SettingsDrawer } from './settings-drawer'

export function LeftPanel() {
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadRepos = useCallback(() => {
    fetchRepos()
      .then(setRepos)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadRepos()
  }, [loadRepos])

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Repositories</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setDrawerOpen(true)}>
          <Settings className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {repos.map((repo) => (
          <RepoPanel key={repo.name} repoName={repo.name} />
        ))}
      </div>

      <SettingsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onReposChanged={loadRepos}
      />
    </div>
  )
}
