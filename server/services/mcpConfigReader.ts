import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_JSON = join(homedir(), '.claude.json');

const SENSITIVE_KEYWORDS = ['TOKEN', 'SECRET', 'PASSWORD', 'KEY', 'API'];

function isSensitive(key: string): boolean {
  const upper = key.toUpperCase();
  return SENSITIVE_KEYWORDS.some((kw) => upper.includes(kw));
}

function redactEnv(env: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!env) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    result[key] = isSensitive(key) ? '[REDACTED]' : value;
  }
  return result;
}

export interface McpServer {
  name: string;
  type: 'stdio' | 'sse' | 'unknown';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export function readMcpServers(): McpServer[] {
  try {
    const raw = readFileSync(CLAUDE_JSON, 'utf-8');
    const config = JSON.parse(raw);
    const mcpServers = config.mcpServers;

    if (!mcpServers || typeof mcpServers !== 'object') {
      return [];
    }

    return Object.entries(mcpServers).map(([name, serverConfig]) => {
      const cfg = serverConfig as Record<string, unknown>;

      let type: McpServer['type'] = 'unknown';
      if (cfg.command) type = 'stdio';
      else if (cfg.url) type = 'sse';

      return {
        name,
        type,
        command: cfg.command as string | undefined,
        args: cfg.args as string[] | undefined,
        url: cfg.url as string | undefined,
        env: redactEnv(cfg.env as Record<string, string> | undefined),
      };
    });
  } catch {
    return [];
  }
}
