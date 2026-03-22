import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
}: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
      />
    </div>
  );
}
