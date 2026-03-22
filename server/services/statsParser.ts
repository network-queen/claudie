import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = join(homedir(), '.claude');

export interface DashboardStats {
  totalSessions: number;
  totalMessages: number;
  modelUsage: Record<string, number>;
  dailyActivity: Record<string, number>;
}

const EMPTY_STATS: DashboardStats = {
  totalSessions: 0,
  totalMessages: 0,
  modelUsage: {},
  dailyActivity: {},
};

export function readStats(): DashboardStats {
  const possiblePaths = [
    join(CLAUDE_DIR, 'statsCache.json'),
    join(CLAUDE_DIR, 'stats.json'),
    join(CLAUDE_DIR, 'analytics.json'),
  ];

  for (const filePath of possiblePaths) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);

      return {
        totalSessions: data.totalSessions ?? data.sessions ?? 0,
        totalMessages: data.totalMessages ?? data.messages ?? 0,
        modelUsage: data.modelUsage ?? data.models ?? {},
        dailyActivity: data.dailyActivity ?? data.daily ?? {},
      };
    } catch {
      // Try next path
    }
  }

  return { ...EMPTY_STATS };
}
