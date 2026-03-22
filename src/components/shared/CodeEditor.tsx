import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';

function getLang(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'js': case 'jsx': case 'mjs': return javascript();
    case 'ts': case 'tsx': case 'mts': return javascript({ typescript: true, jsx: ext.includes('x') });
    case 'html': case 'htm': case 'svelte': case 'vue': return html();
    case 'css': case 'scss': case 'less': return css();
    case 'json': case 'jsonc': return json();
    case 'md': case 'mdx': return markdown();
    case 'py': case 'pyw': return python();
    case 'rs': return rust();
    case 'java': case 'kt': case 'scala': return java();
    case 'c': case 'cpp': case 'cc': case 'h': case 'hpp': return cpp();
    default: return javascript(); // fallback
  }
}

const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#0f0f14', height: '100%' },
  '.cm-gutters': { backgroundColor: '#1a1a24', color: '#4a4a5a', border: 'none', borderRight: '1px solid #2a2a3a' },
  '.cm-activeLineGutter': { backgroundColor: '#2a2a3a' },
  '.cm-activeLine': { backgroundColor: '#1a1a2410' },
  '.cm-cursor': { borderLeftColor: '#7c3aed' },
  '.cm-selectionBackground': { backgroundColor: '#7c3aed40 !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#7c3aed40 !important' },
  '.cm-content': { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: '1.6' },
  '.cm-gutters .cm-gutter': { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' },
});

interface CodeEditorProps {
  value: string;
  filename: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ value, filename, onChange, readOnly = false }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        getLang(filename),
        oneDark,
        darkTheme,
        updateListener,
        EditorView.lineWrapping,
        EditorState.readOnly.of(readOnly),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filename]); // Recreate when filename changes (different language)

  // Update content when value changes externally (e.g. file switch)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="h-full overflow-auto" />;
}
