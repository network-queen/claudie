import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { getShortcuts } from '@/lib/api';
import SearchInput from '@/components/shared/SearchInput';
import Badge from '@/components/shared/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

const contexts = ['All', 'Input', 'Conversation', 'Global', 'Generation'];

function KeyBadge({ keys }: { keys: string }) {
  const parts = keys.split('+').map((k) => k.trim());
  return (
    <div className="flex items-center gap-1">
      {parts.map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-surface-600 text-xs">+</span>}
          <kbd className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 bg-surface-700 border border-surface-600 rounded-md text-xs font-mono text-surface-200 shadow-sm">
            {key}
          </kbd>
        </span>
      ))}
    </div>
  );
}

export default function ShortcutsPage() {
  const [search, setSearch] = useState('');
  const [activeContext, setActiveContext] = useState('All');
  const { data, loading, error, refetch } = useApi(() => getShortcuts());

  const shortcuts: any[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    let result = shortcuts;
    if (activeContext !== 'All') {
      const ctx = activeContext.toLowerCase();
      result = result.filter((s) => s.context?.toLowerCase() === ctx);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.keys?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [shortcuts, activeContext, search]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Keyboard Shortcuts</h1>
        <p className="text-surface-400 text-sm mt-1">
          {loading
            ? 'Loading...'
            : `${filtered.length} shortcut${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search shortcuts..." />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {contexts.map((ctx) => (
          <button
            key={ctx}
            onClick={() => setActiveContext(ctx)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeContext === ctx
                ? 'bg-accent-500/20 text-accent-400 font-medium'
                : 'text-surface-400 hover:text-white hover:bg-surface-800'
            }`}
          >
            {ctx}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No shortcuts found"
          description="Try adjusting your search or filter."
        />
      ) : (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-6 gap-y-0 text-sm">
            {/* Header */}
            <div className="col-span-4 grid grid-cols-[auto_1fr_auto_1fr] gap-x-6 px-4 py-3 border-b border-surface-700 bg-surface-800/50">
              <span className="text-surface-500 font-medium text-xs uppercase tracking-wider">Keys</span>
              <span className="text-surface-500 font-medium text-xs uppercase tracking-wider">Action</span>
              <span className="text-surface-500 font-medium text-xs uppercase tracking-wider">Context</span>
              <span className="text-surface-500 font-medium text-xs uppercase tracking-wider">Description</span>
            </div>
            {/* Rows */}
            {filtered.map((shortcut: any, i: number) => (
              <div
                key={shortcut.id ?? i}
                className="col-span-4 grid grid-cols-[auto_1fr_auto_1fr] gap-x-6 px-4 py-3 border-b border-surface-700/50 items-center hover:bg-surface-700/20 transition-colors"
              >
                <KeyBadge keys={shortcut.keys} />
                <span className="text-white font-medium">{shortcut.name}</span>
                <Badge>{shortcut.context}</Badge>
                <span className="text-surface-400">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
