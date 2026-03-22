import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { readStats } from '../services/statsParser.js';
import { readMcpServers } from '../services/mcpConfigReader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function countJsonArray(filename: string): number {
  try {
    const data = JSON.parse(readFileSync(join(__dirname, '../data', filename), 'utf-8'));
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

function countSkills(): number {
  try {
    const dir = join(homedir(), '.claude', 'commands');
    if (!existsSync(dir)) return 0;
    return readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch { return 0; }
}

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const stats = readStats();
    const mcpServers = readMcpServers();
    res.json({
      data: {
        ...stats,
        tools: countJsonArray('tools.json'),
        skills: countSkills(),
        mcp: mcpServers.length,
        tips: countJsonArray('tips.json'),
        shortcuts: countJsonArray('shortcuts.json'),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read stats' });
  }
});

export default router;
