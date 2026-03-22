import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

interface SearchResult {
  id: string;
  name: string;
  description: string;
  section: string;
  link: string;
}

interface SearchGroup {
  section: string;
  results: SearchResult[];
}

function loadJson(file: string): Record<string, unknown>[] {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../data', file), 'utf-8'));
  } catch {
    return [];
  }
}

function matchesQuery(item: Record<string, unknown>, q: string): boolean {
  const searchable = [
    item.name,
    item.title,
    item.description,
    item.content,
    item.keys,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  return searchable.some((s) => s.includes(q));
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const { q } = _req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const query = q.toLowerCase().trim();

    const sections: { file: string; section: string; route: string }[] = [
      { file: 'tools.json', section: 'Tools', route: '/tools' },
      { file: 'skills.json', section: 'Skills', route: '/skills' },
      { file: 'patterns.json', section: 'Patterns', route: '/patterns' },
      { file: 'shortcuts.json', section: 'Shortcuts', route: '/shortcuts' },
      { file: 'tips.json', section: 'Tips', route: '/tips' },
    ];

    const groups: SearchGroup[] = [];

    for (const { file, section, route } of sections) {
      const items = loadJson(file);
      const matched = items.filter((item) => matchesQuery(item, query));

      if (matched.length > 0) {
        groups.push({
          section,
          results: matched.map((item) => ({
            id: String(item.id ?? ''),
            name: String(item.name ?? item.title ?? ''),
            description: String(item.description ?? item.content ?? '').slice(0, 200),
            section,
            link: `${route}/${item.id ?? ''}`,
          })),
        });
      }
    }

    const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0);
    res.json({ data: groups, totalResults });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
