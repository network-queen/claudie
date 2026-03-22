import { Router, Request, Response } from 'express';
import { execSync, execFileSync } from 'child_process';

const router = Router();

function detectClaudePath(): string | null {
  try { return execSync('which claude', { encoding: 'utf-8', timeout: 5000 }).trim(); }
  catch { return null; }
}

// Non-interactive Claude prompt — pipes prompt via stdin, no shell escaping issues
router.post('/ask', (req: Request, res: Response) => {
  try {
    const { prompt, model } = req.body || {};
    if (!prompt) { res.status(400).json({ error: 'prompt required' }); return; }

    const claudePath = detectClaudePath();
    if (!claudePath) { res.status(500).json({ error: 'Claude CLI not found' }); return; }

    const args = ['-p', prompt];
    if (model) { args.push('--model', model); }

    console.log(`[claude/ask] Running: ${claudePath} -p "<${prompt.length} chars>"`);
    const output = execFileSync(claudePath, args, {
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, TERM: 'dumb' },
    }).trim();

    console.log(`[claude/ask] Response: ${output.length} chars`);
    res.json({ data: { response: output } });
  } catch (err: any) {
    const stderr = err.stderr?.toString().slice(0, 300) || '';
    const message = stderr || err.message || 'Claude request failed';
    res.json({ data: { response: `(Claude could not respond: ${message.slice(0, 100)})` } });
  }
});

export default router;
