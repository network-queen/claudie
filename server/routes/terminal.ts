import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import {
  createTerminal,
  listTerminals,
  killTerminal,
  getScrollback,
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

// Get last N lines of terminal output (for waiting context)
router.get('/scrollback-tail', (req: Request, res: Response) => {
  try {
    const sessions = listTerminals();
    const projectPath = req.query.path as string;
    const lines = parseInt(req.query.lines as string) || 30;

    // Find terminal for this project
    const session = sessions.find((s) => s.alive && s.sessionConfig?.projectPath === projectPath);
    if (!session) {
      res.json({ data: { lines: [] } });
      return;
    }

    const scrollback = getScrollback(session.id);
    // Strip all terminal escape sequences
    const clean = scrollback
      // OSC sequences: \x1b] ... (terminated by BEL \x07 or ST \x1b\\)
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      // CSI sequences: \x1b[ ... letter
      .replace(/\x1b\[[0-9;?]*[a-zA-Z$]/g, '')
      // Other escape sequences: \x1b followed by single char or >...
      .replace(/\x1b[><=()][^\x1b]*/g, '')
      .replace(/\x1b[a-zA-Z]/g, '')
      // Remaining control chars
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .replace(/\r/g, '')
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) =>
        l.length > 0 &&
        // Filter spinner lines
        !l.match(/^(◐|◑|◒|◓|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|●)/) &&
        // Filter shell init noise
        !l.match(/^(Restored session|The operation couldn|Please visit http|%\s*$)/) &&
        // Filter opencode init sequences (pppp, raw escape leftovers)
        !l.match(/^[p\s]*$/) &&
        !l.match(/^\]/) &&
        // Filter bare command invocations
        !l.match(/^\/?\/usr\/local\/bin\/(opencode|claude)/)
      );
    const tail = clean.slice(-lines);
    res.json({ data: { lines: tail } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get scrollback' });
  }
});

// Claude CLI info
router.get('/claude-info', (_req: Request, res: Response) => {
  try {
    const claudePath = detectClaudePath();
    let claudeVersion = '';
    if (claudePath) {
      try { claudeVersion = execSync(`${claudePath} --version 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 }).trim(); } catch {}
    }

    let opencodePath: string | null = null;
    let opencodeVersion = '';
    try { opencodePath = execSync('which opencode', { encoding: 'utf-8', timeout: 5000 }).trim() || null; } catch {}
    if (opencodePath) {
      try { opencodeVersion = execSync('opencode --version 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim(); } catch {}
    }

    let opencodeModels: string[] = [];
    if (opencodePath) {
      try { opencodeModels = execSync('opencode models 2>/dev/null', { encoding: 'utf-8', timeout: 10000 }).trim().split('\n').filter(Boolean); } catch {}
    }

    res.json({
      data: {
        claude: {
          installed: !!claudePath,
          path: claudePath,
          version: claudeVersion,
          models: getAvailableModels(),
        },
        opencode: {
          installed: !!opencodePath,
          path: opencodePath,
          version: opencodeVersion,
          models: opencodeModels,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tools info' });
  }
});

export default router;
