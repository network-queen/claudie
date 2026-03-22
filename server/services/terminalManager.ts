import { spawn, type ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PTY_BRIDGE = join(__dirname, '..', 'pty-bridge.py');

const MAX_SCROLLBACK = 100_000; // chars to keep for reattach

interface TerminalOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SessionConfig {
  type: 'shell' | 'claude';
  projectPath?: string;
  model?: string;
  dangerouslySkipPermissions?: boolean;
}

export interface TerminalMetadata {
  id: string;
  pid: number;
  cwd: string;
  command: string;
  createdAt: string;
  sessionConfig: SessionConfig;
  alive: boolean;
}

interface TerminalEntry {
  process: ChildProcess;
  metadata: TerminalMetadata;
  dataListeners: Array<(data: string) => void>;
  exitListeners: Array<(code: number) => void>;
  scrollback: string;
}

const terminals = new Map<string, TerminalEntry>();

export function createTerminal(id?: string, options: TerminalOptions = {}, sessionConfig?: SessionConfig): string {
  const terminalId = id || randomUUID();
  const {
    cols = 80,
    rows = 24,
    cwd = process.env.HOME || '/tmp',
    command = process.env.SHELL || '/bin/zsh',
    args = [],
    env,
  } = options;

  const shellArgs = args.length > 0 ? args : [command, '-i'];
  const bridgeArgs = [PTY_BRIDGE, String(cols), String(rows), ...shellArgs];

  const child = spawn('python3', bridgeArgs, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...env,
      TERM: 'xterm-256color',
      LANG: process.env.LANG || 'en_US.UTF-8',
    } as Record<string, string>,
  });

  const entry: TerminalEntry = {
    process: child,
    metadata: {
      id: terminalId,
      pid: child.pid || 0,
      cwd,
      command,
      createdAt: new Date().toISOString(),
      sessionConfig: sessionConfig || { type: 'shell' },
      alive: true,
    },
    dataListeners: [],
    exitListeners: [],
    scrollback: '',
  };

  const appendScrollback = (str: string) => {
    entry.scrollback += str;
    if (entry.scrollback.length > MAX_SCROLLBACK) {
      entry.scrollback = entry.scrollback.slice(-MAX_SCROLLBACK);
    }
  };

  child.stdout?.on('data', (data: Buffer) => {
    const str = data.toString();
    appendScrollback(str);
    for (const listener of entry.dataListeners) {
      listener(str);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    const str = data.toString();
    appendScrollback(str);
    for (const listener of entry.dataListeners) {
      listener(str);
    }
  });

  child.on('exit', (code) => {
    entry.metadata.alive = false;
    for (const listener of entry.exitListeners) {
      listener(code ?? 0);
    }
    terminals.delete(terminalId);
  });

  child.on('error', (err) => {
    console.error(`[terminal ${terminalId}] Error:`, err.message);
    entry.metadata.alive = false;
    for (const listener of entry.exitListeners) {
      listener(1);
    }
    terminals.delete(terminalId);
  });

  terminals.set(terminalId, entry);
  return terminalId;
}

export function getTerminal(id: string): TerminalEntry | undefined {
  return terminals.get(id);
}

export function getScrollback(id: string): string {
  return terminals.get(id)?.scrollback ?? '';
}

export function resizeTerminal(id: string, cols: number, rows: number): boolean {
  const entry = terminals.get(id);
  if (!entry || !entry.metadata.alive) return false;
  try {
    entry.process.stdin?.write(`\x1b[R${rows};${cols}`);
    return true;
  } catch {
    return false;
  }
}

export function writeTerminal(id: string, data: string): boolean {
  const entry = terminals.get(id);
  if (!entry || !entry.metadata.alive) return false;
  try {
    entry.process.stdin?.write(data);
    return true;
  } catch {
    return false;
  }
}

export function killTerminal(id: string): boolean {
  const entry = terminals.get(id);
  if (!entry) return false;
  try {
    entry.process.kill('SIGTERM');
  } catch {
    // already dead
  }
  entry.metadata.alive = false;
  terminals.delete(id);
  return true;
}

export function listTerminals(): TerminalMetadata[] {
  return Array.from(terminals.values()).map((entry) => entry.metadata);
}

export function onTerminalData(id: string, listener: (data: string) => void): boolean {
  const entry = terminals.get(id);
  if (!entry) return false;
  entry.dataListeners.push(listener);
  return true;
}

export function offTerminalData(id: string, listener: (data: string) => void): boolean {
  const entry = terminals.get(id);
  if (!entry) return false;
  entry.dataListeners = entry.dataListeners.filter((l) => l !== listener);
  return true;
}

export function onTerminalExit(id: string, listener: (code: number) => void): boolean {
  const entry = terminals.get(id);
  if (!entry) return false;
  entry.exitListeners.push(listener);
  return true;
}
