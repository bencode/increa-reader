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
} from 'lucide-react'

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

const TYPE_TO_ICON: Record<FileIconType, JSX.Element> = {
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

function TreeItem({ node, onFileClick, repoName, selectedPath }: TreeItemProps) {
  const storageKey = `filetree-${repoName}-${node.path}`
  const isSelected = selectedPath === `${repoName}/${node.path}`

  const shouldAutoOpen = () => {
    if (!selectedPath) return false
    return selectedPath.startsWith(`${repoName}/${node.path}/`) || isSelected
  }

  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : shouldAutoOpen()
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(isOpen))
  }, [isOpen, storageKey])

  // Auto-expand if this path contains the selected path
  useEffect(() => {
    if (shouldAutoOpen() && !isOpen) {
      setIsOpen(true)
    }
  }, [selectedPath])

  if (node.type === 'file') {
    return (
      <div
        className={`py-1 px-2 hover:bg-accent cursor-pointer text-sm flex items-center gap-2 ${
          isSelected ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium' : ''
        }`}
        onClick={() => onFileClick?.(node.path)}
      >
        {getFileIcon(node.name)}
        <span>{node.name}</span>
      </div>
    )
  }

  return (
    <div>
      <div
        className="py-1 px-2 hover:bg-accent cursor-pointer text-sm flex items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        {isOpen ? (
          <FolderOpen className="size-4 text-yellow-600" />
        ) : (
          <Folder className="size-4 text-yellow-600" />
        )}
        <span>{node.name}</span>
      </div>
      {isOpen && node.children && (
        <div className="pl-4">
          {node.children.map((child, index) => (
            <TreeItem
              key={index}
              node={child}
              onFileClick={onFileClick}
              repoName={repoName}
              selectedPath={selectedPath}
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
}

export function FileTree({ nodes, onFileClick, repoName, selectedPath }: FileTreeProps) {
  return (
    <div className="text-foreground">
      {nodes.map((node, index) => (
        <TreeItem
          key={index}
          node={node}
          onFileClick={onFileClick}
          repoName={repoName}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  )
}
