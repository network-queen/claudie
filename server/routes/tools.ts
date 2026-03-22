import { Router, Request, Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

interface Tool {
  id: string;
  name: string;
  category: string;
  description: string;
  [key: string]: unknown;
}

function loadTools(): Tool[] {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../data/tools.json'), 'utf-8'));
  } catch {
    return [];
  }
}

function loadToolUsage(): Record<string, { usageCount: number; lastUsedAt: number }> {
  try {
    const claudeJson = join(homedir(), '.claude.json');
    if (!existsSync(claudeJson)) return {};
    const data = JSON.parse(readFileSync(claudeJson, 'utf-8'));
    return data.toolUsage || {};
  } catch {
    return {};
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const tools = loadTools();
    const { search, category } = _req.query;

    let filtered = tools;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    if (category && typeof category === 'string') {
      filtered = filtered.filter(
        (t) => t.category.toLowerCase() === category.toLowerCase()
      );
    }

    const usage = loadToolUsage();
    const withUsage = filtered.map((t) => {
      const u = usage[t.name] || usage[t.id] || null;
      return { ...t, usageCount: u?.usageCount || 0, lastUsedAt: u?.lastUsedAt || null };
    });
    // Sort by usage count descending by default
    withUsage.sort((a, b) => b.usageCount - a.usageCount);
    res.json({ data: withUsage, count: withUsage.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tools' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const tools = loadTools();
    const tool = tools.find((t) => t.id === req.params.id);

    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    res.json({ data: tool });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tool' });
  }
});

export default router;
