import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

import { fetchRepoTree, type TreeNode } from './api'
import { FileTree } from './file-tree'

type RepoPanelProps = {
  repoName: string
}

const storageKey = (repoName: string) => `repo-panel-collapsed-${repoName}`

export function RepoPanel({ repoName }: RepoPanelProps) {
  const [files, setFiles] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey(repoName))
    return stored === 'true'
  })
  const navigate = useNavigate()
  const { repoName: currentRepo, '*': filePath } = useParams<{ repoName?: string; '*': string }>()
  const currentPath = currentRepo && filePath ? `${currentRepo}/${filePath}` : null

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchRepoTree(repoName)
      setFiles(data.files)
    } catch (error) {
      console.error('Failed to load repo tree:', error)
    } finally {
      setLoading(false)
    }
  }, [repoName])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  useEffect(() => {
    localStorage.setItem(storageKey(repoName), String(isCollapsed))
  }, [isCollapsed, repoName])

  const toggleCollapse = () => {
    setIsCollapsed((v) => !v)
  }

  return (
    <div>
      <div
        className="flex items-center justify-between px-2 py-1 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-1">
          {isCollapsed ? (
            <ChevronRight className="size-4 text-gray-500" />
          ) : (
            <ChevronDown className="size-4 text-gray-500" />
          )}
          <h3 className="font-semibold text-sm">{repoName}</h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            loadTree()
          }}
          disabled={loading}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          title="Refresh file tree"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {!isCollapsed &&
        (loading && files.length === 0 ? (
          <div className="px-2 py-1 text-sm text-gray-500">Loading...</div>
        ) : (
          <FileTree
            nodes={files}
            repoName={repoName}
            selectedPath={currentPath}
            onFileClick={(path) => {
              const cleanPath = path.startsWith('/') ? path.slice(1) : path
              navigate(`/views/${repoName}/${cleanPath}`)
            }}
            onDelete={() => {
              loadTree()
            }}
          />
        ))}
    </div>
  )
}
