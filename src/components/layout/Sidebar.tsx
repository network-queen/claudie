import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  Sparkles,
  Server,
  FileCode2,
  Keyboard,
  Settings,
  Lightbulb,
  X,
} from 'lucide-react';
import { NAV_ITEMS } from '../../lib/constants';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  LayoutDashboard,
  Wrench,
  Sparkles,
  Server,
  FileCode2,
  Keyboard,
  Settings,
  Lightbulb,
};

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-surface-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <span className="text-xl font-bold text-white tracking-tight">Claudie</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-white transition-all duration-200 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-500/15 text-accent-400 border border-accent-500/20'
                    : 'text-surface-300 hover:bg-surface-700 hover:text-white border border-transparent'
                }`
              }
            >
              {Icon && <Icon size={18} className="shrink-0" />}
              <div className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs text-surface-500 font-normal">{item.description}</span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-700 px-6 py-4">
        <p className="text-xs text-surface-500">Claudie v1.0.0</p>
        <p className="text-xs text-surface-500 mt-0.5">Claude Code Companion</p>
      </div>
    </div>
  );
}
