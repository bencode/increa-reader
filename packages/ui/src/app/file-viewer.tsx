import { useParams } from 'react-router-dom'

export function FileViewer() {
  const { repoName, '*': filePath } = useParams<{ repoName: string; '*': string }>()

  return (
    <div className="h-full p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">File Viewer</h2>
        <div className="text-sm text-muted-foreground mt-2">
          <div>
            Repository: <span className="font-mono">{repoName}</span>
          </div>
          <div>
            Path: <span className="font-mono">{filePath}</span>
          </div>
        </div>
      </div>
      <div className="border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">File content will be displayed here</p>
      </div>
    </div>
  )
}
