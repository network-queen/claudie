import { Link } from 'react-router-dom';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';

interface ToolCardProps {
  tool: {
    id: string;
    name: string;
    category: string;
    description: string;
  };
}

const categoryColors: Record<string, string> = {
  'file-ops': 'bg-blue-500',
  search: 'bg-emerald-500',
  execution: 'bg-amber-500',
  orchestration: 'bg-purple-500',
  system: 'bg-red-500',
  web: 'bg-cyan-500',
};

export default function ToolCard({ tool }: ToolCardProps) {
  const color = categoryColors[tool.category?.toLowerCase()] ?? 'bg-accent-500';

  return (
    <Link to={`/tools/${tool.id}`}>
      <Card hover className="h-full">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white font-bold text-sm shrink-0`}
          >
            {tool.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate">{tool.name}</h3>
            <Badge className="mt-1">{tool.category}</Badge>
            <p className="mt-2 text-sm text-surface-400 line-clamp-2">{tool.description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
