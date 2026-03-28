# Agent Bunker

**Open-source mission control dashboard for AI coding agents.**

Agent Bunker gives you a real-time, browser-based command center to monitor and manage your AI agent's operations — scheduled tasks, activity logs, usage metrics, workspace files, and more.

Built with React, TypeScript, Express, and Tailwind CSS. Designed for local-first single-agent setups (e.g., Claude Code, Cursor, Copilot Workspace), but extensible to any agent architecture.

![License](https://img.shields.io/badge/license-MIT-violet)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![React](https://img.shields.io/badge/React-19-61dafb)

---

## Features

| Tab | Description |
|-----|-------------|
| **Activity** | Tagged activity log with color-coded entries (BUILD, CRON, FIX, MEMORY, RESEARCH, etc.) |
| **Agents Playground** | Live dashboard showing cron jobs, subagent runs, active sessions, and recent logs with real-time countdown timers |
| **Moltbook** | Social dashboard for [Moltbook](https://www.moltbook.com) — the agent social platform (optional integration) |
| **Cron & Jobs** | Full CRUD manager for scheduled tasks — edit, toggle, delete, view payloads and error history |
| **GitHub Trending** | Discover trending repositories across AI Agents, Developer Tools, TypeScript, Python AI, and Agent Workflows |
| **Usage** | Monitor API token consumption with session (5h) and weekly (7d) windows, color-coded progress bars |
| **Skills** | Browse installed agent skills with emoji icons and descriptions, auto-discovered from `SKILL.md` files |
| **Editor** | In-browser file editor for workspace memory and configuration files with dirty-state tracking |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                      │
│  Vite Dev Server (:5173) ──proxy /api──> Backend (:3001)     │
├─────────────────────────────────────────────────────────────┤
│ App.tsx                                                      │
│  ├─ Layout.tsx (sidebar + header + clock + usage badge)      │
│  └─ Tab Router                                               │
│      ├─ ActivityTab        → GET /activity                   │
│      ├─ AgentsPlaygroundTab → GET /agents/playground         │
│      ├─ MoltbookTab        → GET /moltbook/*                 │
│      ├─ CronTab            → GET/PATCH/POST/DELETE /cron/*   │
│      ├─ GitHubTrendingTab  → GET /github/trending            │
│      ├─ UsageTab           → GET /usage                      │
│      ├─ SkillsTab          → GET /skills                     │
│      └─ EditorTab          → GET/POST /file, GET /files      │
├─────────────────────────────────────────────────────────────┤
│                 BACKEND (Express - :3001)                     │
│                                                              │
│  All paths configurable via .env                             │
│  File-based JSON storage (no database required)              │
│  10-min caching for GitHub API & usage data                  │
├─────────────────────────────────────────────────────────────┤
│                    DATA (./data/)                             │
│  ├─ activity.json          (activity log entries)            │
│  ├─ cron/jobs.json         (scheduled tasks)                 │
│  ├─ subagents/runs.json    (subagent execution history)      │
│  ├─ sessions/sessions.json (chat sessions)                   │
│  ├─ progress.json          (agent progress tracking)         │
│  ├─ logs/                  (log files)                       │
│  ├─ workspace/             (editable files)                  │
│  └─ skills/                (skill directories)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (with npm)

### 1. Clone & Install

```bash
git clone <your-repo-url> agent-bunker
cd agent-bunker
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env to customize paths (defaults work out of the box with sample data)
```

### 3. Run

```bash
npm run dev
```

This starts both the Vite frontend (`:5173`) and Express backend (`:3001`) concurrently.

Open **http://localhost:5173** in your browser.

### 4. Build for Production

```bash
npm run build
npm run preview
```

---

## Configuration

All configuration is done through the `.env` file. Copy `.env.example` to get started:

### Core Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE_ROOT` | `./data/workspace` | Root directory for the file editor |
| `CRON_JOBS_FILE` | `./data/cron/jobs.json` | Path to scheduled jobs JSON |
| `ACTIVITY_FILE` | `./data/activity.json` | Path to activity log JSON |
| `SKILL_DIRS` | `./data/skills` | Comma-separated skill directories |

### Agent Data (Agents Playground tab)

| Variable | Default | Description |
|----------|---------|-------------|
| `SUBAGENT_RUNS_FILE` | `./data/subagents/runs.json` | Subagent execution history |
| `SESSIONS_FILE` | `./data/sessions/sessions.json` | Agent chat sessions |
| `PROGRESS_FILE` | `./data/progress.json` | Agent progress tracking |
| `LOGS_DIR` | `./data/logs` | Directory containing log files |

### Optional Integrations

| Variable | Default | Description |
|----------|---------|-------------|
| `USAGE_SCRIPT` | *(empty)* | Path to a script that outputs JSON usage data |
| `MOLTBOOK_API_TOKEN` | *(empty)* | Moltbook API token (leave empty to disable) |
| `MOLTBOOK_AGENT_NAME` | *(empty)* | Your agent's Moltbook username |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `APP_NAME` | `Agent Bunker` | Dashboard display name |

---

## Data Format Reference

### Activity Log (`activity.json`)

Array of entries with tagged summaries:

```json
[
  {
    "timestamp": "2025-01-15T10:30:00Z",
    "tag": "BUILD",
    "summary": "Deployed new version of the dashboard"
  }
]
```

**Supported tags:** `BUILD`, `CRON`, `FIX`, `MEMORY`, `USAGE`, `RESEARCH`, `RESET`, `TASK`, `LOG`, `MOLTBOOK` — each gets a unique color in the UI. Custom tags also work with a default style.

### Cron Jobs (`cron/jobs.json`)

```json
{
  "jobs": [
    {
      "id": "unique-id",
      "name": "Job Name",
      "description": "Optional description",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1705312200000,
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * *",
        "tz": "UTC"
      },
      "payload": {
        "kind": "prompt",
        "message": "The task to execute",
        "timeoutSeconds": 300
      },
      "state": {
        "lastRunAtMs": 1705305600000,
        "lastStatus": "ok",
        "lastDurationMs": 15200,
        "nextRunAtMs": 1705392000000,
        "consecutiveErrors": 0,
        "lastError": null
      }
    }
  ]
}
```

**Schedule types:**
- `"kind": "cron"` — standard cron expression with optional timezone
- `"kind": "every"` — interval in milliseconds (`everyMs`)
- `"kind": "at"` — one-shot at a specific ISO timestamp

### Skills (`SKILL.md`)

Each skill is a directory containing a `SKILL.md` with YAML frontmatter:

```markdown
---
name: My Skill
description: What this skill does
emoji: "🔧"
---

# My Skill

Detailed documentation here...
```

### Usage Script Output

If you configure `USAGE_SCRIPT`, it should output JSON like:

```json
{
  "session": {
    "used": 45000,
    "limit": 100000,
    "percentage": 45,
    "reset_at": "2025-01-15T15:00:00Z"
  },
  "weekly": {
    "used": 250000,
    "limit": 1000000,
    "percentage": 25,
    "reset_at": "2025-01-20T00:00:00Z"
  }
}
```

---

## Customization

### Adding New Tabs

1. Create a new component in `src/components/tabs/MyTab.tsx`
2. Add the tab ID to the `TabId` type in `src/App.tsx`
3. Add the tab entry in the `tabs` array in `src/components/Layout.tsx`
4. Add the case to the `renderTab()` switch in `src/App.tsx`
5. Add a corresponding API endpoint in `src/server.ts` if needed

### Theming

The dashboard uses a dark zinc/violet theme. Key customization points:

- **Accent color:** Change `bg-violet-600` references in Layout and tab components
- **Background:** Edit the gradient in `src/globals.css` body styles
- **Tailwind:** Extend colors in `tailwind.config.js`

### Connecting to Your Agent

Agent Bunker reads from JSON files on disk. To connect it to your agent:

1. Have your agent write activity entries to `activity.json`
2. Have your cron system update `cron/jobs.json` with job state
3. Point `WORKSPACE_ROOT` to your agent's memory directory
4. Point `SKILL_DIRS` to where your agent's skills are installed

The dashboard polls for changes automatically (10s for agents playground, 30s for activity/cron, 60s for usage).

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **React 19** | UI components with hooks |
| **TypeScript** | Type safety across frontend & backend |
| **Vite 6** | Fast dev server & production builds |
| **Express 4** | Lightweight API backend |
| **Tailwind CSS 3** | Utility-first styling |
| **Framer Motion** | Smooth animations & transitions |
| **Radix UI** | Accessible component primitives |
| **Lucide React** | Icon library |
| **js-yaml** | YAML frontmatter parsing |

---

## Project Structure

```
agent-bunker/
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Tab routing
│   ├── server.ts                   # Express backend (all API endpoints)
│   ├── globals.css                 # Global styles & glass effects
│   ├── lib/
│   │   └── utils.ts                # cn() helper & apiFetch()
│   └── components/
│       ├── Layout.tsx              # Sidebar, header, clock, usage badge
│       └── tabs/
│           ├── ActivityTab.tsx      # Activity log viewer
│           ├── AgentsPlaygroundTab.tsx # Live agent operations dashboard
│           ├── CronTab.tsx          # Cron job manager with edit modal
│           ├── EditorTab.tsx        # Workspace file editor
│           ├── GitHubTrendingTab.tsx # GitHub trending repos
│           ├── MoltbookTab.tsx      # Moltbook social dashboard
│           ├── SkillsTab.tsx        # Skills registry browser
│           └── UsageTab.tsx         # API usage monitor
├── data/                           # Sample data (works out of the box)
│   ├── activity.json
│   ├── cron/jobs.json
│   ├── workspace/memory/
│   ├── skills/example-skill/
│   └── ...
├── .env.example                    # Configuration template
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

---

## Security Notes

- **No authentication** is built in — this is designed for local development use. If you expose it on a network, add authentication middleware to `server.ts`.
- **File access** is sandboxed to the configured `WORKSPACE_ROOT` directory. The server rejects paths that resolve outside the workspace.
- **API tokens** (Moltbook, etc.) should only be stored in `.env`, which is gitignored. Never commit secrets to the repository.
- The GitHub Trending feature uses the unauthenticated GitHub Search API, which has rate limits. Results are cached for 10 minutes.

---

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run the dev server to test: `npm run dev`
5. Submit a pull request

### Ideas for Contributions

- Authentication middleware (API keys, OAuth)
- WebSocket support for real-time updates (replace polling)
- Dark/light theme toggle
- Additional integrations (Slack, Discord, Linear)
- Mobile-responsive improvements
- Docker container support
- Multi-agent support (monitoring multiple agents)

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Built with care for the AI agent community.
