export interface NavItem {
  path: string;
  label: string;
  icon: string;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard', description: 'Overview & stats' },
  { path: '/tools', label: 'Tools', icon: 'Wrench', description: 'Built-in tools reference' },
  { path: '/skills', label: 'Skills', icon: 'Sparkles', description: 'Slash commands & skills' },
  { path: '/mcp', label: 'MCP Servers', icon: 'Server', description: 'Model Context Protocol servers' },
  { path: '/patterns', label: 'Patterns', icon: 'FileCode2', description: 'Prompt patterns & templates' },
  { path: '/shortcuts', label: 'Shortcuts', icon: 'Keyboard', description: 'Keyboard shortcuts' },
  { path: '/config', label: 'Config', icon: 'Settings', description: 'Configuration reference' },
  { path: '/tips', label: 'Tips', icon: 'Lightbulb', description: 'Tips & best practices' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  tool: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  skill: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pattern: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  shortcut: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  config: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  tip: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  mcp: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  default: 'bg-surface-600/20 text-surface-300 border-surface-500/30',
};

export const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', color: '#d97706' },
  { id: 'openai', label: 'OpenAI', color: '#10b981' },
  { id: 'custom', label: 'Custom', color: '#6366f1' },
] as const;
