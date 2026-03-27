# Claudie

**IDE Companion for Claude Code & OpenCode** — manage projects, tasks, git, and AI coding sessions from your browser.

![Claudie](public/logo.jpg)

## What is Claudie?

Claudie is a local web dashboard that gives you a visual interface for AI-powered coding. It supports both **Claude Code** and **OpenCode** (free models), letting you manage projects, run tasks, review code, and ship — all from one place.

## Features

### Dual CLI Support
- **Claude Code** — Opus 4.6, Sonnet 4.6, Haiku 4.5
- **OpenCode** — free models (Big Pickle, GPT-5 Nano, Mimo V2, MiniMax M2.5, Nemotron 3 Super, and more)
- Switch models live from the project header; switching between CLIs auto-reloads the session
- Default model selection per project on creation

### Projects
- Create new projects with a description — AI generates CLAUDE.md and builds it
- Clone existing repos — AI explores and creates CLAUDE.md
- Project templates: Blank, React+TS, Node API, Static Site, Python CLI, Chrome Extension
- Feature branch workflow — auto-creates feature branches, squash-merge releases
- Start/Stop app with script caching (runs the command directly after first time)
- Push, Release (push + squash-merge to master), Rollback last commit
- PR required mode — visual diff review overlay before commits land
- Finish project — mark as completed or delete with GitHub repo
- Public/Private repository toggle
- File explorer with CodeMirror editor (syntax highlighting for 10+ languages)
- Completed projects gallery with task stats and time tracking

### Tasks
- Create tasks, send to AI with one click
- **Voice input** — speak your tasks via microphone (Web Speech API)
- UUID tracking — commits reference task IDs `[a1b2c3d4]`
- Filter git log by task UUID
- **Task dependencies** — chain tasks to auto-run sequentially
- Comments as feedback loop — auto-reopens closed tasks and sends feedback to AI
- File attachments — attach images/docs for AI to reference
- Interaction log per task (captured terminal output)
- Time tracking (created/started/done/duration)
- Task statistics with progress bar
- Double-click to edit task text
- Delete task with automatic git rollback to pre-task state
- Send all open tasks at once

### Terminal
- Full PTY terminal via Python bridge
- Persistent sessions — survive browser refresh
- Audio + browser + Telegram notifications when AI needs input
- "Waiting for input" indicator in sidebar for all open projects
- Configurable model with live switching
- **DECRQM escape sequence stripping** for OpenCode TUI compatibility
- `--dangerously-skip-permissions` auto-enabled for Claude

### Git
- Commit history with timestamps, filterable by task UUID
- Click any commit to view full diff
- Feature branch workflow with auto-creation
- **Rollback button** — one-click revert with confirmation
- Release — push + squash-merge to master
- Branch and remote info in git panel
- Fold/unfold git panel
- Repository visibility toggle (public/private)

### Skills
- Manage custom slash commands (`~/.claude/commands/*.md`)
- Install from URL (supports skills.sh, GitHub raw URLs)
- **Generate skills with AI** — describe what you want, AI writes the skill
- Run skills from the project view

### Telegram Bot
- Get notified when AI needs your input
- Create and run tasks from your phone
- `/do` command — create and immediately run a task

**Bot commands:**
| Command | Description |
|---------|-------------|
| `/start` | Welcome message & command list |
| `/projects` | List available projects |
| `/use <name>` | Switch to a project |
| `/task <desc>` | Create a new task |
| `/do <desc>` | Create & run task immediately |
| `/run <id>` | Execute an existing task |
| `/tasks` | List all tasks with status |
| `/status` | Project info & task stats |
| `/help` | Command reference |

### Configuration
- **Tools status page** — shows installed CLIs, versions, paths, and available models
- Edit MCP servers (add/remove/update)
- Global CLAUDE.md editor with create template
- Settings viewer (read-only)
- **6 color themes** (Dark Purple, Midnight Blue, Forest, Crimson, Warm Amber, Light)
- Telegram bot integration setup

## Requirements

- **Node.js** >= 18
- **Python 3** (for terminal PTY bridge)
- **Git** installed
- **Claude Code CLI** or **OpenCode CLI** — at least one must be installed
  - Claude Code: `npm install -g @anthropic-ai/claude-code`
  - OpenCode: `curl -fsSL https://opencode.ai/install | bash`
- **GitHub CLI** (`gh`) — optional, for GitHub integration (create repos, change visibility, etc.)
- **Telegram bot** — optional; create via [@BotFather](https://t.me/BotFather), get your Chat ID from [@userinfobot](https://t.me/userinfobot), then configure in Claudie Config > Telegram

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

### Development

```bash
# Run both frontend (Vite) and backend (Express) in dev mode
npm run dev
```

- Frontend dev server: http://localhost:5173 (proxies API to backend)
- Backend API: http://localhost:3434

### CLI Options

```bash
# Default (port 3434, opens browser)
npm start

# Custom port
PORT=8080 npm start

# Via npx (after npm publish)
npx claudie
npx claudie --port 8080 --no-open
```

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, CodeMirror 6, xterm.js, Web Speech API
- **Backend**: Node.js, Express, WebSocket (ws)
- **Terminal**: Python PTY bridge (no native modules needed)
- **Integrations**: GitHub CLI (`gh`), Telegram Bot API, Claude Code CLI, OpenCode CLI

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
│   │   ├── telegram.ts     # Telegram bot integration
│   │   └── ...
│   ├── services/           # Business logic
│   │   ├── terminalManager.ts
│   │   ├── claudeLauncher.ts
│   │   ├── telegramBot.ts
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
│   │       ├── config/     # ConfigPage (Settings, MCP, CLAUDE.md, Telegram)
│   │       ├── dashboard/  # DashboardPage
│   │       ├── shortcuts/  # ShortcutsPage
│   │       └── tips/       # TipsPage
│   ├── hooks/              # useApi, useResizable, useClipboard
│   └── lib/                # API client, themes, constants
├── public/
│   └── logo.jpg
└── dist/                   # Built frontend (generated)
```

## License

MIT

---

Developed by [Innovation Infinity](http://www.ininua.com/) &copy; 2026
