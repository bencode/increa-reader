import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fetchWorkspaceTree } from './api'
import { FileTree } from './file-tree'

type RepoResource = {
  name: string
  files: Array<{
    type: 'dir' | 'file'
    name: string
    path: string
    children?: any[]
  }>
}

export function LeftPanel() {
  const [repos, setRepos] = useState<RepoResource[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchWorkspaceTree()
      .then(setRepos)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="h-full overflow-auto">
      {repos.map((repo) => (
        <div key={repo.name} className="mb-4">
          <h3 className="font-semibold px-2 py-1 text-sm border-b">{repo.name}</h3>
          <FileTree
            nodes={repo.files}
            onFileClick={(path) => {
              const filePath = path.startsWith('/') ? path.slice(1) : path
              navigate(`/views/${repo.name}/${filePath}`)
            }}
          />
        </div>
      ))}
    </div>
  )
}
