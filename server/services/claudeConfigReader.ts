import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = join(homedir(), '.claude');
const CLAUDE_JSON = join(homedir(), '.claude.json');

const SENSITIVE_KEYWORDS = ['TOKEN', 'SECRET', 'PASSWORD', 'KEY', 'API'];

function isSensitive(key: string): boolean {
  const upper = key.toUpperCase();
  return SENSITIVE_KEYWORDS.some((kw) => upper.includes(kw));
}

function filterSensitiveEnv(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && isSensitive(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = filterSensitiveEnv(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readSettings(): {
  settings: Record<string, unknown> | null;
  localSettings: Record<string, unknown> | null;
} {
  const settings = readJsonSafe(join(CLAUDE_DIR, 'settings.json'));
  const localSettings = readJsonSafe(join(CLAUDE_DIR, 'settings.local.json'));
  return { settings, localSettings };
}

export function readGlobalConfig(): Record<string, unknown> | null {
  try {
    const raw = readFileSync(CLAUDE_JSON, 'utf-8');
    const config = JSON.parse(raw);
    return filterSensitiveEnv(config);
  } catch {
    return null;
  }
}

export function readProjects(): string[] {
  try {
    const projectsDir = join(CLAUDE_DIR, 'projects');
    const entries = readdirSync(projectsDir);
    return entries.filter((entry) => {
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
