import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { getTools } from '@/lib/api';
import SearchInput from '@/components/shared/SearchInput';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';
import ToolCard from './ToolCard';

const categories = ['All', 'File Ops', 'Search', 'Execution', 'Orchestration', 'System', 'Web'];

export default function ToolsPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const { data, loading, error, refetch } = useApi(() => getTools());

  const tools: any[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    let result = tools;
    if (activeCategory !== 'All') {
      const cat = activeCategory.toLowerCase().replace(/\s+/g, '-');
      result = result.filter(
        (t) => t.category?.toLowerCase().replace(/\s+/g, '-') === cat
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tools, activeCategory, search]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tools</h1>
          <p className="text-surface-400 text-sm mt-1">
            {loading ? 'Loading...' : `${filtered.length} tool${filtered.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search tools..." />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-accent-500/20 text-accent-400 font-medium'
                : 'text-surface-400 hover:text-white hover:bg-surface-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No tools found" description="Try adjusting your search or filter." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
