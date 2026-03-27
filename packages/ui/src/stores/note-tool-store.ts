import { create } from 'zustand'
import type { NoteDocumentContext, StandardizedNote } from '@/types/notes'

type NoteToolState = {
  document: NoteDocumentContext | null
  notes: StandardizedNote[]
  visibleNotes: StandardizedNote[]
  setDocument: (document: NoteDocumentContext) => void
  setNotes: (notes: StandardizedNote[]) => void
  setVisibleNotes: (notes: StandardizedNote[]) => void
  clear: () => void
}

export const useNoteToolStore = create<NoteToolState>(set => ({
  document: null,
  notes: [],
  visibleNotes: [],
  setDocument: document => set({ document }),
  setNotes: notes => set({ notes }),
  setVisibleNotes: visibleNotes => set({ visibleNotes }),
  clear: () => set({ document: null, notes: [], visibleNotes: [] }),
}))

export function getDocumentNotesPayload() {
  const { document, notes } = useNoteToolStore.getState()
  return {
    document,
    total: notes.length,
    notes,
  }
}

export function getVisibleNotesPayload() {
  const { document, visibleNotes } = useNoteToolStore.getState()
  return {
    document,
    total: visibleNotes.length,
    notes: visibleNotes,
  }
}
