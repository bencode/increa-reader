import { useEffect, useState } from 'react'

import { fetchRepos, type RepoInfo } from './api'
import { RepoPanel } from './repo-panel'

export function LeftPanel() {
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRepos()
      .then(setRepos)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-900">
      {repos.map((repo) => (
        <RepoPanel key={repo.name} repoName={repo.name} />
      ))}
    </div>
  )
}
