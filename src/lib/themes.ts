export interface Theme {
  id: string;
  name: string;
  bg: string;
  card: string;
  border: string;
  accent: string;
  accentLight: string;
  text: string;
  textMuted: string;
}

export const themes: Theme[] = [
  { id: 'default', name: 'Dark Purple', bg: '#0f0f14', card: '#1a1a24', border: '#2a2a3a', accent: '#7c3aed', accentLight: '#9171ff', text: '#e0e0e0', textMuted: '#5a5a78' },
  { id: 'midnight', name: 'Midnight Blue', bg: '#0a0e1a', card: '#111827', border: '#1f2937', accent: '#3b82f6', accentLight: '#60a5fa', text: '#e0e8f0', textMuted: '#6b7280' },
  { id: 'forest', name: 'Forest', bg: '#0a1210', card: '#121f1b', border: '#1a3028', accent: '#10b981', accentLight: '#34d399', text: '#d0e8e0', textMuted: '#4a7a6a' },
  { id: 'crimson', name: 'Crimson', bg: '#140a0a', card: '#1f1212', border: '#2f1a1a', accent: '#ef4444', accentLight: '#f87171', text: '#e8d8d8', textMuted: '#7a5050' },
  { id: 'amber', name: 'Warm Amber', bg: '#14120a', card: '#1f1c12', border: '#302a1a', accent: '#f59e0b', accentLight: '#fbbf24', text: '#e8e0d0', textMuted: '#7a7050' },
  { id: 'light', name: 'Light', bg: '#f5f5f7', card: '#ffffff', border: '#e0e0e6', accent: '#6d28d9', accentLight: '#7c3aed', text: '#1a1a2e', textMuted: '#6b7280' },
];

const THEME_KEY = 'claudie-theme';
const STYLE_ID = 'claudie-theme-style';

export function getActiveTheme(): Theme {
  try {
    const id = localStorage.getItem(THEME_KEY) || 'default';
    return themes.find((t) => t.id === id) || themes[0];
  } catch { return themes[0]; }
}

export function setActiveTheme(id: string) {
  localStorage.setItem(THEME_KEY, id);
  applyTheme(themes.find((t) => t.id === id) || themes[0]);
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

export function applyTheme(theme: Theme) {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  // Override Tailwind's compiled colors with theme values
  style.textContent = `
    /* Surface overrides */
    .bg-surface-900, .bg-\\[\\#0f0f14\\] { background-color: ${theme.bg} !important; }
    .bg-surface-800 { background-color: ${theme.card} !important; }
    .bg-surface-700 { background-color: ${theme.border} !important; }
    .bg-surface-700\\/50 { background-color: ${theme.border}80 !important; }
    .bg-surface-700\\/30 { background-color: ${theme.border}4d !important; }
    .border-surface-700 { border-color: ${theme.border} !important; }
    .border-surface-700\\/50 { border-color: ${theme.border}80 !important; }
    .text-surface-500 { color: ${theme.textMuted} !important; }
    .text-surface-400 { color: ${theme.textMuted} !important; }
    .text-surface-300 { color: ${theme.text}cc !important; }
    .text-surface-200 { color: ${theme.text} !important; }
    .text-surface-600 { color: ${theme.textMuted}99 !important; }
    .placeholder-surface-500::placeholder { color: ${theme.textMuted} !important; }

    /* Accent overrides */
    .bg-accent-500 { background-color: ${theme.accent} !important; }
    .bg-accent-500\\/10, .bg-accent-500\\/15, .bg-accent-500\\/20 { background-color: ${theme.accent}26 !important; }
    .hover\\:bg-accent-500\\/20:hover, .hover\\:bg-accent-500\\/25:hover { background-color: ${theme.accent}40 !important; }
    .hover\\:bg-accent-600:hover { background-color: ${theme.accent}dd !important; }
    .text-accent-400 { color: ${theme.accentLight} !important; }
    .text-accent-500 { color: ${theme.accent} !important; }
    .border-accent-500 { border-color: ${theme.accent} !important; }
    .border-accent-500\\/20, .border-accent-500\\/30 { border-color: ${theme.accent}40 !important; }
    .ring-accent-500\\/50 { --tw-ring-color: ${theme.accent}80 !important; }
    .focus\\:border-accent-500:focus { border-color: ${theme.accent} !important; }
    .focus\\:ring-accent-500:focus { --tw-ring-color: ${theme.accent} !important; }

    /* Body */
    body { background-color: ${theme.bg}; color: ${theme.text}; }

    /* White text override for light themes */
    ${theme.id === 'light' ? `
    .text-white { color: #1a1a2e !important; }
    .hover\\:text-white:hover { color: #0a0a1e !important; }
    .bg-surface-900, .bg-\\[\\#0f0f14\\] { background-color: ${theme.bg} !important; }
    .bg-black\\/60, .bg-black\\/70 { background-color: rgba(0,0,0,0.3) !important; }
    .bg-surface-900\\/50 { background-color: ${theme.bg}80 !important; }
    input, textarea, select { background-color: ${theme.bg} !important; color: #1a1a2e !important; border-color: ${theme.border} !important; }
    pre { background-color: ${theme.bg} !important; color: #374151 !important; }
    code { color: ${theme.accent} !important; }
    ` : ''}
  `;
}
