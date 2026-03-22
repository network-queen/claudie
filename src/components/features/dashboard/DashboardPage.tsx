import { Link } from 'react-router-dom';
import { Plug, Zap, Keyboard, Lightbulb, ArrowRight, Star } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getStats, getTips } from '@/lib/api';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';

const quickLinks = [
  {
    to: '/mcp',
    icon: Plug,
    title: 'MCP & Tools',
    description: 'MCP server connections and built-in tool documentation.',
    color: 'bg-blue-500/15 text-blue-400',
  },
  {
    to: '/shortcuts',
    icon: Keyboard,
    title: 'Keyboard Shortcuts',
    description: 'Master the keyboard shortcuts to speed up your workflow.',
    color: 'bg-amber-500/15 text-amber-400',
  },
  {
    to: '/skills',
    icon: Zap,
    title: 'Skills Browser',
    description: 'Explore built-in slash commands and workflow automations.',
    color: 'bg-purple-500/15 text-purple-400',
  },
];

export default function DashboardPage() {
  const { data: statsData, loading: statsLoading, error: statsError, refetch: refetchStats } = useApi(() => getStats());
  const { data: tipsData, loading: tipsLoading, error: tipsError, refetch: refetchTips } = useApi(() => getTips());

  const stats = statsData as any;
  const tips = Array.isArray(tipsData) ? tipsData : [];

  const statCards = [
    { label: 'MCP Servers', value: stats?.mcp ?? '--', icon: Plug, color: 'text-blue-400' },
    { label: 'Skills', value: stats?.skills ?? '--', icon: Zap, color: 'text-purple-400' },
    { label: 'Tools', value: stats?.tools ?? '--', icon: Keyboard, color: 'text-emerald-400' },
    { label: 'Tips', value: stats?.tips ?? '--', icon: Lightbulb, color: 'text-amber-400' },
  ];

  const featuredTips = tips.slice(0, 3);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Claudie <span className="text-surface-500 font-normal">--</span>{' '}
          <span className="text-surface-300 font-normal">Your Claude Code Companion</span>
        </h1>
        <p className="mt-2 text-surface-400">
          Your visual reference and productivity hub for AI-assisted coding with Claude.
        </p>
      </div>

      {/* Stat cards */}
      {statsError ? (
        <ErrorState message={statsError} onRetry={refetchStats} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {statsLoading ? '...' : value}
                  </p>
                  <p className="text-xs text-surface-500">{label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Quick start */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickLinks.map(({ to, icon: Icon, title, description, color }) => (
            <Link key={to} to={to}>
              <Card hover>
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">{title}</h3>
                      <ArrowRight className="w-4 h-4 text-surface-500" />
                    </div>
                    <p className="mt-1 text-sm text-surface-400">{description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured tips */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Featured Tips</h2>
          <Link
            to="/tips"
            className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
          >
            View all
          </Link>
        </div>
        {tipsError ? (
          <ErrorState message={tipsError} onRetry={refetchTips} />
        ) : tipsLoading ? (
          <LoadingSpinner />
        ) : featuredTips.length === 0 ? (
          <p className="text-surface-500 text-sm">No tips available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredTips.map((tip: any) => (
              <Card key={tip.id}>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="accent">{tip.category}</Badge>
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(tip.priority ?? 1, 5) }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
                <h3 className="font-semibold text-white mb-2">{tip.title}</h3>
                <p className="text-sm text-surface-400 line-clamp-3">{tip.content}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
