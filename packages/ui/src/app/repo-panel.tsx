import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import { fetchRepoTree, type TreeNode } from './api'
import { FileTree } from './file-tree'

type RepoPanelProps = {
  repoName: string
}

export function RepoPanel({ repoName }: RepoPanelProps) {
  const [files, setFiles] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { repoName: currentRepo, '*': filePath } = useParams<{ repoName?: string; '*': string }>()
  const currentPath = currentRepo && filePath ? `${currentRepo}/${filePath}` : null

  const loadTree = async () => {
    setLoading(true)
    try {
      const data = await fetchRepoTree(repoName)
      setFiles(data.files)
    } catch (error) {
      console.error('Failed to load repo tree:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTree()
  }, [repoName])

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <h3 className="font-semibold text-sm">{repoName}</h3>
        <button
          onClick={loadTree}
          disabled={loading}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          title="Refresh file tree"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading && files.length === 0 ? (
        <div className="px-2 py-1 text-sm text-gray-500">Loading...</div>
      ) : (
        <FileTree
          nodes={files}
          repoName={repoName}
          selectedPath={currentPath}
          onFileClick={(path) => {
            const filePath = path.startsWith('/') ? path.slice(1) : path
            navigate(`/views/${repoName}/${filePath}`)
          }}
        />
      )}
    </div>
  )
}
