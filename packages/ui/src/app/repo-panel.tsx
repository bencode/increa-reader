import { useCallback, useEffect, useState, useTransition } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

import { fetchRepoTree, type TreeNode } from './api'
import { FileTree } from './file-tree'
import { filterTree, type TreeFilterResult } from './tree-filter'

type RepoPanelProps = {
  repoName: string
  searchQuery: string
}

const storageKey = (repoName: string) => `repo-panel-collapsed-${repoName}`
const emptyFilterResult = (): TreeFilterResult => ({
  nodes: [],
  forcedOpenPaths: new Set<string>(),
  matchCount: 0,
})

export function RepoPanel({ repoName, searchQuery }: RepoPanelProps) {
  const [files, setFiles] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey(repoName))
    return stored === 'true'
  })
  const [filterResult, setFilterResult] = useState<TreeFilterResult>(emptyFilterResult)
  const [isFilteringTree, startFilteringTree] = useTransition()
  const navigate = useNavigate()
  const { repoName: currentRepo, '*': filePath } = useParams<{ repoName?: string; '*': string }>()
  const currentPath = currentRepo && filePath ? `${currentRepo}/${filePath}` : null
  const searchActive = searchQuery.trim().length > 0

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

  useEffect(() => {
    if (!searchActive) {
      setFilterResult(emptyFilterResult())
      return
    }

    startFilteringTree(() => {
      setFilterResult(filterTree(files, searchQuery, repoName))
    })
  }, [files, repoName, searchActive, searchQuery, startFilteringTree])

  const toggleCollapse = () => {
    if (searchActive) return
    setIsCollapsed((v) => !v)
  }

  const isEffectivelyCollapsed = searchActive ? false : isCollapsed
  const visibleFiles = searchActive ? filterResult.nodes : files
  const showLoadingState = loading && files.length === 0
  const showEmptyState = !loading && searchActive && !isFilteringTree && visibleFiles.length === 0

  return (
    <div>
      <div
        className="flex items-center justify-between px-2 py-1 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-1">
          {isEffectivelyCollapsed ? (
            <ChevronRight className="size-4 text-gray-500" />
          ) : (
            <ChevronDown className="size-4 text-gray-500" />
          )}
          <h3 className="font-semibold text-sm">{repoName}</h3>
          {searchActive && isFilteringTree && (
            <span className="text-xs font-normal text-muted-foreground">Filtering...</span>
          )}
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
      {!isEffectivelyCollapsed &&
        (showLoadingState ? (
          <div className="px-2 py-1 text-sm text-gray-500">Loading...</div>
        ) : showEmptyState ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">No matching files</div>
        ) : (
          <FileTree
            nodes={visibleFiles}
            repoName={repoName}
            selectedPath={currentPath}
            searchActive={searchActive}
            forcedOpenPaths={filterResult.forcedOpenPaths}
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
