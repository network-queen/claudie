# Claudie

**IDE Companion for Claude Code** — manage projects, tasks, git, and Claude sessions from your browser.

![Claudie](public/logo.jpg)

## What is Claudie?

Claudie is a local web dashboard that runs alongside Claude Code, giving you a visual interface to:

- **Create & manage projects** with git, GitHub integration, and CLAUDE.md generation
- **Run Claude sessions** with configurable model and `--dangerously-skip-permissions`
- **Task management** — create tasks, send them to Claude, track progress, add feedback
- **File explorer** with CodeMirror editor (syntax highlighting for 10+ languages)
- **Git dashboard** — commits, branches, diffs, feature branch workflow, squash-merge releases
- **Skills management** — create, install from URL (skills.sh), and run custom slash commands
- **MCP server configuration** — add, edit, remove MCP servers
- **Themes** — 6 built-in themes (Dark Purple, Midnight Blue, Forest, Crimson, Warm Amber, Light)

## Requirements

- **Node.js** >= 18
- **Python 3** (for terminal PTY bridge)
- **Claude Code CLI** installed (`claude` command available)
- **Git** installed
- **GitHub CLI** (`gh`) — optional, for GitHub integration (create repos, change visibility, etc.)

## Quick Start

```bash
# Clone
git clone https://github.com/network-queen/claudie.git
cd claudie

# Install dependencies
npm install

# Build frontend
npm run build

# Start
npm start
```

Claudie opens at **http://localhost:3434**

## Development

```bash
# Run both frontend (Vite) and backend (Express) in dev mode
npm run dev
```

- Frontend dev server: http://localhost:5173 (proxies API to backend)
- Backend API: http://localhost:3434

## CLI Usage

```bash
# Default (port 3434, opens browser)
npm start

# Custom port
PORT=8080 npm start

# Via npx (after npm publish)
npx claudie
npx claudie --port 8080 --no-open
```

## Project Structure

```
claudie/
├── bin/cli.js              # CLI entry point
├── server/
│   ├── index.ts            # Express + WebSocket server
│   ├── pty-bridge.py       # Python PTY bridge for terminal
│   ├── routes/             # API routes
│   │   ├── tools.ts        # Built-in tools catalog
│   │   ├── commands.ts     # Skills (custom slash commands)
│   │   ├── git.ts          # Git operations
│   │   ├── projects.ts     # Project management
│   │   ├── tasks.ts        # Task & procedure management
│   │   ├── files.ts        # File system operations
│   │   ├── config.ts       # Claude config reader
│   │   ├── configEditor.ts # Config writer (MCP, CLAUDE.md)
│   │   ├── terminal.ts     # Terminal session management
│   │   ├── claudeChat.ts   # Non-interactive Claude prompts
│   │   └── ...
│   ├── services/           # Business logic
│   │   ├── terminalManager.ts
│   │   ├── claudeLauncher.ts
│   │   └── ...
│   └── data/               # Static reference data
│       ├── tools.json      # 29 Claude Code tools
│       ├── shortcuts.json  # Keyboard shortcuts
│       └── tips.json       # Usage tips
├── src/                    # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/         # Sidebar, Layout
│   │   ├── shared/         # CodeEditor, Card, Badge, etc.
│   │   └── features/       # Page components
│   │       ├── projects/   # ProjectsPage, ProjectDetailPage
│   │       ├── skills/     # SkillsPage
│   │       ├── mcp/        # McpPage (MCP + Tools Reference)
│   │       ├── config/     # ConfigPage (Settings, MCP, CLAUDE.md)
│   │       ├── dashboard/  # DashboardPage
│   │       ├── shortcuts/  # ShortcutsPage
│   │       └── tips/       # TipsPage
│   ├── hooks/              # useApi, useResizable, useClipboard
│   └── lib/                # API client, themes, constants
├── public/
│   └── logo.jpg
└── dist/                   # Built frontend (generated)
```

## Features

### Projects
- Create new projects with description — Claude generates CLAUDE.md and builds it
- Clone existing repos — Claude explores and creates CLAUDE.md
- Feature branch workflow — auto-creates feature branches, squash-merge releases
- Start/Stop app, Push, Release, Finish project
- PR required mode — diff review overlay before commits

### Tasks
- Create tasks, send to Claude with one click
- UUID tracking — commits reference task IDs
- Filter git log by task
- Comments as feedback loop — auto-reopens closed tasks
- File attachments
- Interaction log per task
- Time tracking (started/done/duration)

### Terminal
- Full PTY terminal via Python bridge
- Persistent sessions — survive browser refresh
- Audio + browser notifications when Claude is waiting
- "Waiting for input" indicator in sidebar

### Skills
- Manage custom slash commands (`~/.claude/commands/*.md`)
- Install from URL (supports skills.sh, GitHub)
- Run skills from project view

### Configuration
- Edit MCP servers (add/remove/update)
- Global CLAUDE.md editor
- Settings viewer (read-only)
- 6 color themes

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, CodeMirror 6, xterm.js
- **Backend**: Node.js, Express, WebSocket
- **Terminal**: Python PTY bridge (no native modules needed)

## License

MIT

---

Developed by [Innovation Infinity](http://www.ininua.com/) &copy; 2026
