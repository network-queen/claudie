import { useState, useMemo } from 'react';
import { Plug, Server, Info, Wrench, Search } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getMcpServers, getTools } from '@/lib/api';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import CodeBlock from '@/components/shared/CodeBlock';
import SearchInput from '@/components/shared/SearchInput';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';

type Tab = 'servers' | 'tools';

function McpServersTab() {
  const { data, loading, error, refetch } = useApi(() => getMcpServers());
  const servers: any[] = Array.isArray(data) ? data : [];

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (servers.length === 0) {
    return (
      <Card>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-accent-500/15 text-accent-400">
            <Info className="w-6 h-6" />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">No MCP Servers Configured</h3>
            <p className="text-surface-300 text-sm">
              MCP (Model Context Protocol) lets Claude connect to external tools and services.
              Configure servers in <span className="text-accent-400">Config &rarr; MCP Servers</span>.
            </p>
            <CodeBlock
              title="Example ~/.claude.json"
              code={`{
  "mcpServers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}`}
            />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {servers.map((server: any, i: number) => (
        <Card key={server.name ?? i}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-surface-700">
              <Server className="w-5 h-5 text-accent-400" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{server.name}</h3>
                {server.type && <Badge variant="accent">{server.type}</Badge>}
              </div>
              {server.command && (
                <div>
                  <p className="text-xs text-surface-500 mb-1">Command</p>
                  <code className="text-sm font-mono text-surface-300">{server.command}</code>
                </div>
              )}
              {server.args && server.args.length > 0 && (
                <div>
                  <p className="text-xs text-surface-500 mb-1">Arguments</p>
                  <div className="flex flex-wrap gap-1">
                    {server.args.map((arg: string, j: number) => (
                      <code key={j} className="text-xs font-mono bg-surface-900 px-1.5 py-0.5 rounded text-surface-400">
                        {arg}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              {server.env && Object.keys(server.env).length > 0 && (
                <div>
                  <p className="text-xs text-surface-500 mb-1">Environment</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(server.env).map((key) => (
                      <code key={key} className="text-xs font-mono bg-surface-900 px-1.5 py-0.5 rounded text-surface-400">
                        {key}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ToolsReferenceTab() {
  const { data, loading, error, refetch } = useApi(() => getTools());
  const tools: any[] = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(tools.map((t) => t.category));
    return ['All', ...Array.from(cats)];
  }, [tools]);
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = useMemo(() => {
    let result = tools;
    if (activeCategory !== 'All') {
      const cat = activeCategory.toLowerCase().replace(/\s+/g, '-');
      result = result.filter((t) => t.category?.toLowerCase().replace(/\s+/g, '-') === cat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tools, activeCategory, search]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tools..." />
        <span className="text-xs text-surface-500">{filtered.length} tools</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-accent-500/20 text-accent-400 font-medium'
                : 'text-surface-400 hover:text-white hover:bg-surface-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((tool) => (
          <Card
            key={tool.id}
            className="cursor-pointer"
            onClick={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center text-accent-400 font-bold text-xs shrink-0">
                {tool.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{tool.name}</span>
                  <Badge variant="muted">{tool.category}</Badge>
                  {tool.usageCount > 0 && (
                    <span className="text-[10px] text-accent-400 font-mono">{tool.usageCount.toLocaleString()} uses</span>
                  )}
                  {tool.lastUsedAt && (
                    <span className="text-[10px] text-surface-600">{timeAgoMs(tool.lastUsedAt)}</span>
                  )}
                </div>
                <p className="text-xs text-surface-400 mt-0.5 truncate">{tool.description?.slice(0, 120)}</p>
              </div>
            </div>

            {expandedId === tool.id && (
              <div className="mt-3 pt-3 border-t border-surface-700 space-y-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-surface-300">{tool.description}</p>

                {tool.when_to_use && (
                  <div>
                    <h4 className="text-xs font-medium text-surface-400 mb-1">When to use</h4>
                    <p className="text-xs text-surface-300">{tool.when_to_use}</p>
                  </div>
                )}

                {tool.parameters?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-surface-400 mb-1">Parameters</h4>
                    <div className="space-y-1">
                      {tool.parameters.map((p: any) => (
                        <div key={p.name} className="flex gap-2 text-xs">
                          <code className="text-accent-400 font-mono shrink-0">{p.name}</code>
                          <span className="text-surface-500">{p.type}{p.required ? '' : '?'}</span>
                          <span className="text-surface-400">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tool.examples?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-surface-400 mb-1">Examples</h4>
                    {tool.examples.map((ex: any, i: number) => (
                      <div key={i} className="mb-2">
                        <p className="text-xs text-surface-300 mb-1">{ex.title || ex.description}</p>
                        {ex.code && <CodeBlock code={ex.code} />}
                      </div>
                    ))}
                  </div>
                )}

                {tool.tips?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-surface-400 mb-1">Tips</h4>
                    <ul className="list-disc list-inside space-y-0.5">
                      {tool.tips.map((tip: string, i: number) => (
                        <li key={i} className="text-xs text-surface-400">{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function timeAgoMs(timestamp: number): string {
  const ms = Date.now() - timestamp;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function McpPage() {
  const [activeTab, setActiveTab] = useState<Tab>('servers');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">MCP & Tools</h1>
        <p className="text-surface-400 text-sm mt-1">
          MCP server connections and built-in tool reference
        </p>
      </div>

      <div className="flex gap-1 bg-surface-800 border border-surface-700 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
            activeTab === 'servers'
              ? 'bg-accent-500/20 text-accent-400 font-medium'
              : 'text-surface-400 hover:text-white'
          }`}
        >
          <Plug className="w-4 h-4" />
          MCP Servers
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
            activeTab === 'tools'
              ? 'bg-accent-500/20 text-accent-400 font-medium'
              : 'text-surface-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Tools Reference
        </button>
      </div>

      {activeTab === 'servers' && <McpServersTab />}
      {activeTab === 'tools' && <ToolsReferenceTab />}
    </div>
  );
}
