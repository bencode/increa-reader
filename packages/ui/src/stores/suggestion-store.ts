import { create } from 'zustand'

export type Suggestion = { label: string; prompt: string }

type SuggestionStore = {
  suggestion: Suggestion | null
  setSuggestion: (s: Suggestion) => void
  clear: () => void
}

export const useSuggestionStore = create<SuggestionStore>(set => ({
  suggestion: null,
  setSuggestion: suggestion => set({ suggestion }),
  clear: () => set({ suggestion: null }),
}))
