import { SearchX } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="text-surface-500">
        {icon ?? <SearchX className="w-12 h-12" />}
      </div>
      <h3 className="text-lg font-semibold text-surface-300">{title}</h3>
      {description && <p className="text-surface-500 text-sm max-w-md">{description}</p>}
    </div>
  );
}
