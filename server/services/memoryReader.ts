import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import matter from 'gray-matter';

const CLAUDE_DIR = join(homedir(), '.claude');

export interface MemoryEntry {
  name: string;
  description: string;
  type: string;
  content: string;
}

export interface ProjectMemory {
  projectPath: string;
  memories: MemoryEntry[];
}

function parseMemoryIndex(content: string, memoryDir: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const description = match[1];
    const linkedFile = match[2];

    if (!linkedFile.endsWith('.md')) continue;

    const filePath = join(memoryDir, linkedFile);
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const parsed = matter(raw);

      entries.push({
        name: linkedFile.replace('.md', ''),
        description,
        type: (parsed.data.type as string) || 'note',
        content: parsed.content.trim(),
      });
    } catch {
      entries.push({
        name: linkedFile.replace('.md', ''),
        description,
        type: 'note',
        content: '',
      });
    }
  }

  return entries;
}

export function readAllMemory(): ProjectMemory[] {
  const results: ProjectMemory[] = [];

  try {
    const projectsDir = join(CLAUDE_DIR, 'projects');
    const projects = readdirSync(projectsDir);

    for (const project of projects) {
      const projectDir = join(projectsDir, project);

      try {
        if (!statSync(projectDir).isDirectory()) continue;
      } catch {
        continue;
      }

      const memoryDir = join(projectDir, 'memory');
      const memoryIndex = join(memoryDir, 'MEMORY.md');

      if (!existsSync(memoryIndex)) continue;

      try {
        const indexContent = readFileSync(memoryIndex, 'utf-8');
        const memories = parseMemoryIndex(indexContent, memoryDir);

        results.push({
          projectPath: project,
          memories,
        });
      } catch {
        // Skip projects with unreadable memory files
      }
    }
  } catch {
    // ~/.claude/projects doesn't exist or isn't readable
  }

  return results;
}
