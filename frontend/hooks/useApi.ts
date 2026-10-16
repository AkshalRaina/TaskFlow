'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Result<T> = { key: string; data?: T; error?: string };

/**
 * Loads data from the API whenever `path` changes. Pass `null` to skip loading (e.g. nothing selected yet).
 *
 *   const { data, error, loading, reload } = useApi<Project[]>('/projects');
 *
 * While a new request is loading, the previous data stays on screen (no flicker).
 */
export function useApi<T>(path: string | null) {
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  // Changes whenever we need a fresh request: a new path, or reload() was called.
  const requestKey = `${path}#${reloadCount}`;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    api<T>(path).then(
      (data) => !cancelled && setResult({ key: requestKey, data }),
      (error: Error) => !cancelled && setResult({ key: requestKey, error: error.message }),
    );

    // Ignore the response if the path changed before it arrived.
    return () => {
      cancelled = true;
    };
  }, [path, requestKey]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return {
    data: path ? result?.data : undefined,
    error: path && result?.key === requestKey ? result.error : undefined,
    loading: Boolean(path) && result?.key !== requestKey,
    reload,
  };
}
