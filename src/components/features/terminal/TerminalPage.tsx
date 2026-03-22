import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TerminalSquare,
  Play,
  X,
  ChevronDown,
  FolderOpen,
  ShieldOff,
  Sparkles,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalTab {
  id: string;
  active: boolean;
  terminal: Terminal;
  fitAddon: FitAddon;
}

interface ServerSession {
  id: string;
  cwd: string;
  command: string;
  createdAt: string;
  alive: boolean;
  sessionConfig: {
    type: 'shell' | 'claude';
    projectPath?: string;
    model?: string;
    dangerouslySkipPermissions?: boolean;
  };
}

const MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const XTERM_THEME = {
  background: '#0f0f14',
  foreground: '#e0e0e0',
  cursor: '#7c3aed',
  selectionBackground: '#7c3aed40',
  black: '#1a1a24',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e0e0e0',
  brightBlack: '#4a4a5a',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};

const STORAGE_KEY = 'claudie-terminal-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveSettings(settings: Record<string, unknown>) {
  try {
    const existing = loadSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...settings }));
  } catch {}
}

function makeTerminal(): { term: Terminal; fitAddon: FitAddon } {
  const term = new Terminal({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    theme: XTERM_THEME,
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 5000,
  });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  return { term, fitAddon };
}

export default function TerminalPage() {
  const saved = loadSettings();
  const [projectPath, setProjectPath] = useState<string>(saved.projectPath ?? '');
  const [model, setModel] = useState<string>(saved.model ?? 'claude-sonnet-4-6');
  const [skipPermissions, setSkipPermissions] = useState<boolean>(saved.skipPermissions ?? false);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredSessions, setRestoredSessions] = useState(false);

  const termContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tabsRef = useRef<TerminalTab[]>([]);
  const pendingTabRef = useRef<TerminalTab | null>(null);

  // Persist settings when they change
  useEffect(() => { saveSettings({ projectPath }); }, [projectPath]);
  useEffect(() => { saveSettings({ model }); }, [model]);
  useEffect(() => { saveSettings({ skipPermissions }); }, [skipPermissions]);

  // Keep tabsRef in sync
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  const sendWs = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const mountTerminal = useCallback((term: Terminal, fitAddon: FitAddon) => {
    if (termContainerRef.current) {
      termContainerRef.current.innerHTML = '';
      term.open(termContainerRef.current);
      fitAddon.fit();
      term.focus();
    }
  }, []);

  // Attach to an existing server session (for restore)
  const attachToSession = useCallback((session: ServerSession) => {
    // Don't reattach if we already have this tab
    if (tabsRef.current.find((t) => t.id === session.id)) return;

    const { term, fitAddon } = makeTerminal();
    const tab: TerminalTab = {
      id: session.id,
      active: session.alive,
      terminal: term,
      fitAddon,
    };

    term.onData((data) => {
      sendWs({ type: 'input', id: tab.id, data });
    });

    setTabs((prev) => [...prev, tab]);
    setActiveTabId(session.id);

    // Mount and request attach (server sends scrollback)
    setTimeout(() => {
      mountTerminal(term, fitAddon);
      sendWs({ type: 'attach', id: session.id });
    }, 50);
  }, [sendWs, mountTerminal]);

  // Restore sessions from server on WS connect
  const restoreSessions = useCallback(async () => {
    if (restoredSessions) return;
    try {
      const res = await fetch('/api/terminal/sessions');
      const json = await res.json();
      const sessions: ServerSession[] = json.data || [];
      const alive = sessions.filter((s) => s.alive);
      if (alive.length > 0) {
        // Attach to all alive sessions
        for (const session of alive) {
          attachToSession(session);
        }
        setRestoredSessions(true);
      }
    } catch {
      // Ignore — server might not have sessions
    }
    setRestoredSessions(true);
  }, [restoredSessions, attachToSession]);

  const handleWsMessage = useCallback((msg: { type: string; id?: string; data?: string; code?: number; message?: string }) => {
    if (msg.type === 'created' && msg.id) {
      const pending = pendingTabRef.current;
      if (pending) {
        const oldId = pending.id;
        pending.id = msg.id;
        pendingTabRef.current = null;
        setTabs((prev) =>
          prev.map((t) => (t.id === oldId ? { ...t, id: msg.id! } : t))
        );
        setActiveTabId(msg.id);
      }
    } else if ((msg.type === 'output' || msg.type === 'attached') && msg.id) {
      if (msg.type === 'output') {
        const tab = tabsRef.current.find((t) => t.id === msg.id);
        if (tab) {
          tab.terminal.write(msg.data ?? '');
        }
      }
    } else if (msg.type === 'exit' && msg.id) {
      setTabs((prev) =>
        prev.map((t) => (t.id === msg.id ? { ...t, active: false } : t))
      );
    } else if (msg.type === 'error') {
      setError(msg.message || 'Unknown error');
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      // Restore sessions after WS connects
      restoreSessions();
    };
    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(connectWs, 2000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch {}
    };
  }, [handleWsMessage, restoreSessions]);

  useEffect(() => {
    connectWs();
    return () => { wsRef.current?.close(); };
  }, [connectWs]);

  const launchClaude = () => {
    const { term, fitAddon } = makeTerminal();
    const tempId = `temp-${Date.now()}`;

    const tab: TerminalTab = {
      id: tempId,
      active: true,
      terminal: term,
      fitAddon,
    };

    term.onData((data) => {
      sendWs({ type: 'input', id: tab.id, data });
    });

    pendingTabRef.current = tab;
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tempId);

    setTimeout(() => {
      mountTerminal(term, fitAddon);

      const cols = term.cols;
      const rows = term.rows;

      sendWs({
        type: 'claude',
        options: {
          projectPath: projectPath || undefined,
          dangerouslySkipPermissions: skipPermissions,
          model,
          cols,
          rows,
        },
      });
    }, 50);
  };

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find((t) => t.id === tabId);
    if (tab && termContainerRef.current) {
      mountTerminal(tab.terminal, tab.fitAddon);
      sendWs({ type: 'attach', id: tabId });
    }
  };

  const killTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      tab.terminal.dispose();
      sendWs({ type: 'kill', id: tabId });
    }
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      if (remaining.length > 0) {
        switchTab(remaining[remaining.length - 1].id);
      } else {
        setActiveTabId(null);
        if (termContainerRef.current) termContainerRef.current.innerHTML = '';
      }
    }
  };

  // Handle resize
  useEffect(() => {
    const onResize = () => {
      const tab = tabs.find((t) => t.id === activeTabId);
      if (tab) {
        tab.fitAddon.fit();
        sendWs({ type: 'resize', id: tab.id, cols: tab.terminal.cols, rows: tab.terminal.rows });
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tabs, activeTabId, sendWs]);

  const shortId = (id: string) => id.startsWith('temp-') ? 'new...' : id.slice(0, 8);

  return (
    <div className="flex flex-col h-screen">
      {/* Claude Session Launcher */}
      <div className="bg-surface-800 border-b border-surface-700 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Project path */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-surface-400 mb-1">Project Path</label>
            <div className="relative">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="~/projects/my-app"
                className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500"
              />
            </div>
          </div>

          {/* Model selector */}
          <div className="min-w-[200px]">
            <label className="block text-xs text-surface-400 mb-1">Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full appearance-none bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500 pr-8"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
            </div>
          </div>

          {/* Skip permissions */}
          <label className="flex items-center gap-2 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipPermissions}
              onChange={(e) => setSkipPermissions(e.target.checked)}
              className="w-4 h-4 rounded border-surface-600 bg-surface-900 text-accent-500 focus:ring-accent-500 focus:ring-offset-0"
            />
            <ShieldOff className="w-4 h-4 text-surface-400" />
            <span className="text-xs text-surface-400">Skip Permissions</span>
          </label>

          {/* Launch button */}
          <div className="pb-0.5">
            <button
              onClick={launchClaude}
              disabled={!wsConnected}
              className="flex items-center gap-2 px-5 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Launch Session
            </button>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5 pb-2">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-surface-500">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 bg-[#0f0f14] relative">
        {tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <TerminalSquare className="w-16 h-16 text-surface-700" />
            <p className="text-surface-500 text-sm">
              {restoredSessions
                ? 'Set your project path and click Launch Session'
                : 'Restoring sessions...'}
            </p>
          </div>
        )}
        <div
          ref={termContainerRef}
          className="absolute inset-0"
          style={{ display: tabs.length === 0 ? 'none' : 'block', padding: '4px' }}
        />
      </div>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="bg-surface-800 border-t border-surface-700 flex items-center gap-0.5 px-2 py-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors shrink-0 ${
                activeTabId === tab.id
                  ? 'bg-surface-700 text-white'
                  : 'text-surface-400 hover:text-white hover:bg-surface-700/50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${tab.active ? 'bg-green-500' : 'bg-surface-600'}`} />
              <Sparkles className="w-3 h-3 text-accent-400" />
              <span className="font-mono">{shortId(tab.id)}</span>
              <span className="text-surface-500">Claude</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  killTab(tab.id);
                }}
                className="ml-1 p-0.5 rounded hover:bg-surface-600 text-surface-500 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
