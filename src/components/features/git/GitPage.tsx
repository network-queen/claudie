import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  Check,
  Plus,
  Minus,
  FileQuestion,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

interface GitFile {
  path: string;
  status: 'staged' | 'unstaged' | 'untracked';
  type?: string;
}

interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  relativeDate: string;
}

interface Branch {
  name: string;
  current: boolean;
}

const apiFetch = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json().then((j) => j.data ?? j);
  });

export default function GitPage() {
  const [projectPath, setProjectPath] = useState('');
  const [projects, setProjects] = useState<{ name: string; path: string }[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showBranches, setShowBranches] = useState(false);

  // Get project path from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get('path');
    if (path) setProjectPath(path);
  }, []);

  // Fetch projects list
  useEffect(() => {
    apiFetch('/api/projects')
      .then((data) => {
        if (Array.isArray(data)) {
          setProjects(data.map((p: any) => ({ name: p.name, path: p.path })));
        }
      })
      .catch(() => {});
  }, []);

  const fetchGitData = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    setError(null);
    try {
      const [branchData, statusData, logData] = await Promise.all([
        apiFetch(`/api/git/branches?path=${encodeURIComponent(projectPath)}`),
        apiFetch(`/api/git/status?path=${encodeURIComponent(projectPath)}`),
        apiFetch(`/api/git/log?path=${encodeURIComponent(projectPath)}`),
      ]);

      if (Array.isArray(branchData)) {
        setBranches(branchData);
        const current = branchData.find((b: Branch) => b.current);
        if (current) setCurrentBranch(current.name);
      }

      if (statusData) {
        const allFiles: GitFile[] = [];
        if (Array.isArray(statusData.staged))
          statusData.staged.forEach((f: any) =>
            allFiles.push({ path: f.path || f, status: 'staged', type: f.type })
          );
        if (Array.isArray(statusData.unstaged))
          statusData.unstaged.forEach((f: any) =>
            allFiles.push({ path: f.path || f, status: 'unstaged', type: f.type })
          );
        if (Array.isArray(statusData.untracked))
          statusData.untracked.forEach((f: any) =>
            allFiles.push({ path: typeof f === 'string' ? f : f.path, status: 'untracked' })
          );
        setFiles(allFiles);
      }

      if (Array.isArray(logData)) {
        setCommits(logData.slice(0, 20));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch git data');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchGitData();
  }, [fetchGitData]);

  const fetchDiff = async (filePath: string) => {
    setSelectedFile(filePath);
    setDiffLoading(true);
    try {
      const data = await apiFetch(
        `/api/git/diff?path=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(filePath)}`
      );
      setDiffContent(typeof data === 'string' ? data : data.diff || JSON.stringify(data, null, 2));
    } catch {
      setDiffContent('Failed to load diff');
    } finally {
      setDiffLoading(false);
    }
  };

  const toggleFileSelect = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const stageAll = async () => {
    try {
      await fetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath, files: ['.'] }),
      });
      fetchGitData();
    } catch {}
  };

  const unstageAll = async () => {
    try {
      await fetch('/api/git/unstage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath, files: ['.'] }),
      });
      fetchGitData();
    } catch {}
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath, message: commitMessage }),
      });
      if (!res.ok) throw new Error('Commit failed');
      setCommitMessage('');
      fetchGitData();
    } catch {
      // error handling
    } finally {
      setCommitting(false);
    }
  };

  const switchBranch = async (branchName: string) => {
    try {
      await fetch('/api/git/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath, branch: branchName }),
      });
      setShowBranches(false);
      fetchGitData();
    } catch {}
  };

  const stagedFiles = files.filter((f) => f.status === 'staged');
  const unstagedFiles = files.filter((f) => f.status === 'unstaged');
  const untrackedFiles = files.filter((f) => f.status === 'untracked');

  const statusIcon = (status: string) => {
    switch (status) {
      case 'staged':
        return <Plus className="w-3.5 h-3.5 text-green-500" />;
      case 'unstaged':
        return <Minus className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <FileQuestion className="w-3.5 h-3.5 text-surface-500" />;
    }
  };

  const renderDiffLine = (line: string, i: number) => {
    let className = 'text-surface-300';
    if (line.startsWith('+') && !line.startsWith('+++')) {
      className = 'text-green-400 bg-green-500/10';
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      className = 'text-red-400 bg-red-500/10';
    } else if (line.startsWith('@@')) {
      className = 'text-accent-400';
    } else if (line.startsWith('diff') || line.startsWith('index')) {
      className = 'text-surface-500';
    }
    return (
      <div key={i} className={`px-4 ${className} font-mono text-xs leading-5`}>
        {line || ' '}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with project selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Git Dashboard</h1>
          <p className="text-surface-400 text-sm mt-1">Manage your repository</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <select
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            className="appearance-none bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500 min-w-[200px]"
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.path} value={p.path}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchGitData}
            disabled={!projectPath || loading}
            className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 disabled:opacity-50 text-surface-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!projectPath && (
        <EmptyState
          icon={<GitBranch className="w-12 h-12" />}
          title="Select a project"
          description="Choose a project from the dropdown to view git status."
        />
      )}

      {projectPath && loading && <LoadingSpinner />}
      {projectPath && error && <ErrorState message={error} onRetry={fetchGitData} />}

      {projectPath && !loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Branch + Status + Commit */}
          <div className="lg:col-span-1 space-y-4">
            {/* Branch info */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-surface-400">Branch</h2>
                <button
                  onClick={() => setShowBranches(!showBranches)}
                  className="text-xs text-accent-400 hover:text-accent-300 transition-colors"
                >
                  {showBranches ? 'Hide' : 'All branches'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-accent-400" />
                <span className="text-xl font-bold text-white font-mono">{currentBranch}</span>
              </div>
              {showBranches && branches.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-700 space-y-1 max-h-40 overflow-y-auto">
                  {branches.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => !b.current && switchBranch(b.name)}
                      disabled={b.current}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                        b.current
                          ? 'text-accent-400 bg-accent-500/10'
                          : 'text-surface-400 hover:text-white hover:bg-surface-700'
                      }`}
                    >
                      {b.current && <Check className="w-3 h-3" />}
                      <span className="font-mono">{b.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Status panel */}
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-surface-400">Changes</h2>
                <div className="flex gap-1.5">
                  <button
                    onClick={stageAll}
                    className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    Stage All
                  </button>
                  <button
                    onClick={unstageAll}
                    className="text-xs px-2 py-0.5 rounded bg-surface-700 text-surface-400 hover:text-white transition-colors"
                  >
                    Unstage All
                  </button>
                </div>
              </div>

              {/* Staged */}
              {stagedFiles.length > 0 && (
                <div>
                  <p className="text-xs text-green-400 mb-1 font-medium">
                    Staged ({stagedFiles.length})
                  </p>
                  {stagedFiles.map((f) => (
                    <FileRow
                      key={`s-${f.path}`}
                      file={f}
                      selected={selectedFile === f.path}
                      checked={selectedFiles.has(f.path)}
                      onToggle={() => toggleFileSelect(f.path)}
                      onClick={() => fetchDiff(f.path)}
                      icon={statusIcon(f.status)}
                    />
                  ))}
                </div>
              )}

              {/* Unstaged */}
              {unstagedFiles.length > 0 && (
                <div>
                  <p className="text-xs text-amber-400 mb-1 font-medium">
                    Unstaged ({unstagedFiles.length})
                  </p>
                  {unstagedFiles.map((f) => (
                    <FileRow
                      key={`u-${f.path}`}
                      file={f}
                      selected={selectedFile === f.path}
                      checked={selectedFiles.has(f.path)}
                      onToggle={() => toggleFileSelect(f.path)}
                      onClick={() => fetchDiff(f.path)}
                      icon={statusIcon(f.status)}
                    />
                  ))}
                </div>
              )}

              {/* Untracked */}
              {untrackedFiles.length > 0 && (
                <div>
                  <p className="text-xs text-surface-500 mb-1 font-medium">
                    Untracked ({untrackedFiles.length})
                  </p>
                  {untrackedFiles.map((f) => (
                    <FileRow
                      key={`n-${f.path}`}
                      file={f}
                      selected={selectedFile === f.path}
                      checked={selectedFiles.has(f.path)}
                      onToggle={() => toggleFileSelect(f.path)}
                      onClick={() => fetchDiff(f.path)}
                      icon={statusIcon(f.status)}
                    />
                  ))}
                </div>
              )}

              {files.length === 0 && (
                <p className="text-xs text-surface-500 text-center py-4">Working tree clean</p>
              )}
            </Card>

            {/* Commit panel */}
            <Card>
              <h2 className="text-sm font-medium text-surface-400 mb-2">Commit</h2>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                rows={3}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500 resize-y"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-surface-500">
                  {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} staged
                </span>
                <button
                  onClick={handleCommit}
                  disabled={committing || !commitMessage.trim() || stagedFiles.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  {committing ? 'Committing...' : 'Commit'}
                </button>
              </div>
            </Card>
          </div>

          {/* Right column: Diff + Log */}
          <div className="lg:col-span-2 space-y-4">
            {/* Diff viewer */}
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-700 flex items-center gap-2">
                <h2 className="text-sm font-medium text-surface-400">Diff</h2>
                {selectedFile && (
                  <span className="text-xs font-mono text-surface-300">{selectedFile}</span>
                )}
              </div>
              <div className="max-h-[400px] overflow-auto">
                {!selectedFile && (
                  <p className="text-surface-500 text-sm text-center py-12">
                    Click a file to view its diff
                  </p>
                )}
                {selectedFile && diffLoading && (
                  <div className="py-8">
                    <LoadingSpinner message="Loading diff..." />
                  </div>
                )}
                {selectedFile && !diffLoading && (
                  <div className="py-2">
                    {diffContent.split('\n').map((line, i) => renderDiffLine(line, i))}
                  </div>
                )}
              </div>
            </Card>

            {/* Recent commits */}
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-700">
                <h2 className="text-sm font-medium text-surface-400">Recent Commits</h2>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-surface-700/50">
                {commits.length === 0 && (
                  <p className="text-surface-500 text-sm text-center py-8">No commits found</p>
                )}
                {commits.map((c) => (
                  <div
                    key={c.hash || c.shortHash}
                    className="px-5 py-3 flex items-start gap-3 hover:bg-surface-700/20 transition-colors"
                  >
                    <code className="text-xs text-accent-400 font-mono bg-accent-500/10 px-1.5 py-0.5 rounded shrink-0">
                      {c.shortHash}
                    </code>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{c.message}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {c.author} &middot; {c.relativeDate || c.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function FileRow({
  file,
  selected,
  checked,
  onToggle,
  onClick,
  icon,
}: {
  file: GitFile;
  selected: boolean;
  checked: boolean;
  onToggle: () => void;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
        selected ? 'bg-surface-700' : 'hover:bg-surface-700/50'
      }`}
      onClick={onClick}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-900 text-accent-500 shrink-0"
      />
      {icon}
      <span className="font-mono text-surface-300 truncate">{file.path}</span>
    </div>
  );
}
