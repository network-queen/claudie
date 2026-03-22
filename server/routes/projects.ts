import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const router = Router();

let activeProject: string | null = null;

function getClaudeProjects(): string[] {
  try {
    const projectsDir = join(homedir(), '.claude', 'projects');
    if (!existsSync(projectsDir)) return [];
    return readdirSync(projectsDir).filter((entry) => {
      try {
        return statSync(join(projectsDir, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function scanCommonDirs(): string[] {
  const dirs: string[] = [];
  const candidates = [
    join(homedir(), 'claudie-projects'),
    join(homedir(), 'projects'),
    join(homedir(), 'Projects'),
    join(homedir(), 'dev'),
    join(homedir(), 'Development'),
    join(homedir(), 'code'),
    join(homedir(), 'Code'),
    join(homedir(), 'repos'),
    join(homedir(), 'workspace'),
  ];

  const seen = new Set<string>();
  for (const dir of candidates) {
    try {
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      const realDir = realpathSync(dir);
      if (seen.has(realDir)) continue;
      seen.add(realDir);
      {
        const entries = readdirSync(realDir);
        for (const entry of entries) {
          const fullPath = join(realDir, entry);
          try {
            if (statSync(fullPath).isDirectory()) {
              dirs.push(fullPath);
            }
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Skip
    }
  }

  return dirs;
}

function getGitInfo(dirPath: string): { isGit: boolean; branch?: string; remote?: string } {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dirPath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    let remote: string | undefined;
    try {
      remote = execSync('git remote get-url origin', {
        cwd: dirPath,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      // No remote
    }

    return { isGit: true, branch, remote };
  } catch {
    return { isGit: false };
  }
}

// List all known projects
router.get('/', (_req: Request, res: Response) => {
  try {
    const claudeProjects = getClaudeProjects();
    const scannedDirs = scanCommonDirs();

    // Claude stores project configs as dash-encoded paths: /Users/foo/bar → -Users-foo-bar
    // Each config dir may also contain a `projectPath` or we can look at the dir structure inside
    // Simpler approach: look for a stored path file, or reconstruct from the CLAUDE.md settings
    const claudeProjectPaths: string[] = [];
    const projectsDir = join(homedir(), '.claude', 'projects');
    for (const encoded of claudeProjects) {
      // Check if there's a stored config that tells us the real path
      const configDir = join(projectsDir, encoded);

      // Try reading any file that might reference the real path
      // The most reliable: the directory name IS the path with / replaced by -
      // We can reconstruct by checking if directories exist along the way
      const parts = encoded.replace(/^-/, '').split('-');

      // Greedy left-to-right: build path trying to match existing dirs
      let resolved = '';
      let remaining = [...parts];
      let found = false;

      while (remaining.length > 0) {
        let matched = false;
        // Try longest possible segment first (handles names with dashes like "claude-projects")
        for (let len = remaining.length; len >= 1; len--) {
          const segment = remaining.slice(0, len).join('-');
          const candidate = resolved + '/' + segment;
          if (existsSync(candidate)) {
            resolved = candidate;
            remaining = remaining.slice(len);
            matched = true;
            break;
          }
        }
        if (!matched) break;
      }

      if (remaining.length === 0 && resolved && existsSync(resolved) && statSync(resolved).isDirectory()) {
        claudeProjectPaths.push(resolved);
      }
    }

    // Deduplicate by real path (macOS is case-insensitive)
    const realPathMap = new Map<string, string>();
    for (const p of [...claudeProjectPaths, ...scannedDirs]) {
      try {
        const real = realpathSync(p);
        if (!realPathMap.has(real)) realPathMap.set(real, p);
      } catch {
        realPathMap.set(p, p);
      }
    }
    const allPaths = new Set(realPathMap.values());

    const projects = Array.from(allPaths).map((dirPath) => {
      const gitInfo = getGitInfo(dirPath);
      const hasClaudeMd = existsSync(join(dirPath, 'CLAUDE.md'));
      let lastModified: string | undefined;
      try { lastModified = statSync(dirPath).mtime.toISOString(); } catch {}

      let commitCount = 0;
      if (gitInfo.isGit) {
        try {
          const count = execSync('git rev-list --count HEAD', {
            cwd: dirPath, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();
          commitCount = parseInt(count, 10) || 0;
        } catch {}
      }

      return {
        name: basename(dirPath),
        path: dirPath,
        hasGit: gitInfo.isGit,
        branch: gitInfo.branch,
        commitCount,
        hasClaudeMd,
        lastModified,
      };
    });

    projects.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    res.json({ data: projects, activeProject, count: projects.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Get project details
router.get('/:encodedPath', (req: Request, res: Response) => {
  try {
    const dirPath = decodeURIComponent(req.params.encodedPath as string);
    if (!existsSync(dirPath)) {
      res.status(404).json({ error: 'Project path not found' });
      return;
    }

    const gitInfo = getGitInfo(dirPath);

    let files: string[] = [];
    try {
      files = readdirSync(dirPath).slice(0, 100);
    } catch {
      // Ignore
    }

    const hasClaudeMd = existsSync(join(dirPath, 'CLAUDE.md'));

    res.json({
      data: {
        path: dirPath,
        name: basename(dirPath),
        git: gitInfo,
        files,
        hasClaudeMd,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get project details' });
  }
});

// Create a new project
router.post('/create', (req: Request, res: Response) => {
  try {
    const { name, parentDir, path: directPath, initGit, createClaudeMd, createGitignore, claudeMdContent } = req.body || {};

    // Support both { name, parentDir } and { path } styles
    let projectPath: string;
    if (directPath) {
      projectPath = directPath.replace(/^~/, homedir());
    } else if (name && parentDir) {
      const resolvedParent = parentDir.replace(/^~/, homedir());
      projectPath = join(resolvedParent, name);
    } else {
      res.status(400).json({ error: 'Either "name" + "parentDir" or "path" is required' });
      return;
    }

    if (!existsSync(projectPath)) {
      mkdirSync(projectPath, { recursive: true });
    }

    if (initGit) {
      try {
        execSync('git init', { cwd: projectPath, timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch {
        // Ignore git init failure
      }
    }

    if (createGitignore) {
      const gitignorePath = join(projectPath, '.gitignore');
      if (!existsSync(gitignorePath)) {
        writeFileSync(gitignorePath, 'node_modules/\ndist/\n.DS_Store\n*.log\n.env\n.env.local\n', 'utf-8');
      }
    }

    // Auto-create GitHub remote if git was initialized
    let remoteUrl: string | null = null;
    if (initGit) {
      const repoName = name || basename(projectPath);
      try {
        // Initial commit so gh repo create works
        execSync('git add -A && git commit -m "Initial commit" --allow-empty', {
          cwd: projectPath, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'], shell: '/bin/sh',
        });
        // Create GitHub repo and set as remote
        const output = execSync(
          `gh repo create "${repoName}" --private --source=. --remote=origin --push 2>&1`,
          { cwd: projectPath, encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        remoteUrl = output.trim();
      } catch (ghErr: any) {
        // gh not installed or auth failed — not critical, continue
        console.log(`[projects] GitHub remote creation skipped: ${ghErr.message?.split('\n')[0] || 'unknown error'}`);
      }
    }

    res.json({ data: { path: projectPath, created: true, remoteUrl } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create project';
    res.status(500).json({ error: message });
  }
});

// Set active project
router.post('/open', (req: Request, res: Response) => {
  try {
    const { path: projectPath } = req.body || {};
    if (!projectPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    if (!existsSync(projectPath)) {
      res.status(404).json({ error: 'Project path not found' });
      return;
    }

    activeProject = projectPath;
    res.json({ data: { activeProject } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open project' });
  }
});

// Clone a project from a git URL
router.post('/clone', (req: Request, res: Response) => {
  try {
    const { url, parentDir } = req.body || {};
    if (!url) { res.status(400).json({ error: 'url is required' }); return; }

    const resolvedParent = (parentDir || '~/claudie-projects').replace(/^~/, homedir());
    if (!existsSync(resolvedParent)) mkdirSync(resolvedParent, { recursive: true });

    // Extract repo name from URL
    const repoName = basename(url).replace(/\.git$/, '');
    const projectPath = join(resolvedParent, repoName);

    if (existsSync(projectPath)) {
      res.status(400).json({ error: `Directory "${repoName}" already exists in ${resolvedParent}` });
      return;
    }

    execSync(`git clone "${url}" "${repoName}"`, {
      cwd: resolvedParent,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    res.json({ data: { path: projectPath, cloned: true } });
  } catch (err: any) {
    const message = err.stderr?.split('\n')[0] || err.message || 'Clone failed';
    res.status(500).json({ error: message });
  }
});

// Delete a project (permanently removes directory)
router.delete('/remove', (req: Request, res: Response) => {
  try {
    const { path: projectPath, deleteFromGit } = req.body || {};
    if (!projectPath || typeof projectPath !== 'string') {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    // Safety: refuse to delete home dir, root, or very short paths
    const resolved = projectPath.replace(/^~/, homedir());
    if (resolved === '/' || resolved === homedir() || resolved.split('/').filter(Boolean).length < 3) {
      res.status(400).json({ error: 'Refusing to delete this path — too broad' });
      return;
    }

    if (!existsSync(resolved)) {
      res.status(404).json({ error: 'Path not found' });
      return;
    }

    // Delete GitHub repo if requested
    if (deleteFromGit) {
      try {
        const remote = execSync('git remote get-url origin', {
          cwd: resolved, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        // Extract owner/repo from URL
        const match = remote.match(/github\.com[/:]([^/]+\/[^/.]+)/);
        if (match) {
          const repo = match[1].replace(/\.git$/, '');
          execSync(`gh repo delete ${repo} --yes`, {
            cwd: resolved, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'],
          });
        }
      } catch (ghErr: any) {
        console.log(`[projects] GitHub repo deletion skipped: ${ghErr.message?.split('\n')[0] || 'unknown'}`);
      }
    }

    rmSync(resolved, { recursive: true, force: true });
    res.json({ data: { path: resolved, removed: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete project';
    res.status(500).json({ error: message });
  }
});

export default router;
