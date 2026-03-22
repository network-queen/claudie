import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import { useSearch } from '../../hooks/useSearch';
import { NAV_ITEMS } from '../../lib/constants';

interface TopBarProps {
  onMenuClick: () => void;
}

function getPageTitle(pathname: string): string {
  const navItem = NAV_ITEMS.find((item) => item.path === pathname);
  if (navItem) return navItem.label;

  if (pathname.startsWith('/tools/')) return 'Tool Detail';
  if (pathname.startsWith('/skills/')) return 'Skill Detail';
  if (pathname.startsWith('/patterns/')) return 'Pattern Detail';

  return 'Claudie';
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { query, setQuery, results, loading } = useSearch();
  const title = getPageTitle(location.pathname);

  return (
    <header className="flex items-center gap-4 border-b border-surface-700 bg-surface-800/50 backdrop-blur-sm px-6 py-4">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-surface-400 hover:bg-surface-700 hover:text-white transition-all duration-200 lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything..."
          className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-9 pr-9 text-sm text-white placeholder-surface-500 outline-none transition-all duration-200 focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/25"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-all duration-200"
          >
            <X size={14} />
          </button>
        )}

        {/* Search results dropdown */}
        {query && (results || loading) && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-surface-700 bg-surface-800 shadow-2xl">
            {loading && (
              <div className="px-4 py-3 text-sm text-surface-400">Searching...</div>
            )}
            {results && !loading && (
              <>
                {Array.isArray(results) && results.length === 0 && (
                  <div className="px-4 py-3 text-sm text-surface-400">No results found</div>
                )}
                {Array.isArray(results) &&
                  results.map((item: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (item.path) navigate(item.path);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-700 transition-all duration-200"
                    >
                      <span className="text-xs font-medium uppercase text-surface-500">
                        {item.type}
                      </span>
                      <span className="text-white">{item.name || item.title}</span>
                    </button>
                  ))}
                {results && typeof results === 'object' && !Array.isArray(results) &&
                  Object.entries(results).map(([section, items]: [string, any]) => (
                    <div key={section}>
                      <div className="px-4 py-2 text-xs font-semibold uppercase text-surface-500 bg-surface-900/50">
                        {section}
                      </div>
                      {Array.isArray(items) &&
                        items.map((item: any, i: number) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (item.path) navigate(item.path);
                              setQuery('');
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-700 transition-all duration-200"
                          >
                            <span className="text-white">{item.name || item.title}</span>
                          </button>
                        ))}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
