import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const CONFIG_FILE = join(homedir(), '.claude', 'claudie-telegram.json');

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

let config: TelegramConfig = { botToken: '', chatId: '', enabled: false };
let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastUpdateId = 0;
let activeProject = '';

export function setActiveProject(path: string) { activeProject = path; }
export function getActiveProject() { return activeProject; }

// Terminal integration — set by server/index.ts
let sendToTerminal: ((projectPath: string, text: string) => boolean) | null = null;
export function setTerminalSender(fn: (projectPath: string, text: string) => boolean) { sendToTerminal = fn; }

export function loadTelegramConfig(): TelegramConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return config;
}

export function saveTelegramConfig(cfg: TelegramConfig) {
  config = cfg;
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  if (cfg.enabled && cfg.botToken && cfg.chatId) {
    startPolling();
  } else {
    stopPolling();
  }
}

export function getTelegramConfig(): TelegramConfig {
  return config;
}

async function apiCall(method: string, body?: object): Promise<any> {
  if (!config.botToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.log('[telegram] API error:', (err as Error).message);
    return null;
  }
}

export async function sendTelegramMessage(text: string, chatId?: string) {
  if (!config.enabled || !config.botToken) return;
  const target = chatId || config.chatId;
  if (!target) return;
  const result = await apiCall('sendMessage', {
    chat_id: target,
    text,
    parse_mode: 'Markdown',
  });
  if (!result?.ok) console.log('[telegram] Send failed:', result?.description);
}

function readTasks(project: string): any[] {
  try {
    const file = join(project, '.claudie-tasks.json');
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch { return []; }
}

function writeTasks(project: string, tasks: any[]) {
  writeFileSync(join(project, '.claudie-tasks.json'), JSON.stringify(tasks, null, 2), 'utf-8');
}

function scanProjects(): { name: string; path: string }[] {
  const results: { name: string; path: string }[] = [];
  const dirs = [
    join(homedir(), 'claudie-projects'),
    join(homedir(), 'claude-projects'),
    join(homedir(), 'projects'),
    join(homedir(), 'Projects'),
  ];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        try { if (statSync(full).isDirectory()) results.push({ name: entry, path: full }); } catch {}
      }
    } catch {}
  }
  return results;
}

async function handleMessage(text: string, chatId: string) {
  console.log(`[telegram] Received: "${text}" from ${chatId}`);
  const projectName = activeProject ? basename(activeProject) : null;

  if (text === '/start') {
    let msg = `🐾 *Welcome to Claudie!*\n\n`;
    if (projectName) {
      msg += `Active project: *${projectName}*\n\n`;
    } else {
      msg += `No project selected. Use /projects to see available ones.\n\n`;
    }
    msg += `*Commands:*\n/projects — List & select project\n/use <name> — Switch project\n/task <description> — Create a task\n/do <description> — Create & run immediately\n/run <id> — Execute a task\n/tasks — List tasks\n/status — Project info`;
    await sendTelegramMessage(msg, chatId);
  }

  else if (text === '/help') {
    await sendTelegramMessage(
      `🐾 *Claudie Commands:*\n\n` +
      `/projects — List available projects\n` +
      `/use <name> — Switch to a project\n` +
      `/task <description> — Create a task\n` +
      `/do <description> — Create & run immediately\n` +
      `/run <id> — Execute an existing task\n` +
      `/tasks — List all tasks\n` +
      `/status — Current project info\n` +
      `/help — This message`,
      chatId
    );
  }

  else if (text === '/projects') {
    const projects = scanProjects();
    if (projects.length === 0) { await sendTelegramMessage('No projects found', chatId); return; }
    const lines = projects.map((p) => {
      const active = p.path === activeProject ? ' ◀️' : '';
      return `• \`${p.name}\`${active}`;
    });
    await sendTelegramMessage(`*Projects:*\n${lines.join('\n')}\n\nUse /use <name> to switch`, chatId);
  }

  else if (text.startsWith('/use ')) {
    const name = text.slice(5).trim();
    if (!name) { await sendTelegramMessage('Usage: /use <project-name>', chatId); return; }
    const projects = scanProjects();
    const match = projects.find((p) => p.name.toLowerCase() === name.toLowerCase() || p.name.toLowerCase().includes(name.toLowerCase()));
    if (!match) { await sendTelegramMessage(`❌ Project "${name}" not found. Use /projects to see available.`, chatId); return; }
    activeProject = match.path;
    await sendTelegramMessage(`✅ Switched to *${match.name}*\n\`${match.path}\``, chatId);
  }

  else if (text.startsWith('/task ')) {
    const title = text.slice(6).trim();
    if (!title) { await sendTelegramMessage('Usage: /task <description>', chatId); return; }
    if (!activeProject) { await sendTelegramMessage('❌ No project selected. Use /projects then /use <name>', chatId); return; }
    const tasks = readTasks(activeProject);
    const task = { id: randomUUID(), title, status: 'open', comments: [], createdAt: new Date().toISOString() };
    tasks.push(task);
    writeTasks(activeProject, tasks);
    await sendTelegramMessage(`✅ Task created in *${projectName}*:\n*${title}*\nID: \`${task.id.slice(0, 8)}\``, chatId);
  }

  else if (text.startsWith('/run ')) {
    const taskRef = text.slice(5).trim();
    if (!taskRef) { await sendTelegramMessage('Usage: /run <task-id>', chatId); return; }
    if (!activeProject) { await sendTelegramMessage('❌ No project selected', chatId); return; }
    const tasks = readTasks(activeProject);
    const task = tasks.find((t: any) => t.id.startsWith(taskRef) && t.status === 'open');
    if (!task) { await sendTelegramMessage('❌ No open task found with that ID', chatId); return; }
    task.status = 'in-progress';
    task.startedAt = new Date().toISOString();
    writeTasks(activeProject, tasks);
    const sent = sendToTerminal ? sendToTerminal(activeProject, `Task [${task.id.slice(0, 8)}]: ${task.title}\n\nInclude [${task.id.slice(0, 8)}] in your commit message.\r`) : false;
    if (sent) {
      await sendTelegramMessage(`▶️ Sent to Claude in *${projectName}*: *${task.title}*`, chatId);
    } else {
      await sendTelegramMessage(`▶️ Task marked in-progress in *${projectName}*: *${task.title}*\n\n⚠️ No active Claude session — open the project in Claudie.`, chatId);
    }
  }

  else if (text === '/tasks') {
    if (!activeProject) { await sendTelegramMessage('❌ No project selected. Use /use <name>', chatId); return; }
    const tasks = readTasks(activeProject);
    if (tasks.length === 0) { await sendTelegramMessage(`No tasks in *${projectName}*`, chatId); return; }
    const lines = tasks.map((t: any) => {
      const icon = t.status === 'closed' ? '✅' : t.status === 'in-progress' ? '🔄' : '⬜';
      return `${icon} \`${t.id.slice(0, 8)}\` ${t.title}`;
    });
    await sendTelegramMessage(`*Tasks in ${projectName}:*\n${lines.join('\n')}`, chatId);
  }

  else if (text.startsWith('/do ')) {
    const title = text.slice(4).trim();
    if (!title) { await sendTelegramMessage('Usage: /do <description>', chatId); return; }
    if (!activeProject) { await sendTelegramMessage('❌ No project selected. Use /use <name>', chatId); return; }
    const tasks = readTasks(activeProject);
    const taskRef = randomUUID();
    const task = { id: taskRef, title, status: 'in-progress' as const, comments: [], createdAt: new Date().toISOString(), startedAt: new Date().toISOString() };
    tasks.push(task);
    writeTasks(activeProject, tasks);
    const sent = sendToTerminal ? sendToTerminal(activeProject, `Task [${taskRef.slice(0, 8)}]: ${title}\n\nInclude [${taskRef.slice(0, 8)}] in your commit message.\r`) : false;
    if (sent) {
      await sendTelegramMessage(`⚡ Task sent to Claude in *${projectName}*:\n*${title}*\nID: \`${taskRef.slice(0, 8)}\``, chatId);
    } else {
      await sendTelegramMessage(`⚡ Task created in *${projectName}*:\n*${title}*\nID: \`${taskRef.slice(0, 8)}\`\n\n⚠️ No active Claude session — open the project in Claudie to execute.`, chatId);
    }
  }

  else if (text === '/status') {
    if (!activeProject) {
      await sendTelegramMessage(`🐾 *Claudie*\nNo project selected. Use /projects`, chatId);
    } else {
      const tasks = readTasks(activeProject);
      const open = tasks.filter((t: any) => t.status === 'open').length;
      const inProgress = tasks.filter((t: any) => t.status === 'in-progress').length;
      const closed = tasks.filter((t: any) => t.status === 'closed').length;
      await sendTelegramMessage(
        `🐾 *Claudie Status*\n\nProject: *${projectName}*\n\`${activeProject}\`\n\nTasks: ${open} open, ${inProgress} active, ${closed} done`,
        chatId
      );
    }
  }
}

async function pollUpdates() {
  if (!config.enabled || !config.botToken) return;
  try {
    const data = await apiCall('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 5,
      allowed_updates: ['message'],
    });
    if (data?.ok && data?.result) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        const msg = update.message;
        if (msg?.text && msg?.chat?.id) {
          handleMessage(msg.text, String(msg.chat.id));
        }
      }
    }
  } catch (err) {
    console.log('[telegram] Poll error:', (err as Error).message);
  }
}

function startPolling() {
  stopPolling();
  console.log('[telegram] Polling started');
  pollUpdates(); // immediate first poll
  pollInterval = setInterval(pollUpdates, 3000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// Init on import
loadTelegramConfig();
if (config.enabled && config.botToken) startPolling();
