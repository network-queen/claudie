import { Copy, Check } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const { copied, copy } = useClipboard();

  return (
    <button
      onClick={() => copy(text)}
      className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}
