import {
  ArrowRight,
  BookOpen,
  FileCode,
  FileText,
  FileType,
  FolderOpen,
  Image,
  Loader2,
  MapIcon,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'

import { fetchRepos, fetchRepoTree, type RepoInfo, type TreeNode } from './api'

type FileEntry = {
  repo: string
  name: string
  path: string
  depth: number
  extension: string
}

type RepoMap = {
  repo: RepoInfo
  files: FileEntry[]
  directoryCount: number
}

type FileCategory = 'documents' | 'pdfs' | 'code' | 'images' | 'other'

const DOCUMENT_EXTENSIONS = new Set(['md', 'mdx', 'txt', 'rst', 'doc', 'docx'])
const CODE_EXTENSIONS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'c',
  'cpp',
  'h',
  'hpp',
  'css',
  'scss',
  'json',
  'yaml',
  'yml',
  'toml',
])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

function getExtension(name: string) {
  const index = name.lastIndexOf('.')
  return index === -1 ? '' : name.slice(index + 1).toLowerCase()
}

function getCategory(file: FileEntry): FileCategory {
  if (file.extension === 'pdf') return 'pdfs'
  if (DOCUMENT_EXTENSIONS.has(file.extension)) return 'documents'
  if (CODE_EXTENSIONS.has(file.extension)) return 'code'
  if (IMAGE_EXTENSIONS.has(file.extension)) return 'images'
  return 'other'
}

function flattenTree(
  nodes: TreeNode[],
  repo: string,
  depth = 0,
): { files: FileEntry[]; dirs: number } {
  const result: FileEntry[] = []
  let dirs = 0

  for (const node of nodes) {
    if (node.type === 'dir') {
      dirs += 1
      const childResult = flattenTree(node.children ?? [], repo, depth + 1)
      result.push(...childResult.files)
      dirs += childResult.dirs
    } else {
      result.push({
        repo,
        name: node.name,
        path: node.path,
        depth,
        extension: getExtension(node.name),
      })
    }
  }

  return { files: result, dirs }
}

function scoreReadingCandidate(file: FileEntry) {
  const lowerName = file.name.toLowerCase()
  const lowerPath = file.path.toLowerCase()
  let score = 0

  if (lowerName === 'readme.md') score += 100
  if (lowerName.startsWith('readme')) score += 80
  if (lowerName.includes('overview')) score += 60
  if (lowerName.includes('intro') || lowerName.includes('getting-started')) score += 50
  if (lowerName.includes('guide') || lowerName.includes('index')) score += 35
  if (file.extension === 'md') score += 25
  if (file.extension === 'pdf') score += 20
  if (lowerPath.includes('docs/') || lowerPath.includes('notes/')) score += 15
  score -= file.depth * 2

  return score
}

function categoryLabel(category: FileCategory) {
  switch (category) {
    case 'documents':
      return 'Notes & docs'
    case 'pdfs':
      return 'PDFs'
    case 'code':
      return 'Code & config'
    case 'images':
      return 'Images'
    default:
      return 'Other files'
  }
}

function categoryIcon(category: FileCategory) {
  switch (category) {
    case 'documents':
      return <FileText className="size-5 text-blue-600" />
    case 'pdfs':
      return <FileType className="size-5 text-red-500" />
    case 'code':
      return <FileCode className="size-5 text-violet-600" />
    case 'images':
      return <Image className="size-5 text-fuchsia-500" />
    default:
      return <FolderOpen className="size-5 text-slate-500" />
  }
}

function openPath(repo: string, path: string) {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `/views/${encodeURIComponent(repo)}/${cleanPath}`
}

export function KnowledgeMap() {
  const navigate = useNavigate()
  const [repoMaps, setRepoMaps] = useState<RepoMap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadKnowledgeMap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const repos = await fetchRepos()
      const maps = await Promise.all(
        repos.map(async repo => {
          const tree = await fetchRepoTree(repo.name)
          const flattened = flattenTree(tree.files, repo.name)
          return {
            repo,
            files: flattened.files,
            directoryCount: flattened.dirs,
          }
        }),
      )
      setRepoMaps(maps)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build knowledge map')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKnowledgeMap()
  }, [loadKnowledgeMap])

  const allFiles = useMemo(() => repoMaps.flatMap(repoMap => repoMap.files), [repoMaps])
  const totalDirectories = repoMaps.reduce((sum, repoMap) => sum + repoMap.directoryCount, 0)
  const categoryCounts = useMemo(() => {
    const counts: Record<FileCategory, number> = {
      documents: 0,
      pdfs: 0,
      code: 0,
      images: 0,
      other: 0,
    }
    for (const file of allFiles) counts[getCategory(file)] += 1
    return counts
  }, [allFiles])
  const readingPath = useMemo(
    () =>
      allFiles
        .filter(file => ['documents', 'pdfs'].includes(getCategory(file)))
        .map(file => ({ file, score: scoreReadingCandidate(file) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(item => item.file),
    [allFiles],
  )
  const importantFolders = useMemo(() => {
    const counts = new Map<string, number>()
    for (const file of allFiles) {
      const folder = file.path.includes('/') ? file.path.split('/')[0] : 'Root files'
      counts.set(folder, (counts.get(folder) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [allFiles])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Building knowledge map...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border bg-white p-6 shadow-sm dark:bg-gray-950">
          <div className="font-medium">Unable to build the knowledge map</div>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={loadKnowledgeMap}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_30%),linear-gradient(180deg,#ffffff,#f8fafc)] dark:bg-gray-950 dark:bg-none">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <section className="rounded-3xl border bg-white/85 p-8 shadow-sm backdrop-blur dark:bg-gray-950/85">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                <MapIcon className="size-4" /> Knowledge Map
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Your reading workspace is ready.
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Increa Reader scanned your repositories and created a quick map of documents,
                folders, and suggested starting points.
              </p>
            </div>
            <Button variant="outline" onClick={loadKnowledgeMap}>
              Refresh map
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950">
            <div className="text-sm text-muted-foreground">Repositories</div>
            <div className="mt-2 text-3xl font-semibold">{repoMaps.length}</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950">
            <div className="text-sm text-muted-foreground">Files</div>
            <div className="mt-2 text-3xl font-semibold">{allFiles.length}</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950">
            <div className="text-sm text-muted-foreground">Folders</div>
            <div className="mt-2 text-3xl font-semibold">{totalDirectories}</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950">
            <div className="text-sm text-muted-foreground">Reading candidates</div>
            <div className="mt-2 text-3xl font-semibold">{readingPath.length}</div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-gray-950">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Suggested reading path</h2>
            </div>
            {readingPath.length > 0 ? (
              <div className="space-y-3">
                {readingPath.map((file, index) => (
                  <button
                    type="button"
                    key={`${file.repo}-${file.path}`}
                    className="flex w-full items-center gap-4 rounded-2xl border bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:bg-gray-900 dark:hover:bg-blue-950/40"
                    onClick={() => navigate(openPath(file.repo, file.path))}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-blue-600 shadow-sm dark:bg-gray-950">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{file.name}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {file.repo} / {file.path}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                No Markdown or PDF files were found yet.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-gray-950">
              <div className="mb-5 flex items-center gap-2">
                <BookOpen className="size-5 text-blue-600" />
                <h2 className="text-xl font-semibold">Content mix</h2>
              </div>
              <div className="space-y-3">
                {(Object.keys(categoryCounts) as FileCategory[]).map(category => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {categoryIcon(category)}
                      <span className="text-sm font-medium">{categoryLabel(category)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {categoryCounts[category]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-gray-950">
              <div className="mb-5 flex items-center gap-2">
                <FolderOpen className="size-5 text-yellow-600" />
                <h2 className="text-xl font-semibold">Largest areas</h2>
              </div>
              <div className="space-y-3">
                {importantFolders.map(([folder, count]) => (
                  <div
                    key={folder}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-gray-900"
                  >
                    <span className="truncate text-sm font-medium">{folder}</span>
                    <span className="text-sm text-muted-foreground">{count} files</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
