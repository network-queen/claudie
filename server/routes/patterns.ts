import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

interface Pattern {
  id: string;
  name: string;
  category: string;
  description: string;
  [key: string]: unknown;
}

function loadPatterns(): Pattern[] {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../data/patterns.json'), 'utf-8'));
  } catch {
    return [];
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const patterns = loadPatterns();
    const { search, category } = _req.query;

    let filtered = patterns;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    if (category && typeof category === 'string') {
      filtered = filtered.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase()
      );
    }

    res.json({ data: filtered, count: filtered.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load patterns' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const patterns = loadPatterns();
    const pattern = patterns.find((p) => p.id === req.params.id);

    if (!pattern) {
      res.status(404).json({ error: 'Pattern not found' });
      return;
    }

    res.json({ data: pattern });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load pattern' });
  }
});

export default router;
