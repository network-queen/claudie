import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

interface Tip {
  id: string;
  title: string;
  category: string;
  priority: number;
  content: string;
  [key: string]: unknown;
}

function loadTips(): Tip[] {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../data/tips.json'), 'utf-8'));
  } catch {
    return [];
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const tips = loadTips();
    const { category } = _req.query;

    let filtered = tips;

    if (category && typeof category === 'string') {
      filtered = filtered.filter(
        (t) => t.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Sort by priority (higher first)
    filtered.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    res.json({ data: filtered, count: filtered.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tips' });
  }
});

export default router;
