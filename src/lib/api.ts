const API_BASE = '/api';

async function fetchApi<T>(path: string, unwrap = true): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `API error ${response.status}: ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`
    );
  }

  const json = await response.json();
  // Backend wraps responses in { data, count } — unwrap automatically
  if (unwrap && json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// Tools
export function getTools() {
  return fetchApi<any[]>('/tools');
}

export function getToolById(id: string) {
  return fetchApi<any>(`/tools/${id}`);
}

// Skills
export function getSkills() {
  return fetchApi<any[]>('/skills');
}

export function getSkillById(id: string) {
  return fetchApi<any>(`/skills/${id}`);
}

// Patterns
export function getPatterns() {
  return fetchApi<any[]>('/patterns');
}

export function getPatternById(id: string) {
  return fetchApi<any>(`/patterns/${id}`);
}

// Shortcuts
export function getShortcuts() {
  return fetchApi<any[]>('/shortcuts');
}

// Tips
export function getTips() {
  return fetchApi<any[]>('/tips');
}

// MCP
export function getMcpServers() {
  return fetchApi<any[]>('/mcp/servers');
}

// Config
export function getConfig() {
  return fetchApi<any>('/config/settings');
}

// Memory
export function getMemory() {
  return fetchApi<any[]>('/config/memory');
}

// CLAUDE.md files
export function getClaudeMd() {
  return fetchApi<any[]>('/config/claude-md');
}

// Stats
export function getStats() {
  return fetchApi<any>('/stats');
}

// Search
export function globalSearch(query: string) {
  return fetchApi<any>(`/search?q=${encodeURIComponent(query)}`);
}
