import { useState, useEffect, useCallback } from 'react';
import {
  FolderTree,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  Save,
  Trash2,
  FileJson,
  FileCode,
  FileText,
  FileType,
  X,
} from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

const fileIcons: Record<string, typeof File> = {
  '.ts': FileCode,
  '.tsx': FileCode,
  '.js': FileCode,
  '.jsx': FileCode,
  '.json': FileJson,
  '.md': FileText,
  '.txt': FileText,
};

function getFileIcon(name: string) {
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  return fileIcons[ext] || FileType;
}

export default function ExplorerPage() {
  const [rootPath, setRootPath] = useState('');
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<{ path: string; name: string; content: string } | null>(
    null
  );
  const [fileContent, setFileContent] = useState('');
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode;
  } | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{
    type: 'file' | 'folder';
    parentPath: string;
  } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Get path from URL params or projects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get('path');
    if (path) setRootPath(path);
  }, []);

  const fetchTree = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/files/tree?path=${encodeURIComponent(rootPath)}`
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setTree(Array.isArray(data) ? data : data.children || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file tree');
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const openFileContent = async (node: TreeNode) => {
    try {
      const res = await fetch(
        `/api/files/read?path=${encodeURIComponent(node.path)}`
      );
      if (!res.ok) throw new Error(`Failed to read file`);
      const data = await res.json();
      const content = typeof data === 'string' ? data : data.content || '';
      setOpenFile({ path: node.path, name: node.name, content });
      setFileContent(content);
      setUnsaved(false);
      setSaveMessage(null);
    } catch {
      setOpenFile({ path: node.path, name: node.name, content: '// Failed to read file' });
      setFileContent('// Failed to read file');
    }
  };

  const handleSave = async () => {
    if (!openFile) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: openFile.path, content: fileContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      setUnsaved(false);
      setOpenFile({ ...openFile, content: fileContent });
      setSaveMessage({ type: 'success', text: 'Saved' });
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (path: string) => {
    // confirm handled by context menu caller
    try {
      await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (openFile?.path === path) {
        setOpenFile(null);
        setFileContent('');
      }
      fetchTree();
    } catch {}
    setContextMenu(null);
  };

  const handleCreateItem = async () => {
    if (!newItemDialog || !newItemName.trim()) return;
    try {
      const fullPath = `${newItemDialog.parentPath}/${newItemName}`;
      if (newItemDialog.type === 'file') {
        await fetch('/api/files/write', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath, content: '' }),
        });
      } else {
        await fetch('/api/files/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath }),
        });
      }
      setNewItemDialog(null);
      setNewItemName('');
      fetchTree();
    } catch {}
  };

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (unsaved && openFile) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [unsaved, openFile, fileContent]);

  const breadcrumb = openFile
    ? openFile.path
        .replace(rootPath, '')
        .split('/')
        .filter(Boolean)
    : [];

  return (
    <div className="flex flex-col h-screen">
      {/* Actions bar */}
      <div className="bg-surface-800 border-b border-surface-700 px-4 py-2 flex items-center gap-3">
        <FolderTree className="w-4 h-4 text-surface-500" />
        <input
          type="text"
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchTree()}
          placeholder="Enter project path..."
          className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500"
        />
        <button
          onClick={() =>
            rootPath &&
            setNewItemDialog({ type: 'file', parentPath: rootPath })
          }
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-surface-300 hover:text-white bg-surface-700 hover:bg-surface-600 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          File
        </button>
        <button
          onClick={() =>
            rootPath &&
            setNewItemDialog({ type: 'folder', parentPath: rootPath })
          }
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-surface-300 hover:text-white bg-surface-700 hover:bg-surface-600 rounded-md transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          Folder
        </button>
        {openFile && (
          <span className="text-xs text-surface-500 font-mono truncate max-w-[300px]">
            {openFile.path}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: File tree */}
        <div className="w-64 lg:w-72 bg-surface-800 border-r border-surface-700 overflow-y-auto shrink-0">
          {!rootPath && (
            <div className="p-4 text-center text-surface-500 text-sm">
              Enter a path to browse
            </div>
          )}
          {loading && (
            <div className="p-4">
              <LoadingSpinner message="Loading..." />
            </div>
          )}
          {error && (
            <div className="p-4">
              <ErrorState message={error} onRetry={fetchTree} />
            </div>
          )}
          {!loading && !error && rootPath && tree.length === 0 && (
            <div className="p-4 text-center text-surface-500 text-sm">Empty directory</div>
          )}
          {!loading && !error && tree.length > 0 && (
            <div className="py-1">
              {tree.map((node) => (
                <TreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  onFileClick={openFileContent}
                  onContextMenu={(e, n) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY, node: n });
                  }}
                  selectedPath={openFile?.path}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-surface-900">
          {!openFile && (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<File className="w-12 h-12" />}
                title="No file open"
                description="Select a file from the tree to view and edit it."
              />
            </div>
          )}
          {openFile && (
            <>
              {/* Breadcrumb + save */}
              <div className="bg-surface-800 border-b border-surface-700 px-4 py-2 flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-surface-500 flex-1 min-w-0 overflow-hidden">
                  {breadcrumb.map((part, i) => (
                    <span key={i} className="flex items-center gap-1 shrink-0">
                      {i > 0 && <span className="text-surface-600">/</span>}
                      <span className={i === breadcrumb.length - 1 ? 'text-white' : ''}>
                        {part}
                      </span>
                    </span>
                  ))}
                  {unsaved && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 ml-2 shrink-0" />
                  )}
                </div>
                {saveMessage && (
                  <span
                    className={`text-xs ${
                      saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {saveMessage.text}
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !unsaved}
                  className="flex items-center gap-1 px-3 py-1 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-auto relative">
                <div className="flex min-h-full">
                  {/* Line numbers */}
                  <div className="shrink-0 bg-surface-800/50 text-surface-600 text-xs font-mono text-right select-none py-3 px-2 leading-5 border-r border-surface-700">
                    {fileContent.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  {/* Textarea */}
                  <textarea
                    value={fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value);
                      setUnsaved(e.target.value !== openFile.content);
                    }}
                    spellCheck={false}
                    className="flex-1 bg-transparent text-surface-200 text-sm font-mono p-3 leading-5 resize-none focus:outline-none min-h-full"
                    style={{ tabSize: 2 }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'directory' && (
            <>
              <button
                onClick={() => {
                  setNewItemDialog({ type: 'file', parentPath: contextMenu.node.path });
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:text-white hover:bg-surface-700 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                New File
              </button>
              <button
                onClick={() => {
                  setNewItemDialog({ type: 'folder', parentPath: contextMenu.node.path });
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:text-white hover:bg-surface-700 flex items-center gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New Folder
              </button>
            </>
          )}
          <button
            onClick={() => handleDelete(contextMenu.node.path)}
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-surface-700 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* New item dialog */}
      {newItemDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-surface-700">
              <h3 className="text-sm font-semibold text-white">
                New {newItemDialog.type === 'file' ? 'File' : 'Folder'}
              </h3>
              <button
                onClick={() => {
                  setNewItemDialog(null);
                  setNewItemName('');
                }}
                className="p-1 rounded hover:bg-surface-700 text-surface-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()}
                placeholder={newItemDialog.type === 'file' ? 'filename.ts' : 'folder-name'}
                autoFocus
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500"
              />
              <p className="text-xs text-surface-500 font-mono truncate">
                {newItemDialog.parentPath}/{newItemName || '...'}
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-surface-700">
              <button
                onClick={() => {
                  setNewItemDialog(null);
                  setNewItemName('');
                }}
                className="px-3 py-1.5 text-xs text-surface-400 hover:text-white rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateItem}
                disabled={!newItemName.trim()}
                className="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-xs rounded-md transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  onFileClick,
  onContextMenu,
  selectedPath,
}: {
  node: TreeNode;
  depth: number;
  onFileClick: (node: TreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  selectedPath?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === 'directory';
  const isSelected = node.path === selectedPath;
  const Icon = isDir ? (expanded ? FolderOpen : Folder) : getFileIcon(node.name);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs transition-colors ${
          isSelected
            ? 'bg-accent-500/15 text-accent-400'
            : 'text-surface-300 hover:bg-surface-700/50 hover:text-white'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onFileClick(node);
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {isDir ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-surface-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-surface-500 shrink-0" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <Icon
          className={`w-3.5 h-3.5 shrink-0 ${
            isDir ? 'text-amber-400' : 'text-surface-400'
          }`}
        />
        <span className="truncate">{node.name}</span>
      </div>
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
