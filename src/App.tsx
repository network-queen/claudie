import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SkillsPage from './pages/SkillsPage';
import McpPage from './pages/McpPage';
import ShortcutsPage from './pages/ShortcutsPage';
import ConfigPage from './pages/ConfigPage';
import TipsPage from './pages/TipsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/project" element={<ProjectDetailPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/mcp" element={<McpPage />} />
        <Route path="/shortcuts" element={<ShortcutsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/tips" element={<TipsPage />} />
      </Route>
    </Routes>
  );
}
