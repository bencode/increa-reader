import { useEffect, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchConfigRepos, updateConfigRepos, type RepoConfigInfo } from './api'
import { ApiSettingsForm } from './api-settings-form'

type SettingsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReposChanged: () => void
}

export function SettingsDrawer({ open, onOpenChange, onReposChanged }: SettingsDrawerProps) {
  const [repos, setRepos] = useState<RepoConfigInfo[]>([])
  const [newPath, setNewPath] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchConfigRepos().then(setRepos).catch(console.error)
    }
  }, [open])

  const handleAdd = async () => {
    const path = newPath.trim()
    if (!path) return

    setLoading(true)
    try {
      const paths = [...repos.map((r) => r.root), path]
      const updated = await updateConfigRepos(paths)
      setRepos(updated)
      setNewPath('')
      onReposChanged()
    } catch (err) {
      console.error('Failed to add repo:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (index: number) => {
    setLoading(true)
    try {
      const paths = repos.filter((_, i) => i !== index).map((r) => r.root)
      const updated = await updateConfigRepos(paths)
      setRepos(updated)
      onReposChanged()
    } catch (err) {
      console.error('Failed to remove repo:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd()
    }
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Settings</DrawerTitle>
          <DrawerDescription>Manage repositories and API configuration</DrawerDescription>
        </DrawerHeader>

        <Tabs defaultValue="repositories" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="mx-4">
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="repositories" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-auto px-4">
              {repos.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No repositories configured
                </p>
              )}
              <ul className="space-y-2">
                {repos.map((repo, index) => (
                  <li
                    key={repo.root}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{repo.name}</span>
                        {!repo.exists && (
                          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{repo.root}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemove(index)}
                      disabled={loading}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 border-t p-4">
              <Input
                placeholder="Repository path..."
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <Button size="sm" onClick={handleAdd} disabled={loading || !newPath.trim()}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="api" className="flex-1 overflow-auto">
            <ApiSettingsForm open={open} />
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  )
}
