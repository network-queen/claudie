import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  Zap,
  Plug,
  Keyboard,
  Settings,
  Lightbulb,
  Sparkles,
  X,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface OpenProject {
  path: string;
  name: string;
}

const OPEN_PROJECTS_KEY = 'claudie-open-projects';

function loadOpenProjects(): OpenProject[] {
  try { return JSON.parse(localStorage.getItem(OPEN_PROJECTS_KEY) || '[]'); } catch { return []; }
}

function saveOpenProjects(projects: OpenProject[]) {
  try { localStorage.setItem(OPEN_PROJECTS_KEY, JSON.stringify(projects)); } catch {}
}

const ideItems: NavItem[] = [
  { path: '/projects', label: 'Projects', icon: FolderGit2 },
];

const refItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/skills', label: 'Skills', icon: Zap },
  { path: '/mcp', label: 'MCP & Tools', icon: Plug },
  { path: '/shortcuts', label: 'Shortcuts', icon: Keyboard },
  { path: '/tips', label: 'Tips', icon: Lightbulb },
  { path: '/config', label: 'Config', icon: Settings },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-accent-500/15 text-accent-400 font-medium'
          : 'text-surface-400 hover:text-white hover:bg-surface-700/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {item.label}
    </Link>
  );
}

export default function Layout() {
  const location = useLocation();
  const { pathname, search } = location;
  const [openProjects, setOpenProjects] = useState<OpenProject[]>(loadOpenProjects);
  const [waitingProjects, setWaitingProjects] = useState<Record<string, boolean>>({});

  // Poll waiting state from localStorage
  useEffect(() => {
    const check = () => {
      try { setWaitingProjects(JSON.parse(localStorage.getItem('claudie-waiting') || '{}')); } catch {}
    };
    check();
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, []);

  // Track when a project is opened
  useEffect(() => {
    if (pathname === '/project') {
      const params = new URLSearchParams(search);
      const projectPath = params.get('path');
      if (projectPath) {
        const name = projectPath.split('/').filter(Boolean).pop() || 'Project';
        setOpenProjects((prev) => {
          if (prev.find((p) => p.path === projectPath)) return prev;
          const updated = [...prev, { path: projectPath, name }];
          saveOpenProjects(updated);
          return updated;
        });
      }
    }
  }, [pathname, search]);

  const closeProject = (projectPath: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenProjects((prev) => {
      const updated = prev.filter((p) => p.path !== projectPath);
      saveOpenProjects(updated);
      return updated;
    });
    // If we're viewing this project, navigate to projects list
    const params = new URLSearchParams(search);
    if (pathname === '/project' && params.get('path') === projectPath) {
      window.location.href = '/projects';
    }
  };

  // Which project is currently active?
  const activeProjectPath = pathname === '/project'
    ? new URLSearchParams(search).get('path')
    : null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-surface-800 border-r border-surface-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-surface-700">
          <Link to="/projects" className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="Claudie" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <span className="text-lg font-bold text-white">Claudie</span>
              <span className="block text-[10px] text-surface-500 -mt-0.5">IDE Companion</span>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* IDE section */}
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
              IDE
            </span>
          </div>
          {ideItems.map((item) => (
            <NavLink key={item.path} item={item} pathname={pathname} />
          ))}

          {/* Open Projects */}
          {openProjects.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  Open Projects
                </span>
              </div>
              {openProjects.map((proj) => {
                const isActive = activeProjectPath === proj.path;
                const isWaiting = !!waitingProjects[proj.path];
                return (
                  <div key={proj.path} className="group relative">
                    <Link
                      to={`/project?path=${encodeURIComponent(proj.path)}`}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isWaiting
                          ? 'bg-amber-500/10 text-amber-400'
                          : isActive
                            ? 'bg-accent-500/15 text-accent-400 font-medium'
                            : 'text-surface-400 hover:text-white hover:bg-surface-700/50'
                      }`}
                    >
                      {isWaiting
                        ? <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        : <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{proj.name}</span>
                      {isWaiting && <span className="text-[9px] text-amber-400/70 shrink-0 ml-auto">input</span>}
                    </Link>
                    <button
                      onClick={(e) => closeProject(proj.path, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-surface-600 hover:text-surface-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Separator */}
          <div className="my-2 border-t border-surface-700" />

          {/* Reference section */}
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
              Reference
            </span>
          </div>
          {refItems.map((item) => (
            <NavLink key={item.path} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="p-3 border-t border-surface-700">
          <p className="text-[10px] text-surface-600 text-center">
            <a href="http://www.ininua.com/" target="_blank" rel="noopener noreferrer" className="hover:text-surface-400 transition-colors">Innovation Infinity</a> &copy; 2026
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-surface-900">
        <Outlet />
      </main>
    </div>
  );
}
