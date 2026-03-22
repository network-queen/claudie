import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

interface Shortcut {
  id: string;
  name: string;
  keys: string;
  context: string;
  description: string;
  [key: string]: unknown;
}

function loadShortcuts(): Shortcut[] {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../data/shortcuts.json'), 'utf-8'));
  } catch {
    return [];
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const shortcuts = loadShortcuts();
    const { search, context } = _req.query;

    let filtered = shortcuts;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.keys.toLowerCase().includes(q)
      );
    }

    if (context && typeof context === 'string') {
      filtered = filtered.filter(
        (s) => s.context.toLowerCase() === context.toLowerCase()
      );
    }

    res.json({ data: filtered, count: filtered.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load shortcuts' });
  }
});

export default router;
