import { useCallback, useEffect, useState } from 'react'
import type {
  DocumentFileType,
  DocumentNote,
  NoteDocumentContext,
  NotePosition,
} from '@/types/notes'
import {
  createDocumentNote,
  deleteDocumentNote,
  fetchDocumentNotes,
  updateDocumentNote,
} from '../api'
import { useNoteToolStore } from '@/stores/note-tool-store'

type UseDocumentNotesResultFor<TPosition extends NotePosition> = {
  notes: DocumentNote<TPosition>[]
  loading: boolean
  error: string | null
  createNote: (note: { color: DocumentNote['color']; content: string; position: TPosition }) => Promise<DocumentNote<TPosition>>
  updateNote: (
    noteId: string,
    note: { color: DocumentNote['color']; content: string; position: TPosition },
  ) => Promise<{ deleted: boolean; note?: DocumentNote<TPosition> }>
  deleteNote: (noteId: string) => Promise<void>
  reload: () => Promise<void>
}

export function useDocumentNotes<TPosition extends NotePosition>(
  repo: string,
  path: string,
  fileType: DocumentFileType,
): UseDocumentNotesResultFor<TPosition> {
  const [notes, setNotes] = useState<DocumentNote<TPosition>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes([])
    setError(null)
    setLoading(true)
    useNoteToolStore.getState().clear()
    useNoteToolStore.getState().setDocument({ repo, path, fileType } satisfies NoteDocumentContext)
  }, [repo, path, fileType])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await fetchDocumentNotes(repo, path)
      setNotes(loaded as DocumentNote<TPosition>[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [repo, path])

  useEffect(() => {
    void reload()
  }, [reload])

  const createNote = useCallback(async (
    note: { color: DocumentNote['color']; content: string; position: TPosition },
  ) => {
    const created = await createDocumentNote(repo, path, note)
    setNotes(prev => [...prev, created as DocumentNote<TPosition>])
    return created as DocumentNote<TPosition>
  }, [repo, path])

  const updateNote = useCallback(async (
    noteId: string,
    note: { color: DocumentNote['color']; content: string; position: TPosition },
  ) => {
    const result = await updateDocumentNote(repo, path, noteId, note)
    setNotes(prev => (
      result.deleted
        ? prev.filter(item => item.id !== noteId)
        : prev.map(item => (item.id === noteId ? result.note! as DocumentNote<TPosition> : item))
    ))
    return result as { deleted: boolean; note?: DocumentNote<TPosition> }
  }, [repo, path])

  const deleteNote = useCallback(async (noteId: string) => {
    await deleteDocumentNote(repo, path, noteId)
    setNotes(prev => prev.filter(item => item.id !== noteId))
  }, [repo, path])

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
    reload,
  }
}
