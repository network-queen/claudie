import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const router = Router();

const CLAUDE_DIR = join(homedir(), '.claude');
const CLAUDE_JSON = join(homedir(), '.claude.json');
const SETTINGS_JSON = join(CLAUDE_DIR, 'settings.json');

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJsonSafe(filePath: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  // Validate JSON is parseable before writing
  JSON.parse(json);
  writeFileSync(filePath, json + '\n', 'utf-8');
}

function backupClaudeJson(): void {
  if (existsSync(CLAUDE_JSON)) {
    copyFileSync(CLAUDE_JSON, CLAUDE_JSON + '.bak');
  }
}

// Read settings.json
router.get('/settings', (_req: Request, res: Response) => {
  try {
    const settings = readJsonSafe(SETTINGS_JSON);
    res.json({ data: settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

// Write settings.json
router.put('/settings', (req: Request, res: Response) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Invalid settings object' });
      return;
    }

    // Validate it's valid JSON
    try {
      JSON.stringify(settings);
    } catch {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }

    if (!existsSync(CLAUDE_DIR)) {
      mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    writeJsonSafe(SETTINGS_JSON, settings);
    res.json({ data: { written: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to write settings';
    res.status(500).json({ error: message });
  }
});

const SENSITIVE_KEYS = /token|secret|password|key|auth|credential|pat/i;

function redactEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) return {};
  const redacted: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    redacted[k] = SENSITIVE_KEYS.test(k) ? '***REDACTED***' : v;
  }
  return redacted;
}

// Read MCP config (redacted for display)
router.get('/mcp', (_req: Request, res: Response) => {
  try {
    const config = readJsonSafe(CLAUDE_JSON);
    const mcpServers = (config?.mcpServers || {}) as Record<string, any>;

    // Redact sensitive env vars for display
    const redacted: Record<string, any> = {};
    for (const [name, server] of Object.entries(mcpServers)) {
      redacted[name] = {
        ...server,
        env: redactEnv(server.env),
      };
    }

    res.json({ data: redacted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read MCP config' });
  }
});

// Update MCP servers
router.put('/mcp', (req: Request, res: Response) => {
  try {
    const mcpServers = req.body;
    if (!mcpServers || typeof mcpServers !== 'object') {
      res.status(400).json({ error: 'Invalid MCP servers object' });
      return;
    }

    backupClaudeJson();

    const config = readJsonSafe(CLAUDE_JSON) || {};
    config.mcpServers = mcpServers;
    writeJsonSafe(CLAUDE_JSON, config);

    res.json({ data: { written: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update MCP config';
    res.status(500).json({ error: message });
  }
});

// Add MCP server — accepts { name, command, args, env, type } or { name, config: {...} }
router.post('/mcp/add', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const name = body.name;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    // Build server config from either nested { config } or flat fields
    const serverConfig = body.config || {
      type: body.type || 'stdio',
      command: body.command || '',
      args: body.args || [],
      env: body.env || {},
    };

    backupClaudeJson();

    const config = readJsonSafe(CLAUDE_JSON) || {};
    if (!config.mcpServers) config.mcpServers = {};
    (config.mcpServers as Record<string, unknown>)[name] = serverConfig;
    writeJsonSafe(CLAUDE_JSON, config);

    res.json({ data: { name, added: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add MCP server';
    res.status(500).json({ error: message });
  }
});

// Update a single MCP server
router.put('/mcp/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const body = req.body || {};

    backupClaudeJson();

    const config = readJsonSafe(CLAUDE_JSON) || {};
    if (!config.mcpServers) config.mcpServers = {};

    // Build server config — accept flat fields or nested config
    const serverConfig = body.config || {
      type: body.type || 'stdio',
      command: body.command || '',
      args: body.args || [],
      // Preserve existing env if the incoming env has redacted values
      env: body.env || {},
    };

    // Merge with existing to preserve env vars that were redacted
    const existing = (config.mcpServers as Record<string, any>)[name] || {};
    if (serverConfig.env) {
      const mergedEnv = { ...existing.env };
      for (const [k, v] of Object.entries(serverConfig.env as Record<string, string>)) {
        // Don't overwrite real values with redacted placeholder
        if (v !== '***REDACTED***') {
          mergedEnv[k] = v;
        }
      }
      serverConfig.env = mergedEnv;
    }

    (config.mcpServers as Record<string, unknown>)[name] = serverConfig;
    writeJsonSafe(CLAUDE_JSON, config);

    res.json({ data: { name, updated: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update MCP server';
    res.status(500).json({ error: message });
  }
});

// Remove MCP server
router.delete('/mcp/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    backupClaudeJson();

    const config = readJsonSafe(CLAUDE_JSON) || {};
    if (!config.mcpServers) {
      res.status(404).json({ error: 'No MCP servers configured' });
      return;
    }

    const serverName = name as string;
    const servers = config.mcpServers as Record<string, unknown>;
    if (!(serverName in servers)) {
      res.status(404).json({ error: `MCP server '${serverName}' not found` });
      return;
    }

    delete servers[serverName];
    writeJsonSafe(CLAUDE_JSON, config);

    res.json({ data: { name, removed: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove MCP server';
    res.status(500).json({ error: message });
  }
});

function resolveClaudeMdPath(project: string): string {
  if (project === 'GLOBAL') return join(CLAUDE_DIR, 'CLAUDE.md');
  return join(project.replace(/^~/, homedir()), 'CLAUDE.md');
}

// Read CLAUDE.md
router.get('/claude-md', (req: Request, res: Response) => {
  try {
    const project = req.query.project as string;
    if (!project) {
      res.status(400).json({ error: 'project query param required' });
      return;
    }

    const claudeMdPath = resolveClaudeMdPath(project);
    if (existsSync(claudeMdPath)) {
      const content = readFileSync(claudeMdPath, 'utf-8');
      res.json({ data: { path: claudeMdPath, content } });
    } else {
      res.json({ data: { path: claudeMdPath, content: null } });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read CLAUDE.md' });
  }
});

// Write CLAUDE.md
router.put('/claude-md', (req: Request, res: Response) => {
  try {
    const { project, content } = req.body || {};
    if (!project || content === undefined) {
      res.status(400).json({ error: 'project and content are required' });
      return;
    }

    const claudeMdPath = resolveClaudeMdPath(project);

    // Ensure parent directory exists
    const parentDir = join(claudeMdPath, '..');
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    writeFileSync(claudeMdPath, content, 'utf-8');
    res.json({ data: { path: claudeMdPath, written: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to write CLAUDE.md';
    res.status(500).json({ error: message });
  }
});

// Read memory files
router.get('/memory', (req: Request, res: Response) => {
  try {
    const project = req.query.project as string;
    if (!project) {
      res.status(400).json({ error: 'project query param required' });
      return;
    }

    const memoryDir = join(CLAUDE_DIR, 'projects', encodeURIComponent(project), 'memory');
    if (!existsSync(memoryDir)) {
      res.json({ data: [] });
      return;
    }

    const files = readdirSync(memoryDir).filter((f) => f.endsWith('.md'));
    const memories = files.map((filename) => {
      const content = readFileSync(join(memoryDir, filename), 'utf-8');
      return { filename, content };
    });

    res.json({ data: memories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read memory files' });
  }
});

// Write memory file
router.put('/memory', (req: Request, res: Response) => {
  try {
    const { project, filename, content } = req.body || {};
    if (!project || !filename || content === undefined) {
      res.status(400).json({ error: 'project, filename, and content are required' });
      return;
    }

    const memoryDir = join(CLAUDE_DIR, 'projects', encodeURIComponent(project), 'memory');
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }

    const filePath = join(memoryDir, filename);
    writeFileSync(filePath, content, 'utf-8');
    res.json({ data: { path: filePath, written: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to write memory file';
    res.status(500).json({ error: message });
  }
});

export default router;
