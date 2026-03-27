import { useState, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  GitBranch,
  FileText,
  X,
  Calendar,
  FolderOpen,
  Trash2,
  Trophy,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Download,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

interface Project {
  name: string;
  path: string;
  hasGit: boolean;
  branch?: string;
  commitCount?: number;
  hasClaudeMd: boolean;
  lastModified?: string;
}


export default function ProjectsPage() {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneDir, setCloneDir] = useState('~/claudie-projects');
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    parentDir: '~/claudie-projects',
    description: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFromGit, setDeleteFromGit] = useState(false);

  const { data, loading, error, refetch } = useApi<Project[]>(() =>
    fetch('/api/projects').then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    })
  );

  const projects: Project[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProject.name,
          parentDir: newProject.parentDir,
          initGit: true,
          createGitignore: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Error ${res.status}`);
      }
      const createdPath = body.data?.path;
      if (createdPath) {
        // If user provided a description, create an initial task for Claude to generate CLAUDE.md
        if (newProject.description.trim()) {
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project: createdPath,
              title: `Project idea: ${newProject.description.trim()}\n\nBefore building anything, ask me 2-3 short clarifying questions about the project to make sure you understand what I want. After I answer, create a CLAUDE.md with project conventions and then implement a working first version.`,
            }),
          }).catch(() => {});
        }
        window.location.href = `/project?path=${encodeURIComponent(createdPath)}`;
        return;
      }

      setShowNewDialog(false);
      setNewProject({
        name: '',
        parentDir: '~/claudie-projects',
        description: '',
      });
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/projects/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: deleteTarget.path, deleteFromGit }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      // Remove from open projects in sidebar
      try {
        const openProjects = JSON.parse(localStorage.getItem('claudie-open-projects') || '[]');
        const updated = openProjects.filter((p: any) => p.path !== deleteTarget.path);
        localStorage.setItem('claudie-open-projects', JSON.stringify(updated));
      } catch {}
      setDeleteTarget(null);
      setDeleteFromGit(false);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  const handleClone = async () => {
    if (!cloneUrl.trim()) return;
    setCloning(true);
    setCloneError(null);
    try {
      const res = await fetch('/api/projects/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cloneUrl.trim(), parentDir: cloneDir }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Clone failed');
      const clonedPath = body.data?.path;
      if (clonedPath) {
        // Create a task for Claude to explore and create CLAUDE.md
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: clonedPath,
            title: 'Explore this codebase thoroughly — read the key files, understand the architecture, tech stack, and conventions. Then create a comprehensive CLAUDE.md with your findings.',
          }),
        }).catch(() => {});
        window.location.href = `/project?path=${encodeURIComponent(clonedPath)}`;
        return;
      }
      setShowCloneDialog(false);
      setCloneUrl('');
      refetch();
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-surface-400 text-sm mt-1">
            Manage your development projects
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCloneDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white text-sm rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Clone
          </button>
          <button onClick={() => setShowNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon={<FolderGit2 className="w-12 h-12" />}
          title="No projects found"
          description="Create a new project or make sure the API is running."
        />
      )}

      {/* Project tree grouped by folder */}
      {!loading && !error && projects.length > 0 && (
        <ProjectTree projects={projects} onDelete={(p) => setDeleteTarget(p)} />
      )}

      {/* New Project Dialog */}
      {showNewDialog && <NewProjectDialog
        onClose={() => setShowNewDialog(false)}
        onCreate={handleCreate}
        creating={creating}
        createError={createError}
        newProject={newProject}
        setNewProject={setNewProject}
      />}

      {/* Completed Projects */}
      <CompletedProjects />

      {/* Clone Dialog */}
      {showCloneDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-surface-700">
              <h2 className="text-lg font-semibold text-white">Clone Project</h2>
              <button onClick={() => { setShowCloneDialog(false); setCloneError(null); }}
                className="p-1 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-surface-400 mb-1">Repository URL</label>
                <input type="text" value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-surface-500 focus:outline-none focus:border-accent-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Clone into</label>
                <div className="relative">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="text" value={cloneDir}
                    onChange={(e) => setCloneDir(e.target.value)}
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                </div>
              </div>
              <p className="text-xs text-surface-500">Claude will explore the codebase and create a CLAUDE.md after cloning.</p>
              {cloneError && <p className="text-sm text-red-400">{cloneError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button onClick={() => { setShowCloneDialog(false); setCloneError(null); }}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleClone} disabled={cloning || !cloneUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                {cloning ? 'Cloning...' : 'Clone & Explore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h2 className="text-lg font-semibold">Delete Project</h2>
              </div>
              <p className="text-sm text-surface-300">
                This will <span className="text-red-400 font-medium">permanently delete</span> the
                entire project folder and all its contents:
              </p>
              <div className="bg-surface-900 rounded-lg px-3 py-2 font-mono text-sm text-surface-300 break-all">
                {deleteTarget.path}
              </div>
              {deleteTarget.hasGit && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={deleteFromGit}
                    onChange={(e) => setDeleteFromGit(e.target.checked)}
                    className="w-4 h-4 rounded border-surface-600 bg-surface-900 text-red-500" />
                  <span className="text-sm text-surface-300">Also delete GitHub repository</span>
                </label>
              )}
              <p className="text-xs text-surface-500">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteFromGit(false); }}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PROJECT_TEMPLATES = [
  { id: 'blank', name: 'Blank', description: '' },
  { id: 'react-ts', name: 'React + TypeScript', description: 'React app with TypeScript, Vite, and Tailwind CSS' },
  { id: 'node-api', name: 'Node.js API', description: 'Express REST API with TypeScript' },
  { id: 'static', name: 'Static Website', description: 'Simple HTML/CSS/JS website' },
  { id: 'python-cli', name: 'Python CLI', description: 'Python command-line tool with argparse' },
  { id: 'chrome-ext', name: 'Chrome Extension', description: 'Chrome browser extension with popup and content script' },
];

function NewProjectDialog({ onClose, onCreate, creating, createError, newProject, setNewProject }: {
  onClose: () => void;
  onCreate: () => void;
  creating: boolean;
  createError: string | null;
  newProject: { name: string; parentDir: string; description: string };
  setNewProject: (p: any) => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState('blank');

  const handleTemplateSelect = (template: typeof PROJECT_TEMPLATES[number]) => {
    setSelectedTemplate(template.id);
    if (template.description) {
      setNewProject({ ...newProject, description: template.description });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-surface-400 mb-1">Project Name</label>
            <input type="text" value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              placeholder="my-awesome-project"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500" />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Parent Directory</label>
            <div className="relative">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input type="text" value={newProject.parentDir}
                onChange={(e) => setNewProject({ ...newProject, parentDir: e.target.value })}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
            </div>
          </div>
          {/* Template selector */}
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Template</label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {PROJECT_TEMPLATES.map((tpl) => (
                <button key={tpl.id} onClick={() => handleTemplateSelect(tpl)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg border text-left transition-colors ${
                    selectedTemplate === tpl.id
                      ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                      : 'border-surface-700 bg-surface-900 text-surface-300 hover:border-surface-600 hover:text-white'
                  }`}>
                  <span className="text-xs font-medium block whitespace-nowrap">{tpl.name}</span>
                  {tpl.description && (
                    <span className="text-[10px] text-surface-500 block mt-0.5 whitespace-nowrap">{tpl.description.slice(0, 30)}...</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Describe the project</label>
            <textarea value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              rows={4}
              placeholder="e.g. I want to build a simple app where people can share their favorite book quotes with friends. Users should be able to sign up, post quotes, and like other people's quotes."
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500 resize-y" />
          </div>
          {createError && <p className="text-sm text-red-400">{createError}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={onCreate} disabled={creating || !newProject.name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedProjects() {
  const [expanded, setExpanded] = useState(false);
  const [taskStats, setTaskStats] = useState<Record<string, { total: number; closed: number; timeMs: number }>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  let completed: { path: string; name: string; completedAt: string }[] = [];
  try { completed = JSON.parse(localStorage.getItem('claudie-completed-projects') || '[]'); } catch {}

  // Fetch task stats for completed projects when expanded
  useEffect(() => {
    if (!expanded || completed.length === 0) return;
    (async () => {
      const stats: Record<string, { total: number; closed: number; timeMs: number }> = {};
      for (const p of completed) {
        try {
          const res = await fetch(`/api/tasks?project=${encodeURIComponent(p.path)}`);
          const data = await res.json();
          const tasks = data.data ?? [];
          const closed = tasks.filter((t: any) => t.status === 'closed').length;
          const timeMs = tasks.reduce((sum: number, t: any) => {
            if (t.startedAt && t.closedAt) return sum + (new Date(t.closedAt).getTime() - new Date(t.startedAt).getTime());
            return sum;
          }, 0);
          stats[p.path] = { total: tasks.length, closed, timeMs };
        } catch {}
      }
      setTaskStats(stats);
    })();
  }, [expanded]);

  if (completed.length === 0) return null;

  return (
    <div className="mt-4">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors">
        {expanded
          ? <ChevronDown className="w-4 h-4 text-surface-500 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-surface-500 shrink-0" />}
        <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm text-surface-300">Completed</span>
        <span className="text-xs text-surface-600 ml-1">{completed.length}</span>
      </button>
      {expanded && (
        <div className="ml-6 border-l border-surface-700/50 pl-2 space-y-0.5 mb-2">
          {completed.map((p) => (
            <div key={p.path} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-surface-500 min-w-0 group">
              <Trophy className="w-3.5 h-3.5 text-emerald-500/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-surface-400">{p.name}</span>
                  <span className="text-[10px] text-surface-600">
                    {new Date(p.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {(p as any).remote && (
                    <a href={(p as any).remote.replace(/\.git$/, '')} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[9px] text-accent-400 hover:underline font-mono">GitHub</a>
                  )}
                </div>
                {taskStats[p.path] && taskStats[p.path].total > 0 && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-emerald-500/60">{taskStats[p.path].closed}/{taskStats[p.path].total} tasks</span>
                    {taskStats[p.path].timeMs > 0 && (
                      <span className="text-[9px] text-surface-600">{formatDurationMs(taskStats[p.path].timeMs)}</span>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setDeleteTarget({ path: p.path, name: p.name })}
                className="p-1 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Delete completed project confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h2 className="text-lg font-semibold">Delete Completed Project</h2>
              </div>
              <p className="text-sm text-surface-300">
                This will <span className="text-red-400 font-medium">permanently delete</span> the
                project folder and its GitHub repository:
              </p>
              <div className="bg-surface-900 rounded-lg px-3 py-2 font-mono text-sm text-surface-300 break-all">
                {deleteTarget.name} — {deleteTarget.path}
              </div>
              <p className="text-xs text-surface-500">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={async () => {
                setDeleting(true);
                try {
                  // Delete from filesystem + git
                  await fetch('/api/projects/remove', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: deleteTarget.path, deleteFromGit: true }),
                  });
                  // Remove from completed list
                  const updated = completed.filter((c) => c.path !== deleteTarget.path);
                  localStorage.setItem('claudie-completed-projects', JSON.stringify(updated));
                } catch {} finally { setDeleting(false); }
                setDeleteTarget(null);
                window.location.reload();
              }} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectTree({ projects, onDelete }: { projects: Project[]; onDelete: (p: Project) => void }) {
  // Group projects by parent folder
  const grouped: Record<string, Project[]> = {};
  for (const p of projects) {
    const parent = p.path.split('/').slice(0, -1).join('/');
    const shortParent = parent.replace(/^\/Users\/[^/]+/, '~');
    if (!grouped[shortParent]) grouped[shortParent] = [];
    grouped[shortParent].push(p);
  }

  const folders = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-1">
      {folders.map((folder) => (
        <FolderGroup key={folder} folder={folder} projects={grouped[folder]} onDelete={onDelete} />
      ))}
    </div>
  );
}

function FolderGroup({ folder, projects, onDelete }: { folder: string; projects: Project[]; onDelete: (p: Project) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors group"
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-surface-500 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-surface-500 shrink-0" />}
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm text-surface-300 font-mono">{folder}</span>
        <span className="text-xs text-surface-600 ml-1">{projects.length}</span>
      </button>
      {expanded && (
        <div className="ml-6 border-l border-surface-700/50 pl-2 space-y-0.5 mb-2">
          {projects.map((project) => (
            <div key={project.path} className="flex items-center group">
              <a
                href={`/project?path=${encodeURIComponent(project.path)}`}
                className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors min-w-0"
              >
                <FolderGit2 className="w-4 h-4 text-accent-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium">{project.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {project.hasGit && project.branch && (
                      <span className="flex items-center gap-1 text-[10px] text-accent-400">
                        <GitBranch className="w-3 h-3" />{project.branch}
                      </span>
                    )}
                    {project.hasGit && !!project.commitCount && (
                      <span className="text-[10px] text-surface-500">{project.commitCount} commits</span>
                    )}
                    {project.hasClaudeMd && (
                      <span className="text-[10px] text-surface-500">CLAUDE.md</span>
                    )}
                    {project.lastModified && (
                      <span className="text-[10px] text-surface-600">{relativeDate(project.lastModified)}</span>
                    )}
                  </div>
                </div>
              </a>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(project); }}
                className="p-1.5 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function relativeDate(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatDurationMs(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function Play(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}
