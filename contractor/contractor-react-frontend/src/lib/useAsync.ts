/**
 * A minimal data-loading hook.
 *
 * Nine screens in this app do the same three things: fetch on mount, show a skeleton, show an
 * error. Written inline that is nine copies of the same `useEffect`, and the copy that forgets the
 * cancellation flag is the one that ships.
 *
 * In phase 4 the read paths move to Apollo's `useQuery`, which does all of this and caches as well.
 * This hook stays for the writes-plus-refetch screens, where Apollo has nothing to offer.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-runs the loader. Handy after a mutation — accept a quote, then reload the project. */
  reload: () => void
}

/**
 * @param loader  the async function to run. It is re-run whenever `deps` change.
 * @param deps    the same contract as `useEffect`'s dependency array.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // ⚠️ The loader is a fresh closure on every render, so it cannot go in the dependency array
  // without looping forever. A ref holds the latest one; `deps` decides when to actually re-run.
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    // ⚠️ The cancellation flag is the point of this hook. Without it, a fast navigation away
    // leaves a promise in flight that resolves into an unmounted component — and worse, two
    // overlapping loads can resolve out of order and leave the OLDER response on screen.
    let cancelled = false

    setLoading(true)
    setError(null)

    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, error, reload }
}
