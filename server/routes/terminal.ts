import { Router, Request, Response } from 'express';
import {
  createTerminal,
  listTerminals,
  killTerminal,
} from '../services/terminalManager.js';
import {
  launchClaudeSession,
  detectClaudePath,
  getAvailableModels,
  type ClaudeSessionOptions,
} from '../services/claudeLauncher.js';

const router = Router();

// List all active terminal sessions
router.get('/sessions', (_req: Request, res: Response) => {
  try {
    const sessions = listTerminals();
    res.json({ data: sessions, count: sessions.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list terminal sessions' });
  }
});

// Create a new terminal
router.post('/create', (req: Request, res: Response) => {
  try {
    const { cwd, command, args } = req.body || {};
    const id = createTerminal(undefined, { cwd, command, args });
    res.json({ data: { id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create terminal';
    res.status(500).json({ error: message });
  }
});

// Launch a Claude session
router.post('/claude', (req: Request, res: Response) => {
  try {
    const options: ClaudeSessionOptions = req.body;
    if (!options?.projectPath) {
      res.status(400).json({ error: 'projectPath is required' });
      return;
    }

    const terminalId = createTerminal(undefined, { cwd: options.projectPath });
    const session = launchClaudeSession(terminalId, options);
    res.json({ data: session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to launch Claude session';
    res.status(500).json({ error: message });
  }
});

// Kill a terminal
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const killed = killTerminal(id);
    if (!killed) {
      res.status(404).json({ error: 'Terminal not found' });
      return;
    }
    res.json({ data: { id, killed: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to kill terminal' });
  }
});

// Claude CLI info
router.get('/claude-info', (_req: Request, res: Response) => {
  try {
    const path = detectClaudePath();
    res.json({
      data: {
        installed: !!path,
        path: path || null,
        models: getAvailableModels(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get Claude info' });
  }
});

export default router;
