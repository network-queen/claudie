import { useState, useMemo } from 'react';
import { Star } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getTips } from '@/lib/api';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

const categories = [
  'All',
  'Performance',
  'Context',
  'Workflow',
  'Config',
  'Advanced',
  'Prompting',
];

function renderContent(content: string) {
  // Simple markdown-ish rendering: bold and paragraphs
  const paragraphs = content.split('\n\n').filter(Boolean);
  return paragraphs.map((p, i) => {
    // Replace **text** with bold
    const parts = p.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-sm text-surface-300 mb-2 last:mb-0">
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={j} className="text-white font-medium">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={j}>{part}</span>;
        })}
      </p>
    );
  });
}

export default function TipsPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const { data, loading, error, refetch } = useApi(() => getTips());

  const tips: any[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    let result = [...tips];
    if (activeCategory !== 'All') {
      const cat = activeCategory.toLowerCase();
      result = result.filter((t) => t.category?.toLowerCase() === cat);
    }
    // Sort by priority descending
    result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return result;
  }, [tips, activeCategory]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tips & Best Practices</h1>
        <p className="text-surface-400 text-sm mt-1">
          {loading
            ? 'Loading...'
            : `${filtered.length} tip${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

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
        <EmptyState title="No tips found" description="Try a different category." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((tip: any) => (
            <Card key={tip.id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">{tip.title}</h3>
                  <Badge variant="accent">{tip.category}</Badge>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {Array.from({ length: Math.min(tip.priority ?? 1, 5) }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
              <div>{renderContent(tip.content ?? '')}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
