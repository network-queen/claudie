import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';

const router = Router();

function runGit(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: any) {
    // Return empty string for expected failures (e.g. no commits yet)
    if (err.stderr?.includes('does not have any commits') || err.stderr?.includes('bad default revision')) {
      return '';
    }
    throw err;
  }
}

// Git status
router.get('/status', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;
    if (!path) { res.status(400).json({ error: 'path query param required' }); return; }

    let branch = 'unknown';
    try { branch = runGit('branch --show-current', path) || 'master'; } catch {}
    let remote = '';
    try { remote = runGit('remote get-url origin', path); } catch {}
    const porcelain = runGit('status --porcelain', path);
    const lines = porcelain ? porcelain.split('\n') : [];

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      const x = line[0];
      const y = line[1];
      const file = line.substring(3);

      if (x === '?') {
        untracked.push(file);
      } else {
        if (x !== ' ' && x !== '?') staged.push(file);
        if (y !== ' ' && y !== '?') unstaged.push(file);
      }
    }

    res.json({ data: { branch, remote, staged, unstaged, untracked } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git status failed';
    res.status(500).json({ error: message });
  }
});

// Git branches
router.get('/branches', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;
    if (!path) { res.status(400).json({ error: 'path query param required' }); return; }

    const output = runGit('branch -a', path);
    const lines = output ? output.split('\n') : [];

    const branches = lines.map((line) => {
      const isCurrent = line.startsWith('*');
      const name = line.replace(/^\*?\s+/, '').trim();
      return { name, current: isCurrent };
    });

    res.json({ data: branches });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git branches failed';
    res.status(500).json({ error: message });
  }
});

// Git log
router.get('/log', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;
    const limit = parseInt(req.query.limit as string) || 20;
    if (!path) { res.status(400).json({ error: 'path query param required' }); return; }

    const format = '%H%n%s%n%an%n%aI';
    const output = runGit(`log --format="${format}" -n ${limit}`, path);

    if (!output) {
      res.json({ data: [] });
      return;
    }

    const lines = output.split('\n');
    const commits = [];
    for (let i = 0; i + 3 < lines.length; i += 4) {
      commits.push({
        hash: lines[i],
        message: lines[i + 1],
        author: lines[i + 2],
        date: lines[i + 3],
      });
    }

    res.json({ data: commits });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git log failed';
    res.status(500).json({ error: message });
  }
});

// Git diff
router.get('/diff', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;
    const file = req.query.file as string;
    if (!path) { res.status(400).json({ error: 'path query param required' }); return; }

    const commit = req.query.commit as string;
    const fileArg = file ? ` -- ${file}` : '';

    if (commit) {
      // Show diff for a specific commit
      const commitDiff = runGit(`show --format="" --patch ${commit}`, path);
      res.json({ data: { commit: commitDiff } });
      return;
    }

    const stagedDiff = runGit(`diff --cached${fileArg}`, path);
    const unstagedDiff = runGit(`diff${fileArg}`, path);

    res.json({ data: { staged: stagedDiff, unstaged: unstagedDiff } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git diff failed';
    res.status(500).json({ error: message });
  }
});

// Stage files
router.post('/stage', (req: Request, res: Response) => {
  try {
    const { path, files } = req.body || {};
    if (!path || !files?.length) {
      res.status(400).json({ error: 'path and files are required' });
      return;
    }

    const fileArgs = files.map((f: string) => `"${f}"`).join(' ');
    runGit(`add ${fileArgs}`, path);
    res.json({ data: { staged: files } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git stage failed';
    res.status(500).json({ error: message });
  }
});

// Unstage files
router.post('/unstage', (req: Request, res: Response) => {
  try {
    const { path, files } = req.body || {};
    if (!path || !files?.length) {
      res.status(400).json({ error: 'path and files are required' });
      return;
    }

    const fileArgs = files.map((f: string) => `"${f}"`).join(' ');
    runGit(`reset HEAD ${fileArgs}`, path);
    res.json({ data: { unstaged: files } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git unstage failed';
    res.status(500).json({ error: message });
  }
});

// Create commit
router.post('/commit', (req: Request, res: Response) => {
  try {
    const { path, message } = req.body || {};
    if (!path || !message) {
      res.status(400).json({ error: 'path and message are required' });
      return;
    }

    const escapedMessage = message.replace(/"/g, '\\"');
    const output = runGit(`commit -m "${escapedMessage}"`, path);
    res.json({ data: { output } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git commit failed';
    res.status(500).json({ error: message });
  }
});

// Checkout branch
router.post('/checkout', (req: Request, res: Response) => {
  try {
    const { path, branch } = req.body || {};
    if (!path || !branch) {
      res.status(400).json({ error: 'path and branch are required' });
      return;
    }

    const output = runGit(`checkout ${branch}`, path);
    res.json({ data: { output, branch } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git checkout failed';
    res.status(500).json({ error: message });
  }
});

// List stashes
router.get('/stash', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;
    if (!path) { res.status(400).json({ error: 'path query param required' }); return; }

    const output = runGit('stash list', path);
    const stashes = output ? output.split('\n').map((line) => line.trim()).filter(Boolean) : [];
    res.json({ data: stashes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git stash list failed';
    res.status(500).json({ error: message });
  }
});

// Git reset --hard to a specific commit
router.post('/reset', (req: Request, res: Response) => {
  try {
    const { path, hash } = req.body || {};
    if (!path || !hash) { res.status(400).json({ error: 'path and hash required' }); return; }
    const output = runGit(`reset --hard ${hash}`, path);
    res.json({ data: { output, hash } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Git reset failed';
    res.status(500).json({ error: message });
  }
});

// Get repo visibility
router.get('/visibility', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;
    if (!path) { res.status(400).json({ error: 'path required' }); return; }
    const output = execSync('gh repo view --json visibility -q .visibility', {
      cwd: path, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    res.json({ data: { visibility: output.toLowerCase() } });
  } catch {
    res.json({ data: { visibility: null } });
  }
});

// Toggle repo visibility
router.post('/visibility', (req: Request, res: Response) => {
  try {
    const { path: projectPath, visibility } = req.body || {};
    if (!projectPath || !visibility) { res.status(400).json({ error: 'path and visibility required' }); return; }
    if (visibility !== 'public' && visibility !== 'private') { res.status(400).json({ error: 'visibility must be public or private' }); return; }
    execSync(`gh repo edit --visibility ${visibility} --accept-visibility-change-consequences`, {
      cwd: projectPath, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    res.json({ data: { visibility } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to change visibility';
    res.status(500).json({ error: message });
  }
});

export default router;
