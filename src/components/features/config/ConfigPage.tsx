import { useState, useEffect } from 'react';
import { themes, getActiveTheme, setActiveTheme } from '@/lib/themes';
import {
  Settings,
  FileText,
  Plug,
  Save,
  Send,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

type TabId = 'settings' | 'tools' | 'mcp' | 'claude-md' | 'telegram';

const tabs: { id: TabId; label: string; icon: typeof Settings }[] = [
  { id: 'tools', label: 'Tools', icon: Settings },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'mcp', label: 'MCP Servers', icon: Plug },
  { id: 'claude-md', label: 'CLAUDE.md', icon: FileText },
  { id: 'telegram', label: 'Telegram', icon: Send },
];

function Notification({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
        type === 'success'
          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/20'
      }`}
    >
      {type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {text}
    </div>
  );
}

function ToolsTab() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/terminal/claude-info').then((r) => r.json()).then((j) => { setInfo(j.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const claude = info?.claude || {};
  const opencode = info?.opencode || {};

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Installed Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Claude Code */}
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${claude.installed ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-semibold text-white">Claude Code</span>
              {claude.version && <span className="text-[10px] text-surface-500 font-mono">{claude.version}</span>}
            </div>
            {claude.installed ? (
              <div className="space-y-2">
                <p className="text-xs text-surface-400 font-mono">{claude.path}</p>
                <p className="text-xs text-surface-500">{claude.models?.length || 0} models available</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-400">Not installed</p>
                <div className="bg-surface-900 rounded-lg px-3 py-2 text-xs font-mono text-surface-300">
                  npm install -g @anthropic-ai/claude-code
                </div>
                <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-accent-400 hover:underline">Installation guide →</a>
              </div>
            )}
          </Card>

          {/* OpenCode */}
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${opencode.installed ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-semibold text-white">OpenCode</span>
              {opencode.version && <span className="text-[10px] text-surface-500 font-mono">{opencode.version}</span>}
            </div>
            {opencode.installed ? (
              <div className="space-y-2">
                <p className="text-xs text-surface-400 font-mono">{opencode.path}</p>
                <p className="text-xs text-surface-500">{opencode.models?.length || 0} free models available</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-400">Not installed</p>
                <div className="bg-surface-900 rounded-lg px-3 py-2 text-xs font-mono text-surface-300">
                  curl -fsSL https://opencode.ai/install | bash
                </div>
                <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-accent-400 hover:underline">Installation guide →</a>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Available models */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Available Models</h3>
        <div className="space-y-1">
          {claude.installed && claude.models?.map((m: string) => (
            <div key={m} className="flex items-center gap-2 px-3 py-1.5 bg-surface-900 rounded text-xs">
              <span className="px-1.5 py-0.5 bg-accent-500/15 text-accent-400 text-[9px] rounded">claude</span>
              <span className="text-surface-200 font-mono">{m}</span>
            </div>
          ))}
          {opencode.installed && opencode.models?.map((m: string) => (
            <div key={m} className="flex items-center gap-2 px-3 py-1.5 bg-surface-900 rounded text-xs">
              <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 text-[9px] rounded">opencode</span>
              <span className="text-surface-200 font-mono">{m}</span>
              <span className="text-[9px] text-green-500/60">free</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data, loading, error, refetch } = useApi(() =>
    fetch('/api/config/settings').then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    })
  );
  const [currentTheme, setCurrentTheme] = useState(getActiveTheme().id);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Theme picker */}
      <div>
        <h3 className="text-sm font-medium text-surface-400 mb-3">Theme</h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {themes.map((theme) => (
            <button key={theme.id} onClick={() => { setActiveTheme(theme.id); setCurrentTheme(theme.id); }}
              className={`rounded-lg p-3 border transition-all ${
                currentTheme === theme.id
                  ? 'border-accent-500 ring-1 ring-accent-500/50'
                  : 'border-surface-700 hover:border-surface-500'
              }`}
              style={{ backgroundColor: theme.card }}>
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.accent }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.border }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.textMuted }} />
              </div>
              <span className="text-[10px]" style={{ color: theme.text }}>{theme.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-surface-400 mb-2">Settings JSON <span className="text-surface-600">(read-only)</span></h3>
        <pre className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-3 text-sm text-surface-300 font-mono overflow-auto max-h-[600px]"
          style={{ tabSize: 2 }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

interface McpServer {
  name: string;
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

function McpTab() {
  const { data, loading, error, refetch } = useApi(() =>
    fetch('/api/config-editor/mcp').then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json().then((j) => j.data ?? j);
    })
  );

  const [servers, setServers] = useState<McpServer[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteMcpTarget, setDeleteMcpTarget] = useState<string | null>(null);
  const [newServer, setNewServer] = useState<McpServer>({
    name: '',
    type: 'stdio',
    command: '',
    args: [],
    env: {},
  });
  const [newArgsStr, setNewArgsStr] = useState('');
  const [newEnvStr, setNewEnvStr] = useState('');

  useEffect(() => {
    if (data && typeof data === 'object') {
      // API returns { serverName: { command, args, env, ... }, ... } — convert to array
      if (Array.isArray(data)) {
        setServers(data);
      } else {
        const arr = Object.entries(data as Record<string, any>).map(([name, config]) => ({
          name,
          type: config.type || 'stdio',
          command: config.command || '',
          args: config.args || [],
          env: config.env || {},
        }));
        setServers(arr);
      }
    }
  }, [data]);

  const handleSaveServer = async (server: McpServer) => {
    setNotification(null);
    try {
      const res = await fetch(`/api/config-editor/mcp/${encodeURIComponent(server.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });
      if (!res.ok) throw new Error(`Save failed`);
      setNotification({ type: 'success', text: `Saved ${server.name}` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const handleDeleteServer = async (name: string) => {
    try {
      const res = await fetch(`/api/config-editor/mcp/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setServers((prev) => prev.filter((s) => s.name !== name));
      setNotification({ type: 'success', text: `Deleted ${name}` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name.trim()) return;
    const server: McpServer = {
      ...newServer,
      args: newArgsStr
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      env: newEnvStr
        .split('\n')
        .reduce((acc, line) => {
          const [key, ...rest] = line.split('=');
          if (key?.trim()) acc[key.trim()] = rest.join('=').trim();
          return acc;
        }, {} as Record<string, string>),
    };
    try {
      const res = await fetch('/api/config-editor/mcp/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Add failed');
      }
      setServers((prev) => [...prev, server]);
      setShowNew(false);
      setNewServer({ name: '', type: 'stdio', command: '', args: [], env: {} });
      setNewArgsStr('');
      setNewEnvStr('');
      setNotification({ type: 'success', text: `Added ${server.name}` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ type: 'error', text: 'Failed to add server' });
    }
  };

  const updateServerField = (index: number, field: string, value: any) => {
    setServers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {notification && <Notification type={notification.type} text={notification.text} />}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-surface-400">MCP Servers ({servers.length})</h3>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add New Server
        </button>
      </div>

      {/* Add new server form */}
      {showNew && (
        <Card className="space-y-3">
          <h4 className="text-sm font-medium text-white">New MCP Server</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Name</label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                placeholder="my-server"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Type</label>
              <input
                type="text"
                value={newServer.type || ''}
                onChange={(e) => setNewServer({ ...newServer, type: e.target.value })}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                placeholder="stdio"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-surface-400 mb-1">Command</label>
              <input
                type="text"
                value={newServer.command || ''}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-accent-500"
                placeholder="npx -y @modelcontextprotocol/server"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Args (one per line)</label>
              <textarea
                value={newArgsStr}
                onChange={(e) => setNewArgsStr(e.target.value)}
                rows={3}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-accent-500 resize-y"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Env (KEY=value, one per line)</label>
              <textarea
                value={newEnvStr}
                onChange={(e) => setNewEnvStr(e.target.value)}
                rows={3}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-accent-500 resize-y"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNew(false)}
              className="px-3 py-1.5 text-xs text-surface-400 hover:text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddServer}
              disabled={!newServer.name.trim()}
              className="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-xs rounded-md transition-colors"
            >
              Add Server
            </button>
          </div>
        </Card>
      )}

      {/* Server cards */}
      {servers.length === 0 && !showNew && (
        <EmptyState title="No MCP servers configured" description="Add a new MCP server to get started." />
      )}
      {servers.map((server, i) => (
        <McpServerCard
          key={server.name}
          server={server}
          onChange={(field, value) => updateServerField(i, field, value)}
          onSave={() => handleSaveServer(servers[i])}
          onDelete={() => setDeleteMcpTarget(server.name)}
        />
      ))}

      {/* Delete MCP Confirmation */}
      {deleteMcpTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h2 className="text-lg font-semibold">Delete MCP Server</h2>
              </div>
              <p className="text-sm text-surface-300">
                Remove <code className="text-accent-400 font-mono">{deleteMcpTarget}</code> from your MCP configuration?
              </p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button onClick={() => setDeleteMcpTarget(null)}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => { handleDeleteServer(deleteMcpTarget); setDeleteMcpTarget(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function McpServerCard({
  server,
  onChange,
  onSave,
  onDelete,
}: {
  server: McpServer;
  onChange: (field: string, value: any) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-accent-400" />
          <span className="text-sm font-semibold text-white">{server.name}</span>
          {server.type && <Badge variant="muted">{server.type}</Badge>}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onSave}
            className="flex items-center gap-1 px-2.5 py-1 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 text-xs rounded-md transition-colors"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs rounded-md transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-surface-400 mb-1">Command</label>
          <input
            type="text"
            value={server.command || ''}
            onChange={(e) => onChange('command', e.target.value)}
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent-500"
          />
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Args</label>
          <input
            type="text"
            value={Array.isArray(server.args) ? server.args.join(' ') : ''}
            onChange={(e) => onChange('args', e.target.value.split(' ').filter(Boolean))}
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent-500"
          />
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Env</label>
          <input
            type="text"
            value={
              server.env
                ? Object.entries(server.env)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ')
                : ''
            }
            onChange={(e) => {
              const env: Record<string, string> = {};
              e.target.value.split(',').forEach((pair) => {
                const [key, ...rest] = pair.split('=');
                if (key?.trim()) env[key.trim()] = rest.join('=').trim();
              });
              onChange('env', env);
            }}
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent-500"
          />
        </div>
      </div>
    </Card>
  );
}

const GLOBAL_CLAUDE_MD_TEMPLATE = `# Global Claude Code Guidelines

## Role
You are assisting a developer. Follow these rules in every project.

## Conventions
- Write clean, concise code
- Prefer simple solutions over clever ones
- Follow existing project patterns

## Do
- Read files before editing
- Run tests after changes
- Keep changes focused and minimal

## Don't
- Don't add unnecessary abstractions
- Don't modify files outside the task scope
- Don't commit without being asked
`;

function ClaudeMdTab() {
  const GLOBAL_PATH = '~/.claude/CLAUDE.md';

  const { data, loading, error, refetch } = useApi(() =>
    fetch('/api/config-editor/claude-md?project=GLOBAL').then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json().then((j) => j.data ?? j);
    })
  );

  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const exists = !!(data?.content);

  useEffect(() => {
    if (data && !initialized) {
      setEditContent(data.content || '');
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);
    try {
      const res = await fetch('/api/config-editor/claude-md', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: 'GLOBAL', content: editContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      setNotification({ type: 'success', text: 'Global CLAUDE.md saved' });
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification({ type: 'error', text: 'Failed to save CLAUDE.md' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    setEditContent(GLOBAL_CLAUDE_MD_TEMPLATE);
    setInitialized(true);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {notification && <Notification type={notification.type} text={notification.text} />}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Global CLAUDE.md</h3>
          <p className="text-xs text-surface-500 font-mono mt-0.5">{GLOBAL_PATH}</p>
          <p className="text-xs text-surface-400 mt-1">
            These instructions apply to Claude in <span className="text-white">every</span> project on this machine.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !editContent.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : exists ? 'Save' : 'Create & Save'}
        </button>
      </div>

      {!exists && !editContent && (
        <Card className="flex flex-col items-center gap-3 py-8">
          <FileText className="w-10 h-10 text-surface-600" />
          <p className="text-sm text-surface-400">No global CLAUDE.md found</p>
          <p className="text-xs text-surface-500 max-w-md text-center">
            A global CLAUDE.md lets you set rules that Claude follows in every project — coding style, conventions, do/don't lists.
          </p>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            Create with Template
          </button>
        </Card>
      )}

      {(exists || editContent) && (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={24}
          spellCheck={false}
          className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-3 text-sm text-surface-200 font-mono focus:outline-none focus:border-accent-500 resize-y"
          style={{ tabSize: 2 }}
        />
      )}
    </div>
  );
}

function TelegramTab() {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/telegram/config').then((r) => r.json()).then((j) => {
      const d = j.data || {};
      setBotToken(d.botToken || '');
      setChatId(d.chatId || '');
      setEnabled(d.enabled || false);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/telegram/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId, enabled }) });
      setNotification({ type: 'success', text: 'Telegram config saved' });
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification({ type: 'error', text: 'Failed to save' });
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      if (res.ok) setNotification({ type: 'success', text: 'Test message sent! Check Telegram.' });
      else setNotification({ type: 'error', text: 'Failed to send test message' });
    } catch {
      setNotification({ type: 'error', text: 'Failed' });
    } finally { setTesting(false); setTimeout(() => setNotification(null), 3000); }
  };

  if (!loaded) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {notification && <Notification type={notification.type} text={notification.text} />}

      <div>
        <h3 className="text-sm font-medium text-white mb-1">Telegram Bot Integration</h3>
        <p className="text-xs text-surface-500">Get notified when Claude needs input. Add and run tasks from Telegram.</p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-surface-600 bg-surface-900 text-accent-500" />
        <span className="text-sm text-surface-300">Enable Telegram notifications</span>
      </label>

      <div>
        <label className="block text-xs text-surface-400 mb-1">Bot Token</label>
        <input type="text" value={botToken} onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456:ABC-DEF..."
          className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-surface-500 focus:outline-none focus:border-accent-500" />
        <p className="text-xs text-surface-500 mt-1">Create a bot via @BotFather on Telegram</p>
      </div>

      <div>
        <label className="block text-xs text-surface-400 mb-1">Chat ID</label>
        <input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)}
          placeholder="Your Telegram chat ID"
          className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-surface-500 focus:outline-none focus:border-accent-500" />
        <p className="text-xs text-surface-500 mt-1">Send /start to @userinfobot to get your chat ID</p>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={handleTest} disabled={testing || !enabled || !botToken || !chatId}
          className="flex items-center gap-1.5 px-4 py-2 bg-surface-700 hover:bg-surface-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
          <Send className="w-4 h-4" /> {testing ? 'Sending...' : 'Send Test'}
        </button>
      </div>

      <Card>
        <h4 className="text-xs font-medium text-surface-400 mb-2">Bot Commands</h4>
        <div className="space-y-1 text-xs font-mono">
          <p><span className="text-accent-400">/task</span> <span className="text-surface-500">&lt;description&gt;</span> — Create a new task</p>
          <p><span className="text-accent-400">/run</span> <span className="text-surface-500">&lt;task-id&gt;</span> — Execute a task</p>
          <p><span className="text-accent-400">/tasks</span> — List all tasks</p>
          <p><span className="text-accent-400">/status</span> — Current project info</p>
          <p><span className="text-accent-400">/help</span> — Show commands</p>
        </div>
      </Card>
    </div>
  );
}

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>('settings');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuration</h1>
        <p className="text-surface-400 text-sm mt-1">
          Edit your Claude Code settings, MCP servers, and CLAUDE.md files
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 border border-surface-700 rounded-lg p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
              activeTab === id
                ? 'bg-accent-500/20 text-accent-400 font-medium'
                : 'text-surface-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'tools' && <ToolsTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'mcp' && <McpTab />}
      {activeTab === 'claude-md' && <ClaudeMdTab />}
      {activeTab === 'telegram' && <TelegramTab />}
    </div>
  );
}
