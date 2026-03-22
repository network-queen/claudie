import { execSync } from 'child_process';
import { writeTerminal } from './terminalManager.js';

export interface ClaudeSessionOptions {
  projectPath: string;
  dangerouslySkipPermissions?: boolean;
  model?: string;
  systemPrompt?: string;
  allowedTools?: string[];
  maxTokens?: number;
}

interface ClaudeSessionInfo {
  terminalId: string;
  command: string;
  projectPath: string;
  model?: string;
}

const KNOWN_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

export function launchClaudeSession(terminalId: string, options: ClaudeSessionOptions): ClaudeSessionInfo {
  const claudePath = detectClaudePath();
  if (!claudePath) {
    throw new Error('Claude CLI not found. Make sure it is installed and in your PATH.');
  }

  const parts: string[] = [claudePath];

  if (options.dangerouslySkipPermissions) {
    parts.push('--dangerously-skip-permissions');
  }

  if (options.model) {
    parts.push('--model', options.model);
  }

  // Always commit to feature branch after completing work
  const systemPrompt = [
    options.systemPrompt || '',
    'RULE: After completing each task or prompt, always commit all changes to the current feature branch with a descriptive commit message. Never commit directly to master or main.',
  ].filter(Boolean).join('\n');
  parts.push('--system-prompt', `"${systemPrompt.replace(/"/g, '\\"')}"`);

  if (options.allowedTools && options.allowedTools.length > 0) {
    for (const tool of options.allowedTools) {
      parts.push('--allowedTools', tool);
    }
  }

  if (options.maxTokens) {
    parts.push('--max-tokens', String(options.maxTokens));
  }

  const command = parts.join(' ');

  // Send the command to the terminal followed by Enter
  writeTerminal(terminalId, command + '\n');

  return {
    terminalId,
    command,
    projectPath: options.projectPath,
    model: options.model,
  };
}

export function getAvailableModels(): string[] {
  return [...KNOWN_MODELS];
}

export function detectClaudePath(): string | null {
  const commonPaths = [
    'claude',
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    `${process.env.HOME}/.npm-global/bin/claude`,
    `${process.env.HOME}/.local/bin/claude`,
  ];

  // Try `which claude` first
  try {
    const result = execSync('which claude', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (result) return result;
  } catch {
    // Ignore
  }

  // Try common paths
  for (const p of commonPaths) {
    try {
      execSync(`command -v ${p}`, { encoding: 'utf-8', timeout: 3000 });
      return p;
    } catch {
      // Continue
    }
  }

  return null;
}
