import { createContext, useContext, useRef, type ReactNode } from 'react'

type VisibleElementsRef = { current: Set<HTMLElement> }

const VisibleContentContext = createContext<VisibleElementsRef | null>(null)

export function VisibleContentProvider({ children }: { children: ReactNode }) {
  const elementsRef = useRef<Set<HTMLElement>>(new Set())

  return <VisibleContentContext.Provider value={elementsRef}>{children}</VisibleContentContext.Provider>
}

export function useVisibleContent() {
  const elementsRef = useContext(VisibleContentContext)
  if (!elementsRef) {
    throw new Error('useVisibleContent must be used within VisibleContentProvider')
  }
  return elementsRef
}
