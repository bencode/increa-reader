import { useCallback, useRef } from 'react'

/**
 * Create a stable event handler reference that always accesses the latest values
 *
 * Similar to React's proposed useEffectEvent, provides a stable function reference
 * while accessing the latest props and state, avoiding dependency hell.
 *
 * @example
 * const handleClick = useEventCallback((id: string) => {
 *   // Can access latest state/props
 *   console.log(count, id)
 * })
 *
 * // Safe to put in dependency arrays, reference is always stable
 * useEffect(() => {
 *   handleClick('test')
 * }, [handleClick])
 */
export function useEventCallback<Args extends unknown[], R>(
  callback: (...args: Args) => R
): (...args: Args) => R {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  return useCallback((...args: Args) => callbackRef.current(...args), [])
}
