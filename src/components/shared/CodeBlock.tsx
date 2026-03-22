import CopyButton from './CopyButton';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export default function CodeBlock({ code, language, title }: CodeBlockProps) {
  return (
    <div className="relative bg-surface-900 border border-surface-700 rounded-lg overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700 bg-surface-800/50">
          <span className="text-xs text-surface-400 font-mono">{title}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!title && (
        <div className="absolute top-2 right-2">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className={`text-surface-200 font-mono ${language ? `language-${language}` : ''}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
