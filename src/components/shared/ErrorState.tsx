import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400" />
      <h3 className="text-lg font-semibold text-surface-300">Something went wrong</h3>
      <p className="text-surface-500 text-sm max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm rounded-lg transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
