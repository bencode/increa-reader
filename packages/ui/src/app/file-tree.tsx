import { useState, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  Image,
  File,
  FileType,
  Trash2,
} from 'lucide-react'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { deleteFile } from './api'

type TreeNode = {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: TreeNode[]
}

type TreeItemProps = {
  node: TreeNode
  onFileClick?: (path: string) => void
  repoName: string
  selectedPath?: string | null
  onDelete?: (path: string) => void
  searchActive?: boolean
  forcedOpenPaths?: Set<string>
}

type FileIconType = 'code' | 'config' | 'text' | 'image' | 'pdf' | 'default'

const EXT_TO_TYPE: Record<string, FileIconType> = {
  js: 'code',
  jsx: 'code',
  ts: 'code',
  tsx: 'code',
  py: 'code',
  java: 'code',
  cpp: 'code',
  c: 'code',
  go: 'code',
  rs: 'code',
  json: 'config',
  yaml: 'config',
  yml: 'config',
  toml: 'config',
  md: 'text',
  txt: 'text',
  doc: 'text',
  docx: 'text',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  webp: 'image',
  pdf: 'pdf',
}

const TYPE_TO_ICON: Record<FileIconType, React.ReactElement> = {
  code: <FileCode className="size-4 shrink-0 text-blue-500" />,
  config: <FileJson className="size-4 shrink-0 text-yellow-500" />,
  text: <FileText className="size-4 shrink-0 text-gray-500" />,
  image: <Image className="size-4 shrink-0 text-purple-500" />,
  pdf: <FileType className="size-4 shrink-0 text-red-500" />,
  default: <File className="size-4 shrink-0 text-gray-400" />,
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const type = ext ? EXT_TO_TYPE[ext] || 'default' : 'default'
  return TYPE_TO_ICON[type]
}

function TreeItem({
  node,
  onFileClick,
  repoName,
  selectedPath,
  onDelete,
  searchActive = false,
  forcedOpenPaths = new Set<string>(),
}: TreeItemProps) {
  const storageKey = `filetree-${repoName}-${node.path}`
  const isSelected = selectedPath === `${repoName}/${node.path}`

  const shouldAutoOpen = isSelected || selectedPath?.startsWith(`${repoName}/${node.path}/`)
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored === null) return shouldAutoOpen
    try {
      return JSON.parse(stored)
    } catch {
      return shouldAutoOpen
    }
  })
  const effectiveIsOpen = searchActive ? forcedOpenPaths.has(node.path) : isOpen

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (searchActive) return
    localStorage.setItem(storageKey, JSON.stringify(isOpen))
  }, [isOpen, searchActive, storageKey])

  useEffect(() => {
    if (searchActive || !shouldAutoOpen) return
    setIsOpen(true)
  }, [searchActive, shouldAutoOpen])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteFile(repoName, node.path)
      setDeleteDialogOpen(false)
      onDelete?.(node.path)
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (node.type === 'file') {
    return (
      <>
        <div
          className={`group relative py-1 px-2 hover:bg-accent cursor-pointer text-sm flex items-center gap-2 ${
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
              : ''
          }`}
          onClick={() => onFileClick?.(node.path)}
        >
          {getFileIcon(node.name)}
          <span>{node.name}</span>
          <button
            className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteDialogOpen(true)
            }}
          >
            <Trash2 className="size-3.5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          fileName={node.name}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />
      </>
    )
  }

  return (
    <div>
      <div
        className="py-1 px-2 hover:bg-accent cursor-pointer text-sm flex items-center gap-1"
        onClick={() => {
          if (searchActive) return
          setIsOpen(!isOpen)
        }}
      >
        {effectiveIsOpen ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        {effectiveIsOpen ? (
          <FolderOpen className="size-4 text-yellow-600" />
        ) : (
          <Folder className="size-4 text-yellow-600" />
        )}
        <span>{node.name}</span>
      </div>
      {effectiveIsOpen && node.children && (
        <div className="pl-4">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              onFileClick={onFileClick}
              repoName={repoName}
              selectedPath={selectedPath}
              onDelete={onDelete}
              searchActive={searchActive}
              forcedOpenPaths={forcedOpenPaths}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type FileTreeProps = {
  nodes: TreeNode[]
  onFileClick?: (path: string) => void
  repoName: string
  selectedPath?: string | null
  onDelete?: (path: string) => void
  searchActive?: boolean
  forcedOpenPaths?: Set<string>
}

export function FileTree({
  nodes,
  onFileClick,
  repoName,
  selectedPath,
  onDelete,
  searchActive = false,
  forcedOpenPaths = new Set<string>(),
}: FileTreeProps) {
  return (
    <div className="text-foreground">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          onFileClick={onFileClick}
          repoName={repoName}
          selectedPath={selectedPath}
          onDelete={onDelete}
          searchActive={searchActive}
          forcedOpenPaths={forcedOpenPaths}
        />
      ))}
    </div>
  )
}
