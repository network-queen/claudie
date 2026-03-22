import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: '/tmp/claudie-uploads' });

interface Task {
  id: string;
  title: string;
  status: 'open' | 'in-progress' | 'closed';
  comments: { text: string; createdAt: string }[];
  createdAt: string;
  startedAt?: string;
  closedAt?: string;
  log?: string;
}

function tasksFile(projectPath: string) {
  return join(projectPath, '.claudie-tasks.json');
}

function readTasks(projectPath: string): Task[] {
  const file = tasksFile(projectPath);
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch { return []; }
}

function writeTasks(projectPath: string, tasks: Task[]) {
  writeFileSync(tasksFile(projectPath), JSON.stringify(tasks, null, 2), 'utf-8');
}

// List tasks
router.get('/', (req: Request, res: Response) => {
  const project = req.query.project as string;
  if (!project) { res.status(400).json({ error: 'project required' }); return; }
  res.json({ data: readTasks(project) });
});

// Create task
router.post('/', (req: Request, res: Response) => {
  const { project, title } = req.body || {};
  if (!project || !title) { res.status(400).json({ error: 'project and title required' }); return; }
  const tasks = readTasks(project);
  const task: Task = {
    id: randomUUID(),
    title,
    status: 'open',
    comments: [],
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  writeTasks(project, tasks);
  res.json({ data: task });
});

// Update task (status, title)
router.put('/:id', (req: Request, res: Response) => {
  const { project, status, title, log } = req.body || {};
  if (!project) { res.status(400).json({ error: 'project required' }); return; }
  const tasks = readTasks(project);
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
  if (status) {
    task.status = status;
    if (status === 'in-progress' && !task.startedAt) task.startedAt = new Date().toISOString();
    if (status === 'closed') task.closedAt = new Date().toISOString();
  }
  if (title !== undefined) task.title = title;
  if (log !== undefined) (task as any).log = log;
  writeTasks(project, tasks);
  res.json({ data: task });
});

// Add comment to task
router.post('/:id/comment', (req: Request, res: Response) => {
  const { project, text } = req.body || {};
  if (!project || !text) { res.status(400).json({ error: 'project and text required' }); return; }
  const tasks = readTasks(project);
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
  task.comments.push({ text, createdAt: new Date().toISOString() });
  writeTasks(project, tasks);
  res.json({ data: task });
});

// Delete task
router.delete('/:id', (req: Request, res: Response) => {
  const project = req.query.project as string;
  if (!project) { res.status(400).json({ error: 'project required' }); return; }
  let tasks = readTasks(project);
  tasks = tasks.filter((t) => t.id !== req.params.id);
  writeTasks(project, tasks);
  res.json({ data: { removed: true } });
});

// Upload attachment for a task
router.post('/attachment', upload.single('file'), (req: Request, res: Response) => {
  try {
    const project = req.body?.project;
    const taskId = req.body?.taskId;
    const file = (req as any).file;
    if (!project || !file) { res.status(400).json({ error: 'project and file required' }); return; }

    const attachDir = join(project, '.claudie-attachments');
    if (!existsSync(attachDir)) mkdirSync(attachDir, { recursive: true });

    const destName = taskId ? `${taskId}-${file.originalname}` : file.originalname;
    const destPath = join(attachDir, destName);
    const { renameSync } = require('fs');
    renameSync(file.path, destPath);

    res.json({ data: { path: destPath, name: file.originalname } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(500).json({ error: message });
  }
});

// --- Procedures (reusable tasks) ---
function procsFile(projectPath: string) {
  return join(projectPath, '.claudie-procedures.json');
}

function readProcs(projectPath: string): { id: string; title: string; createdAt: string }[] {
  const file = procsFile(projectPath);
  if (!existsSync(file)) return [];
  try { return JSON.parse(readFileSync(file, 'utf-8')); } catch { return []; }
}

function writeProcs(projectPath: string, procs: any[]) {
  writeFileSync(procsFile(projectPath), JSON.stringify(procs, null, 2), 'utf-8');
}

router.get('/procedures', (req: Request, res: Response) => {
  const project = req.query.project as string;
  if (!project) { res.status(400).json({ error: 'project required' }); return; }
  res.json({ data: readProcs(project) });
});

router.post('/procedures', (req: Request, res: Response) => {
  const { project, title } = req.body || {};
  if (!project || !title) { res.status(400).json({ error: 'project and title required' }); return; }
  const procs = readProcs(project);
  const proc = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, createdAt: new Date().toISOString() };
  procs.push(proc);
  writeProcs(project, procs);
  res.json({ data: proc });
});

router.delete('/procedures/:id', (req: Request, res: Response) => {
  const project = req.query.project as string;
  if (!project) { res.status(400).json({ error: 'project required' }); return; }
  let procs = readProcs(project);
  procs = procs.filter((p) => p.id !== req.params.id);
  writeProcs(project, procs);
  res.json({ data: { removed: true } });
});

export default router;
