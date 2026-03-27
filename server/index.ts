import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';

import toolsRouter from './routes/tools.js';
import skillsRouter from './routes/commands.js';
import shortcutsRouter from './routes/shortcuts.js';
import patternsRouter from './routes/patterns.js';
import tipsRouter from './routes/tips.js';
import configRouter from './routes/config.js';
import mcpRouter from './routes/mcp.js';
import statsRouter from './routes/stats.js';
import searchRouter from './routes/search.js';
import terminalRouter from './routes/terminal.js';
import projectsRouter from './routes/projects.js';
import gitRouter from './routes/git.js';
import filesRouter from './routes/files.js';
import configEditorRouter from './routes/configEditor.js';
import tasksRouter from './routes/tasks.js';
import claudeChatRouter from './routes/claudeChat.js';
import telegramRouter from './routes/telegram.js';

import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  listTerminals,
  onTerminalData,
  offTerminalData,
  onTerminalExit,
  getScrollback,
} from './services/terminalManager.js';
import { launchClaudeSession, type ClaudeSessionOptions } from './services/claudeLauncher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const isDev = process.env.NODE_ENV !== 'production';

// CORS for dev mode
if (isDev) {
  app.use(cors());
}

app.use(express.json());

// Log API requests in dev mode
if (isDev) {
  app.use('/api', (req, _res, next) => {
    console.log(`[API] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// API routes
app.use('/api/tools', toolsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/shortcuts', shortcutsRouter);
app.use('/api/patterns', patternsRouter);
app.use('/api/tips', tipsRouter);
app.use('/api/config', configRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/stats', statsRouter);
app.use('/api/search', searchRouter);
app.use('/api/terminal', terminalRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/git', gitRouter);
app.use('/api/files', filesRouter);
app.use('/api/config-editor', configEditorRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/claude', claudeChatRouter);
app.use('/api/telegram', telegramRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production: serve static files with SPA fallback
if (!isDev) {
  const distDir = join(__dirname, '..', 'dist');
  app.use(express.static(distDir));

  app.get('*', (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const { pathname } = parseUrl(request.url || '');

    if (pathname === '/ws/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    // Track which terminals this connection is attached to for cleanup
    const attachedListeners = new Map<string, { data: (d: string) => void; exit: (c: number) => void }>();

    function send(msg: Record<string, unknown>): void {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    function attachToTerminal(id: string): void {
      // Don't double-attach
      if (attachedListeners.has(id)) return;

      const dataListener = (data: string) => {
        send({ type: 'output', id, data });
      };

      const exitListener = (code: number) => {
        send({ type: 'exit', id, code });
        attachedListeners.delete(id);
      };

      const dataOk = onTerminalData(id, dataListener);
      const exitOk = onTerminalExit(id, exitListener);

      if (dataOk && exitOk) {
        attachedListeners.set(id, { data: dataListener, exit: exitListener });
      }
    }

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send({ type: 'error', message: 'Invalid JSON' });
        return;
      }

      const { type } = msg;

      try {
        switch (type) {
          case 'create': {
            const options = (msg.options || {}) as Record<string, unknown>;
            const id = createTerminal(undefined, {
              cols: (options.cols as number) || 80,
              rows: (options.rows as number) || 24,
              cwd: (options.cwd as string) || undefined,
              command: (options.command as string) || undefined,
              args: (options.args as string[]) || undefined,
              env: (options.env as Record<string, string>) || undefined,
            }, { type: 'shell', projectPath: (options.cwd as string) || undefined });
            attachToTerminal(id);
            send({ type: 'created', id });
            break;
          }

          case 'attach': {
            const id = msg.id as string;
            if (!id) { send({ type: 'error', message: 'id required' }); break; }
            attachToTerminal(id);
            // Send buffered scrollback so the user sees previous output
            const scrollback = getScrollback(id);
            if (scrollback) {
              send({ type: 'output', id, data: scrollback });
            }
            send({ type: 'attached', id });
            break;
          }

          case 'input': {
            const id = msg.id as string;
            const data = msg.data as string;
            if (!id || data === undefined) { send({ type: 'error', message: 'id and data required' }); break; }
            const ok = writeTerminal(id, data);
            if (!ok) send({ type: 'error', message: `Terminal ${id} not found` });
            break;
          }

          case 'resize': {
            const id = msg.id as string;
            const cols = msg.cols as number;
            const rows = msg.rows as number;
            if (!id || !cols || !rows) { send({ type: 'error', message: 'id, cols, rows required' }); break; }
            const ok = resizeTerminal(id, cols, rows);
            if (!ok) send({ type: 'error', message: `Terminal ${id} not found` });
            break;
          }

          case 'kill': {
            const id = msg.id as string;
            if (!id) { send({ type: 'error', message: 'id required' }); break; }
            const ok = killTerminal(id);
            if (!ok) send({ type: 'error', message: `Terminal ${id} not found` });
            else send({ type: 'killed', id });
            break;
          }

          case 'claude': {
            const rawOpts = (msg.options || {}) as Record<string, unknown>;
            const options: ClaudeSessionOptions = {
              projectPath: (rawOpts.projectPath as string) || process.env.HOME || '/tmp',
              dangerouslySkipPermissions: rawOpts.dangerouslySkipPermissions as boolean,
              model: rawOpts.model as string,
            };
            const id = createTerminal(undefined, {
              cwd: options.projectPath,
              cols: (rawOpts.cols as number) || 80,
              rows: (rawOpts.rows as number) || 24,
            }, {
              type: 'claude',
              projectPath: options.projectPath,
              model: options.model,
              dangerouslySkipPermissions: options.dangerouslySkipPermissions,
            });
            attachToTerminal(id);

            // Watch terminal output for trust prompt and auto-confirm
            let trustHandled = false;
            const trustWatcher = (data: string) => {
              if (trustHandled) return;
              // Claude shows "Do you trust" or "Trust" prompt — auto-confirm with Enter
              if (data.includes('trust') || data.includes('Trust') || data.includes('TRUST')) {
                trustHandled = true;
                // Send Enter to confirm the default "Yes" option
                setTimeout(() => writeTerminal(id, '\r'), 300);
              }
            };
            onTerminalData(id, trustWatcher);
            // Remove watcher after 15s
            setTimeout(() => offTerminalData(id, trustWatcher), 15000);

            // Small delay to let shell initialize before sending claude command
            setTimeout(() => {
              try {
                const session = launchClaudeSession(id, options);
                send({ type: 'session', id, session });
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Failed to launch Claude';
                send({ type: 'error', message: errMsg });
              }
            }, 300);
            send({ type: 'created', id });
            break;
          }

          case 'list': {
            const terminals = listTerminals();
            send({ type: 'terminals', data: terminals });
            break;
          }

          default:
            send({ type: 'error', message: `Unknown message type: ${type}` });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send({ type: 'error', message });
      }
    });

    // On WebSocket close, clean up listeners but do NOT kill terminals (allow reattach)
    ws.on('close', () => {
      for (const [id, listeners] of attachedListeners) {
        offTerminalData(id, listeners.data);
        // Note: we don't remove exit listeners since the terminal may still exit
      }
      attachedListeners.clear();
    });
  });
}

export function startServer(port: number): Server {
  const httpServer = createServer(app);

  setupWebSocket(httpServer);

  httpServer.listen(port, '127.0.0.1', () => {
    console.log(`Claudie server running at http://localhost:${port}`);
    if (isDev) {
      console.log('Running in development mode');
    }
    console.log(`WebSocket terminal available at ws://localhost:${port}/ws/terminal`);
  });

  return httpServer;
}

// Auto-start when run directly (not imported by cli.js)
if (!process.env.CLAWDIE_CLI) {
  const DEFAULT_PORT = parseInt(process.env.PORT || '3434', 10);
  startServer(DEFAULT_PORT);
}
