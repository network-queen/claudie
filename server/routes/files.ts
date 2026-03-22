import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join, relative } from 'path';

const router = Router();

const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.nuxt', '__pycache__', '.venv', 'venv']);

interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

function buildTree(dirPath: string, currentDepth: number, maxDepth: number): TreeEntry[] {
  if (currentDepth >= maxDepth) return [];

  try {
    const entries = readdirSync(dirPath);
    const result: TreeEntry[] = [];

    for (const entry of entries) {
      if (entry.startsWith('.') && entry !== '.env.example') continue;
      if (EXCLUDED_DIRS.has(entry)) continue;

      const fullPath = join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          result.push({
            name: entry,
            path: fullPath,
            type: 'directory',
            children: buildTree(fullPath, currentDepth + 1, maxDepth),
          });
        } else {
          result.push({
            name: entry,
            path: fullPath,
            type: 'file',
          });
        }
      } catch {
        // Skip inaccessible entries
      }
    }

    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

// Directory tree
router.get('/tree', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;
    const depth = parseInt(req.query.depth as string) || 3;
    if (!path) { res.status(400).json({ error: 'path query param required' }); return; }

    if (!existsSync(path)) {
      res.status(404).json({ error: 'Path not found' });
      return;
    }

    const tree = buildTree(path, 0, depth);
    res.json({ data: tree });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build directory tree' });
  }
});

// Read file
router.get('/read', (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json({ error: 'path query param required' }); return; }

    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      res.status(400).json({ error: 'Path is a directory, not a file' });
      return;
    }

    // Limit to 1MB files
    if (stat.size > 1024 * 1024) {
      res.status(400).json({ error: 'File too large (max 1MB)' });
      return;
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const numbered = lines.map((line, i) => `${i + 1}\t${line}`).join('\n');

    res.json({ data: { path: filePath, content, numbered, lineCount: lines.length, size: stat.size } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Write file
router.put('/write', (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body || {};
    if (!filePath || content === undefined) {
      res.status(400).json({ error: 'path and content are required' });
      return;
    }

    writeFileSync(filePath, content, 'utf-8');
    res.json({ data: { path: filePath, written: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to write file';
    res.status(500).json({ error: message });
  }
});

// Create file or directory
router.post('/create', (req: Request, res: Response) => {
  try {
    const { path: targetPath, type } = req.body || {};
    if (!targetPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    if (existsSync(targetPath)) {
      res.status(409).json({ error: 'Path already exists' });
      return;
    }

    if (type === 'directory') {
      mkdirSync(targetPath, { recursive: true });
    } else {
      // Ensure parent directory exists
      const parentDir = join(targetPath, '..');
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      writeFileSync(targetPath, '', 'utf-8');
    }

    res.json({ data: { path: targetPath, type: type || 'file', created: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create';
    res.status(500).json({ error: message });
  }
});

// Delete file or directory
router.delete('/delete', (req: Request, res: Response) => {
  try {
    const targetPath = req.query.path as string;
    if (!targetPath) {
      res.status(400).json({ error: 'path query param required' });
      return;
    }

    if (!existsSync(targetPath)) {
      res.status(404).json({ error: 'Path not found' });
      return;
    }

    const stat = statSync(targetPath);
    if (stat.isDirectory()) {
      rmSync(targetPath, { recursive: true, force: true });
    } else {
      unlinkSync(targetPath);
    }

    res.json({ data: { path: targetPath, deleted: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete';
    res.status(500).json({ error: message });
  }
});

export default router;
