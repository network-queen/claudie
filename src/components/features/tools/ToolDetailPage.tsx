import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Lightbulb } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getToolById } from '@/lib/api';
import Badge from '@/components/shared/Badge';
import Card from '@/components/shared/Card';
import CodeBlock from '@/components/shared/CodeBlock';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';

export default function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useApi(() => getToolById(id!), [id]);

  const tool: any = data as any;

  if (loading) return <LoadingSpinner message="Loading tool details..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!tool) return <ErrorState message="Tool not found" />;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        to="/tools"
        className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tools
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">{tool.name}</h1>
          <Badge variant="accent">{tool.category}</Badge>
        </div>
        <p className="text-surface-300">{tool.description}</p>
      </div>

      {/* When to use / When NOT to use */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tool.whenToUse && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-4 h-4 text-green-400" />
              <h3 className="font-semibold text-white">When to use</h3>
            </div>
            <ul className="space-y-1.5">
              {(Array.isArray(tool.whenToUse) ? tool.whenToUse : [tool.whenToUse]).map(
                (item: string, i: number) => (
                  <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">+</span>
                    {item}
                  </li>
                )
              )}
            </ul>
          </Card>
        )}
        {tool.whenNotToUse && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <X className="w-4 h-4 text-red-400" />
              <h3 className="font-semibold text-white">When NOT to use</h3>
            </div>
            <ul className="space-y-1.5">
              {(Array.isArray(tool.whenNotToUse) ? tool.whenNotToUse : [tool.whenNotToUse]).map(
                (item: string, i: number) => (
                  <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">-</span>
                    {item}
                  </li>
                )
              )}
            </ul>
          </Card>
        )}
      </div>

      {/* Parameters table */}
      {tool.parameters && tool.parameters.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Parameters</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Required</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {tool.parameters.map((param: any, i: number) => (
                  <tr key={i} className="border-b border-surface-700/50">
                    <td className="py-2 px-3 font-mono text-accent-400">{param.name}</td>
                    <td className="py-2 px-3 text-surface-300">{param.type}</td>
                    <td className="py-2 px-3">
                      {param.required ? (
                        <span className="text-amber-400 text-xs font-medium">Required</span>
                      ) : (
                        <span className="text-surface-500 text-xs">Optional</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-surface-300">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage examples */}
      {tool.examples && tool.examples.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Usage Examples</h2>
          <div className="space-y-4">
            {tool.examples.map((example: any, i: number) => (
              <div key={i}>
                {example.title && (
                  <h4 className="font-medium text-white mb-1">{example.title}</h4>
                )}
                {example.description && (
                  <p className="text-sm text-surface-400 mb-2">{example.description}</p>
                )}
                <CodeBlock code={example.code ?? example.content ?? ''} title={example.title} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {tool.tips && tool.tips.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-white">Tips</h3>
          </div>
          <ul className="space-y-2">
            {tool.tips.map((tip: string, i: number) => (
              <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">*</span>
                {tip}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Related tools */}
      {tool.relatedTools && tool.relatedTools.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Related Tools</h2>
          <div className="flex flex-wrap gap-2">
            {tool.relatedTools.map((related: any, i: number) => {
              const relId = typeof related === 'string' ? related : related.id;
              const relName = typeof related === 'string' ? related : related.name;
              return (
                <Link
                  key={i}
                  to={`/tools/${relId}`}
                  className="px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-sm text-accent-400 hover:border-accent-500/50 transition-colors"
                >
                  {relName}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
