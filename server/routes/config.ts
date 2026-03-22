import { Router, Request, Response } from 'express';
import { readSettings, readGlobalConfig, readProjects } from '../services/claudeConfigReader.js';
import { readAllMemory } from '../services/memoryReader.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const router = Router();

router.get('/settings', (_req: Request, res: Response) => {
  try {
    const { settings, localSettings } = readSettings();
    const globalConfig = readGlobalConfig();
    const projects = readProjects();

    res.json({
      data: {
        settings,
        localSettings,
        globalConfig,
        projects,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

router.get('/memory', (_req: Request, res: Response) => {
  try {
    const memories = readAllMemory();
    res.json({ data: memories, count: memories.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read memory' });
  }
});

router.get('/claude-md', (_req: Request, res: Response) => {
  try {
    // Scan actual project directories for CLAUDE.md files
    // Use the same project resolution as the projects route
    const projectsDir = join(homedir(), '.claude', 'projects');
    const results: { project: string; path: string; content: string }[] = [];

    if (existsSync(projectsDir)) {
      const entries = readdirSync(projectsDir).filter((e) => {
        try { return statSync(join(projectsDir, e)).isDirectory(); } catch { return false; }
      });

      for (const encoded of entries) {
        // Resolve dash-encoded path to real filesystem path
        const parts = encoded.replace(/^-/, '').split('-');
        let resolved = '';
        const remaining = [...parts];
        while (remaining.length > 0) {
          let matched = false;
          for (let len = remaining.length; len >= 1; len--) {
            const segment = remaining.slice(0, len).join('-');
            const candidate = resolved + '/' + segment;
            if (existsSync(candidate)) {
              resolved = candidate;
              remaining.splice(0, len);
              matched = true;
              break;
            }
          }
          if (!matched) break;
        }

        if (resolved && remaining.length === 0 && existsSync(resolved)) {
          const claudeMdPath = join(resolved, 'CLAUDE.md');
          if (existsSync(claudeMdPath)) {
            try {
              const content = readFileSync(claudeMdPath, 'utf-8');
              results.push({ project: resolved, path: claudeMdPath, content });
            } catch {}
          }
        }
      }
    }

    // Also check for global CLAUDE.md at ~/.claude/CLAUDE.md
    const globalPath = join(homedir(), '.claude', 'CLAUDE.md');
    if (existsSync(globalPath)) {
      try {
        const content = readFileSync(globalPath, 'utf-8');
        results.unshift({ project: '~/.claude (Global)', path: globalPath, content });
      } catch {}
    }

    res.json({ data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read CLAUDE.md files' });
  }
});

export default router;
