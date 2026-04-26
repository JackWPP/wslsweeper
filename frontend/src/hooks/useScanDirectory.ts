import { useState, useEffect } from 'react';
import { scanDirectory } from '../api/client';
import type { ScanResponse } from '../types';

export function useScanDirectory(initialPath: string) {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    scanDirectory(initialPath)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [initialPath]);

  return { data, loading, error };
}