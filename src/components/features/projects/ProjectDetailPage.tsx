import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useResizable } from '@/hooks/useResizable';
import CodeEditor from '@/components/shared/CodeEditor';
import {
  ArrowLeft, Play, Square, File, Folder, FolderOpen, ChevronRight, ChevronDown,
  FileJson, FileCode, FileText, FileType, Save, Sparkles, X, ShieldOff, Upload, GitCommit, ChevronUp, Rocket, FlagOff, Trophy, AlertTriangle, Globe, Lock, Zap, Paperclip, RotateCcw, Copy, Mic, MicOff,
  Plus, Send, SendHorizonal, CheckCircle2, Circle, Loader2, MessageSquare, Trash2,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// --- Types ---
interface TreeNode { name: string; path: string; type: 'file' | 'directory'; children?: TreeNode[]; }
interface Task {
  id: string; title: string; status: 'open' | 'in-progress' | 'closed';
  comments: { text: string; createdAt: string }[]; createdAt: string;
  startedAt?: string; closedAt?: string;
  log?: string;
}

const fileIcons: Record<string, typeof File> = {
  '.ts': FileCode, '.tsx': FileCode, '.js': FileCode, '.jsx': FileCode,
  '.json': FileJson, '.md': FileText, '.txt': FileText,
};
function getFileIcon(name: string) {
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  return fileIcons[ext] || FileType;
}

const XTERM_THEME = {
  background: '#0f0f14', foreground: '#e0e0e0', cursor: '#7c3aed',
  selectionBackground: '#7c3aed40', black: '#1a1a24', red: '#ef4444',
  green: '#22c55e', yellow: '#eab308', blue: '#3b82f6', magenta: '#a855f7',
  cyan: '#06b6d4', white: '#e0e0e0', brightBlack: '#4a4a5a', brightRed: '#f87171',
  brightGreen: '#4ade80', brightYellow: '#facc15', brightBlue: '#60a5fa',
  brightMagenta: '#c084fc', brightCyan: '#22d3ee', brightWhite: '#ffffff',
};

const MODELS = [
  { value: 'claude-opus-4-6', label: 'Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
];

const STORAGE_KEY = 'claudie-terminal-settings';
function loadSettings() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ProjectDetailPage() {
  const [params] = useSearchParams();
  const projectPath = params.get('path') || '';
  const projectName = projectPath.split('/').filter(Boolean).pop() || 'Project';
  const saved = loadSettings();

  // Left panel tab
  const [leftTab, setLeftTab] = useState<'files' | 'tasks' | 'skills'>('tasks');

  // Skills (from ~/.claude/commands/)
  const [skills, setSkills] = useState<{ name: string; content: string; path: string }[]>([]);

  // Resizable panels
  const leftPanel = useResizable({ direction: 'horizontal', initialSize: 240, minSize: 160, maxSize: 500, storageKey: 'project-left' });
  const editorPanel = useResizable({ direction: 'vertical', initialSize: 250, minSize: 100, maxSize: 600, storageKey: 'project-editor' });
  const gitPanel = useResizable({ direction: 'vertical', initialSize: 150, minSize: 80, maxSize: 400, inverted: true, storageKey: 'project-git' });

  // File tree
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [openFile, setOpenFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleSpeech = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition not supported in this browser'); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    let finalTranscript = newTaskTitle;
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setNewTaskTitle(finalTranscript + (interim ? ' ' + interim : ''));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };
  const [commentingTaskId, setCommentingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filterTaskId, setFilterTaskId] = useState<string | null>(null);
  const [viewCommitDiff, setViewCommitDiff] = useState<{ hash: string; message: string; diff: string } | null>(null);

  const showCommitDiff = async (hash: string, message: string) => {
    try {
      const res = await fetch(`/api/git/diff?path=${encodeURIComponent(projectPath)}&commit=${hash}`);
      const data = await res.json();
      const diff = data.data?.commit || '';
      setViewCommitDiff({ hash, message, diff });
    } catch {}
  };
  const [editingTaskText, setEditingTaskText] = useState('');
  const activeTaskIdRef = useRef<string | null>(null);
  const taskLogsRef = useRef<Record<string, string>>({});
  const [commentText, setCommentText] = useState('');

  // Git
  const [commits, setCommits] = useState<{ hash: string; message: string; author: string; date: string }[]>([]);
  const [gitBranch, setGitBranch] = useState('');
  const [gitRemote, setGitRemote] = useState('');
  const [pushing, setPushing] = useState(false);
  const [repoVisibility, setRepoVisibility] = useState<'public' | 'private' | null>(null);
  const [gitFolded, setGitFolded] = useState(false);

  // PR required mode
  const [prRequired, setPrRequired] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`claudie-pr-${projectPath}`) || 'false'); } catch { return false; }
  });

  // Feature branch
  const [featureBranch, setFeatureBranch] = useState('');
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [finishStep, setFinishStep] = useState<'choose' | 'confirm-delete'>('choose');
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(false);

  // Diff review
  const [showDiffReview, setShowDiffReview] = useState(false);
  const [diffContent, setDiffContent] = useState('');
  const [diffCommitHash, setDiffCommitHash] = useState('');
  const [diffFeedback, setDiffFeedback] = useState('');
  const lastCommitCountRef = useRef(0);

  // Terminal
  const [model, setModel] = useState(saved.model || 'claude-opus-4-6');
  const [skipPermissions] = useState(true);
  const [appRunning, setAppRunning] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [claudeWaiting, setClaudeWaiting] = useState(false);
  const outputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedRef = useRef(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const termContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termIdRef = useRef<string | null>(null);


  // --- Notify when Claude is waiting ---
  const notifyClaude = useCallback(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    setClaudeWaiting(true);
    try { const w = JSON.parse(localStorage.getItem('claudie-waiting') || '{}'); w[projectPath] = true; localStorage.setItem('claudie-waiting', JSON.stringify(w)); } catch {}

    // Audio beep
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 880;
        gain2.gain.value = 0.15;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.15);
      }, 180);
    } catch {}

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('Claude needs your input', { body: `${projectName} — Claude is waiting for a response`, icon: '/logo.jpg' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, [projectName]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // --- ESC to close overlays (capture phase to beat xterm) ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewCommitDiff) { e.stopPropagation(); e.preventDefault(); setViewCommitDiff(null); return; }
        if (showDiffReview) { e.stopPropagation(); e.preventDefault(); setShowDiffReview(false); return; }
        if (openFile) { e.stopPropagation(); setOpenFile(null); setFileContent(''); setUnsaved(false); termRef.current?.focus(); }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [openFile, viewCommitDiff, showDiffReview]);

  // --- Ctrl+S to save ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (unsaved && openFile) handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [unsaved, openFile, fileContent]);

  // --- File tree ---
  const fetchTree = useCallback(async () => {
    if (!projectPath) return;
    setTreeLoading(true);
    try {
      const res = await fetch(`/api/files/tree?path=${encodeURIComponent(projectPath)}`);
      const data = await res.json();
      const items = data.data ?? data;
      setTree(Array.isArray(items) ? items : items.children || []);
    } catch {} finally { setTreeLoading(false); }
  }, [projectPath]);

  useEffect(() => { fetchTree(); const iv = setInterval(fetchTree, 10000); return () => clearInterval(iv); }, [fetchTree]);

  // Auto-create/detect feature branch on project open
  useEffect(() => {
    if (!projectPath) return;
    (async () => {
      try {
        // Check current branch
        const statusRes = await fetch(`/api/git/status?path=${encodeURIComponent(projectPath)}`);
        const statusData = await statusRes.json();
        const currentBranch = statusData.data?.branch || '';

        if (currentBranch && currentBranch !== 'master' && currentBranch !== 'main') {
          // Already on a feature branch
          setFeatureBranch(currentBranch);
        } else {
          // Create a new feature branch
          const branchName = `feature/${Date.now().toString(36)}`;
          await fetch('/api/git/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: projectPath, branch: `-b ${branchName}` }),
          });
          setFeatureBranch(branchName);
        }
      } catch {}
    })();
  }, [projectPath]);

  const openFileContent = async (node: TreeNode) => {
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(node.path)}`);
      const data = await res.json();
      const content = data.data?.content || data.content || (typeof data === 'string' ? data : '');
      setOpenFile({ path: node.path, name: node.name, content });
      setFileContent(content);
      setUnsaved(false);
    } catch {
      setOpenFile({ path: node.path, name: node.name, content: '// Failed to read file' });
      setFileContent('// Failed to read file');
    }
  };

  const handleSave = async () => {
    if (!openFile) return;
    setSaving(true);
    try {
      await fetch('/api/files/write', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: openFile.path, content: fileContent }) });
      setUnsaved(false);
      setOpenFile({ ...openFile, content: fileContent });
    } catch {} finally { setSaving(false); }
  };

  // --- Tasks ---
  const fetchTasks = useCallback(async () => {
    if (!projectPath) return;
    try {
      const res = await fetch(`/api/tasks?project=${encodeURIComponent(projectPath)}`);
      const data = await res.json();
      setTasks(data.data ?? []);
    } catch {}
  }, [projectPath]);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      setSkills(data.data ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const runSkill = (skill: { name: string; content: string }) => {
    if (!termIdRef.current) return;
    sendWs({ type: 'input', id: termIdRef.current, data: `/${skill.name}\r` });
  };

  const fetchGitInfo = useCallback(async () => {
    if (!projectPath) return;
    try {
      const [logRes, statusRes, visRes] = await Promise.all([
        fetch(`/api/git/log?path=${encodeURIComponent(projectPath)}&limit=30`),
        fetch(`/api/git/status?path=${encodeURIComponent(projectPath)}`),
        fetch(`/api/git/visibility?path=${encodeURIComponent(projectPath)}`),
      ]);
      const logData = await logRes.json();
      const newCommits = logData.data ?? [];
      const statusData = await statusRes.json();
      if (statusData.data?.branch) setGitBranch(statusData.data.branch);
      if (statusData.data?.remote) setGitRemote(statusData.data.remote);
      try { const visData = await visRes.json(); if (visData.data?.visibility) setRepoVisibility(visData.data.visibility); } catch {}

      // Detect new commit when PR required
      if (prRequired && newCommits.length > 0 && lastCommitCountRef.current > 0 && newCommits.length > lastCommitCountRef.current) {
        const latestHash = newCommits[0].hash;
        // Fetch diff for the latest commit
        try {
          const diffRes = await fetch(`/api/git/diff?path=${encodeURIComponent(projectPath)}&commit=${latestHash}`);
          const diffData = await diffRes.json();
          const diff = diffData.data?.commit || diffData.data?.staged || diffData.data?.unstaged || '';
          if (diff) {
            setDiffContent(diff);
            setDiffCommitHash(latestHash);
            setShowDiffReview(true);
          }
        } catch {}
      }
      lastCommitCountRef.current = newCommits.length;
      setCommits(newCommits);
    } catch {}
  }, [projectPath, prRequired]);

  useEffect(() => { fetchGitInfo(); const iv = setInterval(fetchGitInfo, 5000); return () => clearInterval(iv); }, [fetchGitInfo]);

  const handlePush = async () => {
    setPushing(true);
    try {
      if (termIdRef.current) {
        const branch = featureBranch || 'HEAD';
        sendWs({ type: 'input', id: termIdRef.current, data: `push all committed changes to the remote branch ${branch}\r` });
      }
    } finally { setTimeout(() => setPushing(false), 2000); }
  };

  const handleRelease = async () => {
    setReleasing(true);
    try {
      if (termIdRef.current && featureBranch) {
        sendWs({ type: 'input', id: termIdRef.current,
          data: `Squash-merge the current branch "${featureBranch}" into master (or main) as a single commit with a summary of all changes, push master to remote, then create a new feature branch for the next round of work. Tell me the new branch name when done.\r`
        });
      }
    } finally {
      setShowReleaseConfirm(false);
      setTimeout(() => {
        setReleasing(false);
        // Refresh to pick up new branch
        fetchGitInfo();
      }, 5000);
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectPath, title: newTaskTitle.trim() }) });
      const data = await res.json();
      const task = data.data;
      setTasks((prev) => [...prev, task]);
      setNewTaskTitle('');
    } catch {}
  };

  const updateTaskStatus = async (id: string, status: Task['status']) => {
    try {
      const log = status === 'closed' ? taskLogsRef.current[id] : undefined;
      await fetch(`/api/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectPath, status, log }) });
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status, log: log || t.log } : t));
      if (status === 'closed' && activeTaskIdRef.current === id) activeTaskIdRef.current = null;
    } catch {}
  };

  const addComment = async (id: string) => {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    try {
      const res = await fetch(`/api/tasks/${id}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectPath, text }) });
      const data = await res.json();
      const task = tasks.find((t) => t.id === id);
      // Auto-reopen if closed
      if (task?.status === 'closed') {
        await updateTaskStatus(id, 'in-progress');
      }
      setTasks((prev) => prev.map((t) => t.id === id ? { ...data.data, status: task?.status === 'closed' ? 'in-progress' : t.status } : t));
      setCommentText('');
      setCommentingTaskId(null);
      // Send comment to Claude as feedback
      if (termIdRef.current && task) {
        sendWs({ type: 'input', id: termIdRef.current, data: `Feedback on task "${task.title}": ${text}\r` });
      }
    } catch {}
  };

  const addAttachment = async (taskId: string, file: File) => {
    try {
      // Save file to project's .claudie-attachments/ directory
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project', projectPath);
      formData.append('taskId', taskId);
      const res = await fetch('/api/tasks/attachment', { method: 'POST', body: formData });
      if (!res.ok) return;
      const data = await res.json();
      // Add as comment with file reference
      const task = tasks.find((t) => t.id === taskId);
      const filePath = data.data?.path;
      if (filePath && termIdRef.current && task) {
        await fetch(`/api/tasks/${taskId}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: projectPath, text: `[Attachment: ${file.name}] saved at ${filePath}` }) });
        fetchTasks();
        sendWs({ type: 'input', id: termIdRef.current, data: `I attached a file "${file.name}" for task "${task.title}". It's saved at ${filePath}. Please read and use it.\r` });
      }
    } catch {}
  };

  const saveTaskTitle = async (id: string) => {
    if (!editingTaskText.trim()) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectPath, title: editingTaskText.trim() }) });
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, title: editingTaskText.trim() } : t));
    } catch {}
    setEditingTaskId(null);
  };

  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);

  const confirmDeleteTask = async () => {
    if (!deleteTaskTarget) return;
    const task = deleteTaskTarget;
    try {
      // If task was in-progress or closed, rollback to commit before the task started
      if (task.status !== 'open' && task.startedAt) {
        const logRes = await fetch(`/api/git/log?path=${encodeURIComponent(projectPath)}&limit=50`);
        const logData = await logRes.json();
        const allCommits = logData.data ?? [];
        const taskStart = new Date(task.startedAt).getTime();
        const commitBefore = allCommits.find((c: any) => new Date(c.date).getTime() < taskStart);
        if (commitBefore) {
          // Execute git reset directly via API, not through Claude
          await fetch('/api/git/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: projectPath, hash: commitBefore.hash }),
          });
          fetchGitInfo();
          fetchTree();
        }
      }
      await fetch(`/api/tasks/${task.id}?project=${encodeURIComponent(projectPath)}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (activeTaskIdRef.current === task.id) activeTaskIdRef.current = null;
    } catch {}
    setDeleteTaskTarget(null);
  };


  const sendTaskToClaude = (task: Task) => {
    if (!termIdRef.current) return;
    activeTaskIdRef.current = task.id;
    if (!taskLogsRef.current[task.id]) taskLogsRef.current[task.id] = '';
    updateTaskStatus(task.id, 'in-progress');
    const taskRef = task.id.slice(0, 8);
    let prompt = task.comments.length > 0
      ? `Task [${taskRef}]: ${task.title}\n\nFeedback/context:\n${task.comments.map(c => `- ${c.text}`).join('\n')}`
      : `Task [${taskRef}]: ${task.title}`;
    prompt += `\n\nInclude [${taskRef}] in your commit message.`;
    sendWs({ type: 'input', id: termIdRef.current, data: prompt + '\r' });
  };

  const sendAllTasksToClaude = () => {
    if (!termIdRef.current) return;
    const openTasks = tasks.filter((t) => t.status === 'open');
    if (openTasks.length === 0) return;
    openTasks.forEach((t) => updateTaskStatus(t.id, 'in-progress'));
    let prompt = 'Please complete these tasks one by one:\n\n' +
      openTasks.map((t, i) => {
        let line = `${i + 1}. ${t.title}`;
        if (t.comments.length > 0) line += `\n   Context: ${t.comments.map(c => c.text).join('; ')}`;
        return line;
      }).join('\n');
    sendWs({ type: 'input', id: termIdRef.current, data: prompt + '\r' });
  };

  // --- Terminal ---
  const sendWs = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    const term = new Terminal({ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, theme: XTERM_THEME,
      cursorBlink: true, allowProposedApi: true, scrollback: 5000 });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    termRef.current = term; fitRef.current = fitAddon;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      fetch('/api/terminal/sessions').then((r) => r.json()).then((j) => {
        const existing = (j.data || []).find((s: any) => s.alive && s.sessionConfig?.projectPath === projectPath);
        if (existing) {
          termIdRef.current = existing.id;
          ws.send(JSON.stringify({ type: 'attach', id: existing.id }));
        } else if (termContainerRef.current) {
          term.open(termContainerRef.current); fitAddon.fit(); term.focus();
          ws.send(JSON.stringify({ type: 'claude',
            options: { projectPath, dangerouslySkipPermissions: skipPermissions, model, cols: term.cols, rows: term.rows } }));
        }
      }).catch(() => {
        if (termContainerRef.current) {
          term.open(termContainerRef.current); fitAddon.fit(); term.focus();
          ws.send(JSON.stringify({ type: 'claude', options: { projectPath, dangerouslySkipPermissions: skipPermissions, model } }));
        }
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'created' && msg.id) {
          termIdRef.current = msg.id; setTerminalReady(true);
          if (termContainerRef.current && !term.element) { term.open(termContainerRef.current); fitAddon.fit(); term.focus(); }
        } else if (msg.type === 'attached') {
          setTerminalReady(true);
          if (termContainerRef.current && !term.element) { term.open(termContainerRef.current); fitAddon.fit(); term.focus(); }
        } else if (msg.type === 'output' && msg.data) {
          term.write(msg.data);
          // Capture output for active task log (filter thinking lines)
          if (activeTaskIdRef.current) {
            const clean = msg.data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
              .split('\n')
              .filter((l: string) => !l.match(/^\s*(◐|◑|◒|◓|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|●)?\s*(Thinking|thinking|Reading|Writing|Searching|Editing|Running|Executing)/i))
              .join('\n');
            if (clean.trim()) taskLogsRef.current[activeTaskIdRef.current] = (taskLogsRef.current[activeTaskIdRef.current] || '') + clean;
            // Cap at 50KB per task
            if (taskLogsRef.current[activeTaskIdRef.current].length > 50000) {
              taskLogsRef.current[activeTaskIdRef.current] = taskLogsRef.current[activeTaskIdRef.current].slice(-50000);
            }
          }
          // Detect Claude's input prompt: ❯ character
          if (msg.data.includes('❯')) {
            // Small delay to confirm it's really the prompt (not mid-stream)
            if (outputTimerRef.current) clearTimeout(outputTimerRef.current);
            outputTimerRef.current = setTimeout(() => notifyClaude(), 1500);
          } else {
            // New output that's not the prompt — Claude is still working
            setClaudeWaiting(false);
            try { const w = JSON.parse(localStorage.getItem('claudie-waiting') || '{}'); delete w[projectPath]; localStorage.setItem('claudie-waiting', JSON.stringify(w)); } catch {}
            notifiedRef.current = false;
            if (outputTimerRef.current) clearTimeout(outputTimerRef.current);
          }
        }
        else if (msg.type === 'exit') { term.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n'); }
      } catch {}
    };
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => ws.close();
    term.onData((data) => {
      if (termIdRef.current) sendWs({ type: 'input', id: termIdRef.current, data });
      setClaudeWaiting(false);
      notifiedRef.current = false;
      if (outputTimerRef.current) clearTimeout(outputTimerRef.current);
    });
    return () => { ws.close(); term.dispose(); };
  }, [projectPath]);

  useEffect(() => {
    const onResize = () => {
      if (fitRef.current && termRef.current && termIdRef.current) {
        fitRef.current.fit();
        sendWs({ type: 'resize', id: termIdRef.current, cols: termRef.current.cols, rows: termRef.current.rows });
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sendWs]);

  const openTaskCount = tasks.filter((t) => t.status === 'open').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in-progress').length;
  const closedTaskCount = tasks.filter((t) => t.status === 'closed').length;
  const totalTaskTime = tasks.reduce((sum, t) => {
    if (t.startedAt && t.closedAt) {
      return sum + (new Date(t.closedAt).getTime() - new Date(t.startedAt).getTime());
    }
    return sum;
  }, 0);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-surface-800 border-b border-surface-700 px-4 py-2.5 flex items-center gap-3">
        <Link to="/projects" className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-accent-400 shrink-0" />
          <span className="font-semibold text-white text-sm truncate">{projectName}</span>
        </div>
        {/* Model dropdown + flags */}
        <div className="flex items-center gap-1.5">
          <select value={model} onChange={(e) => {
            const newModel = e.target.value;
            setModel(newModel);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSettings(), model: newModel })); } catch {}
            if (termIdRef.current) { sendWs({ type: 'input', id: termIdRef.current, data: `/model ${newModel}\r` }); }
          }}
            className="appearance-none bg-accent-500/15 text-accent-400 text-[10px] font-mono rounded px-2 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-accent-500 cursor-pointer">
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {skipPermissions && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] rounded">
              <ShieldOff className="w-3 h-3" /> skip-permissions
            </span>
          )}
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={prRequired}
              onChange={(e) => {
                setPrRequired(e.target.checked);
                try { localStorage.setItem(`claudie-pr-${projectPath}`, JSON.stringify(e.target.checked)); } catch {}
                // Instruct Claude about the mode change
              }}
              className="w-3 h-3 rounded border-surface-600 bg-surface-900 text-accent-500" />
            <span className="text-[10px] text-surface-400">PR required</span>
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!appRunning ? (
            <button onClick={() => { if (termIdRef.current) { sendWs({ type: 'input', id: termIdRef.current, data: 'start the project, run it in dev mode\r' }); setAppRunning(true); } }}
              disabled={!terminalReady} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 disabled:opacity-40 text-green-400 text-xs font-medium rounded-lg transition-colors">
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          ) : (
            <button onClick={() => { if (termIdRef.current) { sendWs({ type: 'input', id: termIdRef.current, data: 'stop the project, kill all running dev servers and processes\r' }); setAppRunning(false); } }}
              disabled={!terminalReady} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 text-red-400 text-xs font-medium rounded-lg transition-colors">
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          <button onClick={handlePush} disabled={!terminalReady || pushing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 disabled:opacity-40 text-blue-400 text-xs font-medium rounded-lg transition-colors">
            <Upload className="w-3.5 h-3.5" /> {pushing ? 'Pushing...' : 'Push'}
          </button>
          <button onClick={() => setShowReleaseConfirm(true)} disabled={!terminalReady || releasing || !featureBranch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-400 text-xs font-medium rounded-lg transition-colors">
            <Rocket className="w-3.5 h-3.5" /> {releasing ? 'Releasing...' : 'Release'}
          </button>
          <button onClick={() => { setShowFinishDialog(true); setFinishStep('choose'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-medium rounded-lg transition-colors">
            <FlagOff className="w-3.5 h-3.5" /> Finish project
          </button>
          {featureBranch && (
            <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 text-[10px] font-mono rounded">{featureBranch}</span>
          )}
          {repoVisibility && (
            <button onClick={() => setShowVisibilityConfirm(true)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                repoVisibility === 'private'
                  ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                  : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
              }`}>
              {repoVisibility === 'private' ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              {repoVisibility === 'private' ? 'Private repository' : 'Public repository'}
            </button>
          )}
          {claudeWaiting && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 text-amber-400 text-[10px] font-medium rounded-lg animate-pulse">
              Waiting for input
            </span>
          )}
          <div className="flex items-center gap-1.5 ml-1">
            <div className={`w-2 h-2 rounded-full ${claudeWaiting ? 'bg-amber-500 animate-pulse' : wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Files / Tasks */}
        <div className="bg-surface-800 border-r border-surface-700 flex flex-col shrink-0" style={{ width: leftPanel.size }}>
          {/* Panel tabs */}
          <div className="flex border-b border-surface-700">
            <button onClick={() => setLeftTab('tasks')}
              className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors relative ${leftTab === 'tasks' ? 'text-accent-400 border-b-2 border-accent-500' : 'text-surface-500 hover:text-surface-300'}`}>
              Tasks
              {(openTaskCount + inProgressCount) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded-full bg-accent-500/20 text-accent-400">{openTaskCount + inProgressCount}</span>
              )}
            </button>
            <button onClick={() => setLeftTab('skills')}
              className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${leftTab === 'skills' ? 'text-accent-400 border-b-2 border-accent-500' : 'text-surface-500 hover:text-surface-300'}`}>
              Skills
              {skills.length > 0 && <span className="ml-1 text-[9px] text-surface-600">{skills.length}</span>}
            </button>
            <button onClick={() => setLeftTab('files')}
              className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${leftTab === 'files' ? 'text-accent-400 border-b-2 border-accent-500' : 'text-surface-500 hover:text-surface-300'}`}>
              Files
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Skills tab */}
            {leftTab === 'skills' && (
              <div className="p-2 space-y-2">
                {skills.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-xs text-surface-500">No skills yet.</p>
                    <a href="/skills" className="text-[10px] text-accent-400 hover:underline">Create skills</a>
                  </div>
                )}
                {skills.map((skill) => (
                  <div key={skill.name} className="rounded-lg border border-surface-700 bg-surface-900 p-2">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-accent-400 shrink-0" />
                      <span className="text-sm text-accent-400 font-mono flex-1">/{skill.name}</span>
                      <button onClick={() => runSkill(skill)} disabled={!terminalReady} title="Run skill"
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-40 text-green-400 text-[9px] rounded transition-colors">
                        <Play className="w-3 h-3" /> Run
                      </button>
                    </div>
                    <p className="text-[10px] text-surface-500 mt-1 line-clamp-2">{skill.content.slice(0, 100)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Files tab */}
            {leftTab === 'files' && (
              treeLoading ? <div className="p-3 text-xs text-surface-500">Loading...</div>
              : tree.length === 0 ? <div className="p-3 text-xs text-surface-500">Empty project</div>
              : <div className="py-1">{tree.map((n) => <TreeItem key={n.path} node={n} depth={0} onFileClick={openFileContent} selectedPath={openFile?.path} />)}</div>
            )}

            {/* Tasks tab */}
            {leftTab === 'tasks' && (
              <div className="p-2 space-y-2">
                {/* Add task */}
                <div className="flex gap-1">
                  <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    placeholder={isListening ? 'Listening...' : 'New task...'}
                    className={`flex-1 bg-surface-900 border rounded px-2 py-1 text-xs text-white placeholder-surface-500 focus:outline-none ${
                      isListening ? 'border-red-500 animate-pulse' : 'border-surface-700 focus:border-accent-500'
                    }`} />
                  <button onClick={toggleSpeech} title={isListening ? 'Stop listening' : 'Voice input'}
                    className={`p-1 rounded transition-colors ${
                      isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-surface-700 hover:bg-surface-600 text-surface-300'
                    }`}>
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={addTask} disabled={!newTaskTitle.trim()}
                    className="p-1 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white rounded transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Send all open tasks */}
                {openTaskCount > 0 && (
                  <button onClick={sendAllTasksToClaude} disabled={!terminalReady}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-accent-500/15 hover:bg-accent-500/25 disabled:opacity-40 text-accent-400 text-xs font-medium rounded transition-colors">
                    <SendHorizonal className="w-3.5 h-3.5" /> Send all {openTaskCount} open tasks
                  </button>
                )}

                {/* Task stats */}
                {tasks.length > 0 && (
                  <div className="flex items-center gap-2 px-1 py-1.5 text-[9px] border-b border-surface-700/50 mb-1">
                    <span className="text-green-400">{closedTaskCount}/{tasks.length} done</span>
                    {inProgressCount > 0 && <span className="text-amber-400">{inProgressCount} active</span>}
                    {totalTaskTime > 0 && <span className="text-surface-500">{formatDuration(totalTaskTime)}</span>}
                    {tasks.length > 0 && (
                      <div className="flex-1 h-1 bg-surface-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(closedTaskCount / tasks.length) * 100}%` }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Task list */}
                {tasks.length === 0 && (
                  <p className="text-xs text-surface-500 text-center py-4">No tasks yet</p>
                )}
                {[...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((task) => (
                  <div key={task.id} className={`rounded-lg border p-2 space-y-1.5 transition-colors ${
                    task.status === 'in-progress' ? 'border-amber-500/30 bg-amber-500/5' :
                    task.status === 'closed' ? 'border-surface-700/50 bg-surface-900/50 opacity-60' :
                    'border-surface-700 bg-surface-900'
                  }`}>
                    <div className="flex items-start gap-1.5">
                      {/* Status icon */}
                      {task.status === 'closed' ? (
                        <button onClick={() => updateTaskStatus(task.id, 'open')} title="Reopen task" className="mt-0.5 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 hover:text-green-400" />
                        </button>
                      ) : task.status === 'in-progress' ? (
                        <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-surface-600 mt-0.5 shrink-0" />
                      )}
                      {editingTaskId === task.id ? (
                        <input type="text" value={editingTaskText}
                          onChange={(e) => setEditingTaskText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveTaskTitle(task.id); if (e.key === 'Escape') setEditingTaskId(null); }}
                          onBlur={() => saveTaskTitle(task.id)}
                          autoFocus
                          className="text-sm flex-1 bg-surface-800 border border-accent-500 rounded px-1 py-0.5 text-white focus:outline-none" />
                      ) : (
                        <button
                          onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          onDoubleClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.title); }}
                          className={`text-sm flex-1 text-left cursor-pointer hover:underline ${task.status === 'closed' ? 'line-through text-surface-500' : 'text-surface-200'}`}>
                          {task.title}
                        </button>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {task.status === 'in-progress' && (
                          <button onClick={() => updateTaskStatus(task.id, 'closed')} title="Mark as done"
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[9px] font-medium rounded transition-colors">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </button>
                        )}
                        {task.status !== 'closed' && (
                          <button onClick={() => sendTaskToClaude(task)} disabled={!terminalReady} title="Send to Claude"
                            className="p-0.5 text-accent-400/60 hover:text-accent-400 disabled:opacity-40 transition-colors">
                            <Send className="w-3 h-3" />
                          </button>
                        )}
                        {task.status === 'closed' && (
                          <button onClick={() => updateTaskStatus(task.id, 'open')} title="Reopen task"
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] rounded transition-colors">
                            <RotateCcw className="w-3 h-3" /> Reopen
                          </button>
                        )}
                        <label title="Attach file" className="p-0.5 text-surface-500 hover:text-surface-300 transition-colors cursor-pointer">
                          <Paperclip className="w-3 h-3" />
                          <input type="file" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) addAttachment(task.id, file);
                            e.target.value = '';
                          }} />
                        </label>
                        <button onClick={() => setCommentingTaskId(commentingTaskId === task.id ? null : task.id)} title="Comment"
                          className="p-0.5 text-surface-500 hover:text-surface-300 transition-colors">
                          <MessageSquare className="w-3 h-3" />
                        </button>
                        <button onClick={() => setDeleteTaskTarget(task)} title="Delete"
                          className="p-0.5 text-surface-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Comments */}
                    {/* UUID + Timestamps */}
                    <div className="pl-5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <button onClick={() => setFilterTaskId(filterTaskId === task.id ? null : task.id)}
                        title="Filter commits by this task"
                        className={`text-[9px] font-mono transition-colors ${filterTaskId === task.id ? 'text-accent-400' : 'text-surface-600 hover:text-accent-400'}`}>
                        [{task.id.slice(0, 8)}]
                      </button>
                      <span className="text-[9px] text-surface-600">Created {formatTime(task.createdAt)}</span>
                      {task.startedAt && <span className="text-[9px] text-amber-500/60">Started {formatTime(task.startedAt)}</span>}
                      {task.closedAt && <span className="text-[9px] text-green-500/60">Done {formatTime(task.closedAt)}</span>}
                      {task.startedAt && task.closedAt && (
                        <span className="text-[9px] text-surface-600">({duration(task.startedAt, task.closedAt)})</span>
                      )}
                    </div>

                    {task.comments.length > 0 && (
                      <div className="pl-5 space-y-0.5">
                        {task.comments.map((c, i) => (
                          <p key={i} className="text-[10px] text-surface-500">
                            <span className="text-surface-400">{c.text}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Comment input */}
                    {commentingTaskId === task.id && (
                      <div className="flex gap-1 pl-5">
                        <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addComment(task.id)}
                          placeholder="Add feedback..."
                          autoFocus
                          className="flex-1 bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 text-[10px] text-white placeholder-surface-500 focus:outline-none focus:border-accent-500" />
                        <button onClick={() => addComment(task.id)} disabled={!commentText.trim()}
                          className="px-1.5 py-0.5 bg-accent-500/20 text-accent-400 disabled:opacity-40 text-[10px] rounded transition-colors">
                          Add
                        </button>
                      </div>
                    )}

                    {/* Task log */}
                    {expandedTaskId === task.id && (
                      <div className="mt-1 bg-surface-800 rounded border border-surface-700 max-h-48 overflow-y-auto">
                        <div className="px-2 py-1 border-b border-surface-700 flex items-center justify-between">
                          <span className="text-[9px] text-surface-500 font-semibold uppercase">Claude interaction</span>
                          <button onClick={() => setExpandedTaskId(null)} className="text-surface-600 hover:text-surface-300">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <pre className="px-2 py-1.5 text-[10px] text-surface-400 font-mono whitespace-pre-wrap break-all">
                          {(task.log || taskLogsRef.current[task.id] || 'No interaction recorded yet.')}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resize handle: left panel */}
        <div onMouseDown={leftPanel.onMouseDown}
          className="w-1 hover:w-1.5 bg-transparent hover:bg-accent-500/30 cursor-col-resize shrink-0 transition-all" />

        {/* Right: editor + terminal */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* File editor overlay — covers terminal when open */}
          {openFile && (
            <div className="flex-1 flex flex-col absolute inset-0 z-10 bg-surface-900">
              <div className="bg-surface-800 border-b border-surface-700 px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs text-surface-400 font-mono truncate flex-1">{openFile.name}</span>
                {unsaved && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                <span className="text-[10px] text-surface-600">ESC to close</span>
                <button onClick={handleSave} disabled={saving || !unsaved}
                  className="flex items-center gap-1 px-2 py-0.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-30 text-white text-xs rounded transition-colors">
                  <Save className="w-3 h-3" /> Save
                </button>
                <button onClick={() => { setOpenFile(null); setFileContent(''); setUnsaved(false); termRef.current?.focus(); }}
                  className="p-0.5 text-surface-500 hover:text-white rounded transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  value={fileContent}
                  filename={openFile.name}
                  onChange={(val) => { setFileContent(val); setUnsaved(val !== openFile.content); }}
                />
              </div>
            </div>
          )}

          {/* Terminal — always rendered, hidden behind editor when file is open */}
          <div className="flex-1 bg-[#0f0f14] relative min-h-[100px]">
            <div ref={termContainerRef} className="absolute inset-0" style={{ padding: '4px' }} />
            <button onClick={() => termRef.current?.clear()} disabled={!terminalReady}
              className={`absolute top-2 right-2 z-10 px-2 py-1 bg-surface-800/80 hover:bg-surface-700 disabled:opacity-40 text-surface-400 hover:text-surface-200 text-[10px] rounded transition-colors backdrop-blur-sm ${openFile ? 'hidden' : ''}`}>
              Clear console
            </button>
          </div>

          {/* Resize handle: git log */}
          <div onMouseDown={gitPanel.onMouseDown}
            className="h-1 hover:h-1.5 bg-transparent hover:bg-accent-500/30 cursor-row-resize shrink-0 transition-all" />

          {/* Git log panel */}
          <div className="bg-surface-800 border-t border-surface-700 flex flex-col shrink-0" style={{ height: gitFolded ? 'auto' : gitPanel.size }}>
            <button onClick={() => setGitFolded(!gitFolded)}
              className="px-3 py-1.5 border-b border-surface-700 flex items-center gap-2 hover:bg-surface-700/30 transition-colors w-full text-left">
              {gitFolded ? <ChevronUp className="w-3.5 h-3.5 text-surface-500" /> : <ChevronDown className="w-3.5 h-3.5 text-surface-500" />}
              <GitCommit className="w-3.5 h-3.5 text-surface-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Git</span>
              {gitBranch && <span className="px-1.5 py-0.5 bg-accent-500/15 text-accent-400 text-[9px] font-mono rounded">{gitBranch}</span>}
              <span className="text-[10px] text-surface-600">{commits.length} commits</span>
              {filterTaskId && (
                <button onClick={(e) => { e.stopPropagation(); setFilterTaskId(null); }}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-accent-500/15 text-accent-400 text-[9px] rounded hover:bg-accent-500/25 transition-colors">
                  filtered [{filterTaskId.slice(0, 8)}] <X className="w-2.5 h-2.5" />
                </button>
              )}
              <div className="flex-1" />
              {gitRemote && (
                <span onClick={(e) => { e.stopPropagation(); window.open(gitRemote.replace(/\.git$/, ''), '_blank'); }}
                  className="text-[10px] text-surface-500 hover:text-accent-400 font-mono truncate max-w-[250px] transition-colors cursor-pointer">
                  {gitRemote.replace('https://github.com/', '').replace(/\.git$/, '')}
                </span>
              )}
            </button>
            {!gitFolded && (
              <div className="flex-1 overflow-y-auto">
                {commits.length === 0 ? (
                  <div className="p-3 text-xs text-surface-500">No commits yet</div>
                ) : (
                  <div className="divide-y divide-surface-700/50">
                    {commits.filter((c) => !filterTaskId || c.message.includes(`[${filterTaskId.slice(0, 8)}]`)).map((c) => (
                      <div key={c.hash} onClick={() => showCommitDiff(c.hash, c.message)}
                        className="flex items-center gap-3 px-3 py-1.5 hover:bg-surface-700/30 transition-colors cursor-pointer">
                        <code className="text-[10px] font-mono text-accent-400 shrink-0">{c.hash.slice(0, 7)}</code>
                        <span className="text-xs text-surface-200 truncate flex-1">{c.message}</span>
                        <span className="text-[10px] text-surface-500 shrink-0">{c.author}</span>
                        <span className="text-[10px] text-surface-600 shrink-0">{formatTime(c.date)} ({timeAgo(c.date)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visibility Confirmation */}
      {showVisibilityConfirm && repoVisibility && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                {repoVisibility === 'private'
                  ? <Globe className="w-6 h-6 text-green-400 shrink-0" />
                  : <Lock className="w-6 h-6 text-amber-400 shrink-0" />}
                <h2 className="text-lg font-semibold text-white">
                  Make repository {repoVisibility === 'private' ? 'public' : 'private'}?
                </h2>
              </div>
              {repoVisibility === 'private' ? (
                <div className="space-y-2">
                  <p className="text-sm text-surface-300">This will make your repository <span className="text-green-400 font-medium">visible to everyone</span> on GitHub.</p>
                  <p className="text-xs text-surface-500">Anyone will be able to see your code, clone the repo, and view commit history.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-surface-300">This will make your repository <span className="text-amber-400 font-medium">private</span>.</p>
                  <p className="text-xs text-surface-500">Only you and collaborators you explicitly add will be able to see the code.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button onClick={() => setShowVisibilityConfirm(false)}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={async () => {
                const next = repoVisibility === 'private' ? 'public' : 'private';
                try {
                  const res = await fetch('/api/git/visibility', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: projectPath, visibility: next }) });
                  if (res.ok) setRepoVisibility(next);
                } catch {}
                setShowVisibilityConfirm(false);
              }}
                className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  repoVisibility === 'private' ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'
                }`}>
                {repoVisibility === 'private'
                  ? <><Globe className="w-4 h-4" /> Make Public</>
                  : <><Lock className="w-4 h-4" /> Make Private</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Task Confirmation */}
      {deleteTaskTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h2 className="text-lg font-semibold">Delete Task</h2>
              </div>
              <p className="text-sm text-surface-200">{deleteTaskTarget.title}</p>
              {deleteTaskTarget.status !== 'open' && deleteTaskTarget.startedAt && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
                  This will rollback the code to the state before this task started.
                </div>
              )}
              {deleteTaskTarget.status === 'open' && (
                <p className="text-xs text-surface-500">This task hasn't been executed yet — no code changes to rollback.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button onClick={() => setDeleteTaskTarget(null)}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={confirmDeleteTask}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
                {deleteTaskTarget.status !== 'open' ? 'Delete & Rollback' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release Confirmation */}
      {showReleaseConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-emerald-400">
                <Rocket className="w-6 h-6 shrink-0" />
                <h2 className="text-lg font-semibold">Release to Master</h2>
              </div>
              <p className="text-sm text-surface-300">
                This will merge <code className="text-blue-400 font-mono">{featureBranch}</code> into{' '}
                <code className="text-white font-mono">master</code> and push to remote.
              </p>
              <p className="text-xs text-surface-500">
                Claude will merge, push, and create a new feature branch for continued development.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button onClick={() => setShowReleaseConfirm(false)}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleRelease} disabled={releasing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                <Rocket className="w-4 h-4" />
                {releasing ? 'Releasing...' : 'Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish Project Dialog */}
      {showFinishDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            {finishStep === 'choose' && (
              <>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <FlagOff className="w-6 h-6 text-surface-400 shrink-0" />
                    <h2 className="text-lg font-semibold text-white">Finish Project</h2>
                  </div>
                  <p className="text-sm text-surface-300">Why are you finishing this project?</p>
                </div>
                <div className="p-5 pt-0 space-y-2">
                  <button onClick={async () => {
                    // Mark as completed
                    try {
                      const completed = JSON.parse(localStorage.getItem('claudie-completed-projects') || '[]');
                      completed.push({ path: projectPath, name: projectName, completedAt: new Date().toISOString(), remote: gitRemote || '' });
                      localStorage.setItem('claudie-completed-projects', JSON.stringify(completed));
                      // Remove from open projects
                      const open = JSON.parse(localStorage.getItem('claudie-open-projects') || '[]');
                      localStorage.setItem('claudie-open-projects', JSON.stringify(open.filter((p: any) => p.path !== projectPath)));
                    } catch {}
                    setShowFinishDialog(false);
                    window.location.href = '/projects';
                  }}
                    className="w-full flex items-center gap-3 p-4 bg-surface-900 hover:bg-emerald-500/10 border border-surface-700 hover:border-emerald-500/30 rounded-lg transition-colors text-left">
                    <Trophy className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-white block">Completed</span>
                      <span className="text-xs text-surface-400">Project is done and will be archived</span>
                    </div>
                  </button>
                  <button onClick={() => setFinishStep('confirm-delete')}
                    className="w-full flex items-center gap-3 p-4 bg-surface-900 hover:bg-red-500/10 border border-surface-700 hover:border-red-500/30 rounded-lg transition-colors text-left">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-white block">Not needed</span>
                      <span className="text-xs text-surface-400">Delete project from disk and GitHub</span>
                    </div>
                  </button>
                </div>
                <div className="flex justify-end p-5 pt-0">
                  <button onClick={() => setShowFinishDialog(false)}
                    className="px-4 py-2 text-sm text-surface-400 hover:text-white rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
            {finishStep === 'confirm-delete' && (
              <>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3 text-red-400">
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                    <h2 className="text-lg font-semibold">Delete Everything?</h2>
                  </div>
                  <p className="text-sm text-surface-300">
                    This will <span className="text-red-400 font-medium">permanently delete</span> the project folder and its GitHub repository.
                  </p>
                  <div className="bg-surface-900 rounded-lg px-3 py-2 font-mono text-sm text-surface-300 break-all">
                    {projectPath}
                  </div>
                  <p className="text-xs text-surface-500">This cannot be undone.</p>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
                  <button onClick={() => setFinishStep('choose')}
                    className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                    Back
                  </button>
                  <button onClick={async () => {
                    try {
                      await fetch('/api/projects/remove', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: projectPath, deleteFromGit: true }),
                      });
                      // Remove from open projects
                      const open = JSON.parse(localStorage.getItem('claudie-open-projects') || '[]');
                      localStorage.setItem('claudie-open-projects', JSON.stringify(open.filter((p: any) => p.path !== projectPath)));
                    } catch {}
                    setShowFinishDialog(false);
                    window.location.href = '/projects';
                  }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Commit Diff Viewer */}
      {viewCommitDiff && (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
          <div className="bg-surface-800 border-b border-surface-700 px-6 py-3 flex items-center gap-3">
            <GitCommit className="w-5 h-5 text-accent-400" />
            <code className="text-sm text-accent-400 font-mono">{viewCommitDiff.hash.slice(0, 7)}</code>
            <span className="text-sm text-surface-200 truncate flex-1">{viewCommitDiff.message}</span>
            <button onClick={() => setViewCommitDiff(null)}
              className="p-2 text-surface-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-surface-900 font-mono text-xs">
            {viewCommitDiff.diff ? viewCommitDiff.diff.split('\n').map((line, i) => {
              let cls = 'text-surface-400 px-6 py-0.5';
              if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-green-400 bg-green-500/5 px-6 py-0.5';
              else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400 bg-red-500/5 px-6 py-0.5';
              else if (line.startsWith('@@')) cls = 'text-blue-400 bg-blue-500/5 px-6 py-0.5 font-semibold';
              else if (line.startsWith('diff ') || line.startsWith('index ')) cls = 'text-surface-500 bg-surface-800 px-6 py-1 font-semibold border-t border-surface-700 mt-2';
              return <div key={i} className={cls}>{line || '\u00a0'}</div>;
            }) : <div className="p-6 text-surface-500">No changes in this commit</div>}
          </div>
        </div>
      )}

      {/* Diff Review Overlay */}
      {showDiffReview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
          {/* Header */}
          <div className="bg-surface-800 border-b border-surface-700 px-6 py-3 flex items-center gap-3">
            <GitCommit className="w-5 h-5 text-accent-400" />
            <h2 className="text-white font-semibold">Review Changes</h2>
            <code className="text-xs text-accent-400 font-mono">{diffCommitHash.slice(0, 7)}</code>
            <div className="flex-1" />
            <button
              onClick={() => {
                // Approve: close review and tell Claude to continue
                setShowDiffReview(false);
                setDiffFeedback('');
                if (termIdRef.current) {
                  sendWs({ type: 'input', id: termIdRef.current, data: 'Changes approved. Continue.\r' });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => {
                if (!diffFeedback.trim()) return;
                setShowDiffReview(false);
                if (termIdRef.current) {
                  sendWs({ type: 'input', id: termIdRef.current, data: `Changes need revision: ${diffFeedback.trim()}\r` });
                }
                setDiffFeedback('');
              }}
              disabled={!diffFeedback.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Request Changes
            </button>
            <button onClick={() => { setShowDiffReview(false); setDiffFeedback(''); }}
              className="p-2 text-surface-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Diff content — filter system files */}
          <div className="flex-1 overflow-auto bg-surface-900 font-mono text-xs">
            {diffContent.split('\n').filter((_, i, lines) => {
              // Filter out diffs for CLAUDE.md, .claudie-tasks.json, .gitignore
              const systemFiles = ['CLAUDE.md', '.claudie-tasks.json', '.gitignore', '.claude/'];
              // Find current file context
              let currentFile = '';
              for (let j = i; j >= 0; j--) {
                if (lines[j].startsWith('diff --git')) {
                  currentFile = lines[j];
                  break;
                }
              }
              return !systemFiles.some((f) => currentFile.includes(f));
            }).map((line, i) => {
              let lineClass = 'text-surface-400 px-6 py-0.5';
              if (line.startsWith('+') && !line.startsWith('+++')) lineClass = 'text-green-400 bg-green-500/5 px-6 py-0.5';
              else if (line.startsWith('-') && !line.startsWith('---')) lineClass = 'text-red-400 bg-red-500/5 px-6 py-0.5';
              else if (line.startsWith('@@')) lineClass = 'text-blue-400 bg-blue-500/5 px-6 py-0.5 font-semibold';
              else if (line.startsWith('diff ') || line.startsWith('index ')) lineClass = 'text-surface-500 bg-surface-800 px-6 py-1 font-semibold border-t border-surface-700 mt-2';
              return <div key={i} className={lineClass}>{line || '\u00a0'}</div>;
            })}
          </div>

          {/* Feedback input */}
          <div className="bg-surface-800 border-t border-surface-700 px-6 py-3 flex gap-3">
            <input
              type="text"
              value={diffFeedback}
              onChange={(e) => setDiffFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && diffFeedback.trim()) {
                  setShowDiffReview(false);
                  if (termIdRef.current) {
                    sendWs({ type: 'input', id: termIdRef.current, data: `Changes need revision: ${diffFeedback.trim()}\r` });
                  }
                  setDiffFeedback('');
                }
              }}
              placeholder="Write feedback for Claude to revise..."
              className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function duration(start: string, end: string): string {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${secs % 60}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  } catch { return ''; }
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s total`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m total`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m total`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h total`;
}

function timeAgo(dateStr: string): string {
  try {
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d`;
    return `${Math.floor(days / 30)}mo`;
  } catch { return ''; }
}

// ============================================================
// TREE ITEM
// ============================================================
function TreeItem({ node, depth, onFileClick, selectedPath }: {
  node: TreeNode; depth: number; onFileClick: (n: TreeNode) => void; selectedPath?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const isDir = node.type === 'directory';
  const isSelected = node.path === selectedPath;
  const Icon = isDir ? (expanded ? FolderOpen : Folder) : getFileIcon(node.name);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctxMenu]);

  return (
    <div>
      <div className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer text-xs transition-colors ${
        isSelected ? 'bg-accent-500/15 text-accent-400' : 'text-surface-300 hover:bg-surface-700/50 hover:text-white'
      }`} style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => { if (isDir) setExpanded(!expanded); else onFileClick(node); }}
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}>
        {isDir ? (expanded ? <ChevronDown className="w-3 h-3 text-surface-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-surface-500 shrink-0" />) : <span className="w-3" />}
        <Icon className={`w-3 h-3 shrink-0 ${isDir ? 'text-amber-400' : 'text-surface-400'}`} />
        <span className="truncate">{node.name}</span>
      </div>
      {ctxMenu && (
        <div className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
          {!isDir && (
            <button onClick={() => { onFileClick(node); setCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:text-white hover:bg-surface-700 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Open file
            </button>
          )}
          {isDir && (
            <button onClick={() => { setExpanded(!expanded); setCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:text-white hover:bg-surface-700 flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5" /> {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <button onClick={() => { navigator.clipboard.writeText(node.path); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:text-white hover:bg-surface-700 flex items-center gap-2">
            <Copy className="w-3.5 h-3.5" /> Copy path
          </button>
        </div>
      )}
      {isDir && expanded && node.children?.map((child) => (
        <TreeItem key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} selectedPath={selectedPath} />
      ))}
    </div>
  );
}
