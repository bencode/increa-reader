import { Search, Settings, X } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchRepos, type RepoInfo } from './api'
import { RepoPanel } from './repo-panel'
import { SettingsDrawer } from './settings-drawer'

export function LeftPanel() {
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const isFiltering = searchQuery !== deferredSearchQuery

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

      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Filter repositories and files"
            className="pr-9 pl-8"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div className="mt-1 h-5 text-xs text-muted-foreground">
          {isFiltering
            ? 'Filtering...'
            : deferredSearchQuery
              ? `Filtering by "${deferredSearchQuery}"`
              : ''}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {repos.map(repo => (
          <RepoPanel key={repo.name} repoName={repo.name} searchQuery={deferredSearchQuery} />
        ))}
      </div>

      <SettingsDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onReposChanged={loadRepos} />
    </div>
  )
}
