import { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Zap, X, Check, AlertTriangle, FileText, Download, Sparkles, Loader2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import Card from '@/components/shared/Card';
import SearchInput from '@/components/shared/SearchInput';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

interface Skill {
  name: string;
  filename: string;
  content: string;
  path: string;
}

function Notification({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
      type === 'success'
        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
      {type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {text}
    </div>
  );
}

const NEW_SKILL_TEMPLATE = `Describe what this skill should do.

You can use markdown to structure instructions for Claude.

## Steps
1.
2.

## Rules
-
`;

export default function SkillsPage() {
  const { data, loading, error, refetch } = useApi(() =>
    fetch('/api/skills').then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json().then((j) => j.data ?? j);
    })
  );

  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState(NEW_SKILL_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genName, setGenName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genPreview, setGenPreview] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (data) setSkills(Array.isArray(data) ? data : []);
  }, [data]);

  const filtered = skills.filter((skill) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return skill.name.toLowerCase().includes(q) || skill.content.toLowerCase().includes(q);
  });

  const notify = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async (skill: Skill) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSkills((prev) =>
        prev.map((s) => (s.path === skill.path ? { ...s, content: editContent } : s))
      );
      setEditingId(null);
      notify('success', `Saved /${skill.name}`);
    } catch {
      notify('error', 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (skill: Skill) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setSkills((prev) => prev.filter((s) => s.path !== skill.path));
      notify('success', `Deleted /${skill.name}`);
    } catch {
      notify('error', 'Failed to delete');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(newName.trim())}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });
      if (!res.ok) throw new Error('Create failed');
      setShowNew(false);
      setNewName('');
      setNewContent(NEW_SKILL_TEMPLATE);
      refetch();
      notify('success', `Created /${newName.trim()}`);
    } catch {
      notify('error', 'Failed to create skill');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (skill: Skill) => {
    setEditingId(skill.path);
    setEditContent(skill.content);
  };

  const handleInstallFromUrl = async () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    try {
      const res = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: installUrl.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Install failed');
      }
      setShowInstall(false);
      setInstallUrl('');
      refetch();
      notify('success', 'Skill installed');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
    }
  };

  const handleGenerate = async () => {
    if (!genPrompt.trim() || !genName.trim()) return;
    setGenerating(true);
    setGenPreview('');
    try {
      const res = await fetch('/api/claude/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a technical writer. DO NOT use any tools. DO NOT write any files. DO NOT execute any commands. ONLY output text.

Write the markdown content for a Claude Code custom slash command skill. Just output the raw markdown text, nothing else.

Skill name: ${genName.trim()}
Description from user: "${genPrompt.trim()}"

Use this exact format:

---
name: ${genName.trim()}
description: (one sentence about what this skill does)
---

(Detailed instructions for Claude when /${genName.trim()} is invoked. Include: what to do step by step, rules to follow, what to avoid. Be specific and production-quality.)

Remember: output ONLY the markdown text. No code fences. No explanations. No file operations.`,
        }),
      });
      const data = await res.json();
      const content = data.data?.response || '';
      if (content) {
        setGenPreview(content);
      } else {
        notify('error', 'No response from Claude');
      }
    } catch {
      notify('error', 'Failed to generate skill');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!genPreview || !genName.trim()) return;
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(genName.trim())}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: genPreview }),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowGenerate(false);
      setGenPrompt('');
      setGenName('');
      setGenPreview('');
      refetch();
      notify('success', `Created /${genName.trim()}`);
    } catch {
      notify('error', 'Failed to save skill');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Skills</h1>
          <p className="text-surface-400 text-sm mt-1">
            Custom skills — <code className="text-accent-400">.md</code> files that become <code className="text-accent-400">/slash</code> skills in Claude Code
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowGenerate(!showGenerate); setShowInstall(false); setShowNew(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-sm rounded-lg transition-colors">
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </button>
          <button onClick={() => { setShowInstall(!showInstall); setShowGenerate(false); setShowNew(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white text-sm rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Install from URL
          </button>
          <button onClick={() => { setShowNew(!showNew); setShowGenerate(false); setShowInstall(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Skill
          </button>
        </div>
      </div>

      {notification && <Notification type={notification.type} text={notification.text} />}

      {/* Install from URL */}
      {showInstall && (
        <Card className="space-y-3">
          <h3 className="text-sm font-medium text-white">Install Skill from URL</h3>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Skill URL</label>
            <input type="text" value={installUrl}
              onChange={(e) => setInstallUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstallFromUrl()}
              placeholder="https://skills.sh/anthropics/skills/frontend-design"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-surface-500 focus:outline-none focus:border-accent-500" />
            <p className="text-xs text-surface-500 mt-1">Paste a URL to a skill's raw markdown or a skills.sh page</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowInstall(false)} className="px-3 py-1.5 text-xs text-surface-400 hover:text-white rounded-md">Cancel</button>
            <button onClick={handleInstallFromUrl} disabled={installing || !installUrl.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
              <Download className="w-3.5 h-3.5" />
              {installing ? 'Installing...' : 'Install'}
            </button>
          </div>
        </Card>
      )}

      {/* Generate with AI */}
      {showGenerate && (
        <Card className="space-y-3">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> Generate Skill with AI
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Skill Name</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-accent-400 text-sm font-mono">/</span>
                <input type="text" value={genName}
                  onChange={(e) => setGenName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="my-skill"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-6 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-accent-500" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-surface-400 mb-1">Describe what this skill should do</label>
              <input type="text" value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && genName.trim() && genPrompt.trim() && handleGenerate()}
                placeholder="e.g. Review code for security vulnerabilities and suggest fixes"
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-accent-500" />
            </div>
          </div>

          {!genPreview && (
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowGenerate(false)} className="px-3 py-1.5 text-xs text-surface-400 hover:text-white rounded-md">Cancel</button>
              <button onClick={handleGenerate} disabled={generating || !genName.trim() || !genPrompt.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
                {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
              </button>
            </div>
          )}

          {genPreview && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-surface-400 mb-1">Preview — edit if needed</label>
                <textarea value={genPreview}
                  onChange={(e) => setGenPreview(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 font-mono focus:outline-none focus:border-accent-500 resize-y"
                  style={{ tabSize: 2 }} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={handleGenerate} disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 text-white text-xs rounded-md transition-colors">
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Regenerate
                </button>
                <button onClick={handleSaveGenerated}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-md transition-colors">
                  <Save className="w-3.5 h-3.5" /> Save as /{genName}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Create form */}
      {showNew && (
        <Card className="space-y-3">
          <h3 className="text-sm font-medium text-white">New Skill</h3>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Skill Name</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-400 text-sm font-mono">/</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                placeholder="my-skill"
                className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-accent-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Skill Prompt (markdown)</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 font-mono focus:outline-none focus:border-accent-500 resize-y"
              style={{ tabSize: 2 }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-xs text-surface-400 hover:text-white rounded-md">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
            >
              {saving ? 'Creating...' : 'Create Skill'}
            </button>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search skills..." />
        <span className="text-xs text-surface-500">
          {filtered.length} skill{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && skills.length === 0 && !showNew && (
        <EmptyState
          icon={<Zap className="w-12 h-12" />}
          title="No skills yet"
          description="Create your first skill — a markdown file that becomes a /slash-skill in Claude Code."
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((skill) => (
            <Card key={skill.path} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent-400" />
                  <span className="font-mono text-sm text-accent-400 font-medium">/{skill.name}</span>
                </div>
                <div className="flex gap-1.5">
                  {editingId === skill.path ? (
                    <>
                      <button
                        onClick={() => handleSave(skill)}
                        disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 text-xs rounded-md transition-colors"
                      >
                        <Save className="w-3 h-3" />
                        {saving ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-2.5 py-1 text-surface-400 hover:text-white text-xs rounded-md transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(skill)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-surface-700/50 text-surface-300 hover:text-white text-xs rounded-md transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(skill)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs rounded-md transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editingId === skill.path ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 font-mono focus:outline-none focus:border-accent-500 resize-y"
                  style={{ tabSize: 2 }}
                />
              ) : (
                <div className="bg-surface-900 rounded-lg px-3 py-2 text-xs text-surface-400 font-mono max-h-24 overflow-hidden relative">
                  <pre className="whitespace-pre-wrap">{skill.content.slice(0, 300)}{skill.content.length > 300 ? '...' : ''}</pre>
                  {skill.content.length > 200 && (
                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-900 to-transparent" />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h2 className="text-lg font-semibold">Delete Skill</h2>
              </div>
              <p className="text-sm text-surface-300">
                Delete <code className="text-accent-400 font-mono">/{deleteTarget.name}</code>? This removes the file from <code className="text-surface-400 font-mono">~/.claude/commands/</code>.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-surface-700">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-surface-300 hover:text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => { handleDelete(deleteTarget); setDeleteTarget(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
