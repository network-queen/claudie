import { useState, useEffect, useRef } from 'react';
import { globalSearch } from '../lib/api';

export function useSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(() => {
      globalSearch(query.trim())
        .then((data) => {
          setResults(data);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Search failed');
        })
        .finally(() => {
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, debounceMs]);

  return { query, setQuery, results, loading, error };
}
