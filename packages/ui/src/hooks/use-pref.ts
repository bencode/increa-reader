import { useCallback } from 'react'

const PREFIX = 'pref:'

export function usePref(scope: string) {
  const get = useCallback(
    <T>(key: string, fallback: T): T => {
      const raw = localStorage.getItem(`${PREFIX}${scope}.${key}`)
      if (raw === null) return fallback
      try {
        return JSON.parse(raw) as T
      } catch {
        return fallback
      }
    },
    [scope],
  )

  const set = useCallback(
    (key: string, value: unknown) => {
      localStorage.setItem(`${PREFIX}${scope}.${key}`, JSON.stringify(value))
    },
    [scope],
  )

  return { get, set }
}
