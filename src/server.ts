import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { execFile } from 'child_process'
import { readdir, readFile, writeFile, stat, mkdir } from 'fs/promises'
import { join, resolve } from 'path'
import yaml from 'js-yaml'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json())

// ─── Configuration from environment ─────────────────────────────────────────
// All paths default to local ./data directory for easy out-of-box experience

const WORKSPACE_ROOT = resolve(process.env.WORKSPACE_ROOT || './data/workspace')
const CRON_JOBS_FILE = resolve(process.env.CRON_JOBS_FILE || './data/cron/jobs.json')
const ACTIVITY_FILE = resolve(process.env.ACTIVITY_FILE || './data/activity.json')
const SUBAGENT_RUNS_FILE = resolve(process.env.SUBAGENT_RUNS_FILE || './data/subagents/runs.json')
const SESSIONS_FILE = resolve(process.env.SESSIONS_FILE || './data/sessions/sessions.json')
const PROGRESS_FILE = resolve(process.env.PROGRESS_FILE || './data/progress.json')
const LOGS_DIR = resolve(process.env.LOGS_DIR || './data/logs')
const USAGE_SCRIPT = process.env.USAGE_SCRIPT || ''
const SKILL_DIRS = (process.env.SKILL_DIRS || './data/skills').split(',').map(d => resolve(d.trim()))
const MCP_README = process.env.MCP_README || ''

// Optional integrations
const MOLTBOOK_API_TOKEN = process.env.MOLTBOOK_API_TOKEN || ''
const MOLTBOOK_AGENT_NAME = process.env.MOLTBOOK_AGENT_NAME || ''
const MOLTBOOK_BASE = 'https://www.moltbook.com/api/v1'

// ─── Usage endpoint ─────────────────────────────────────────────────────────

let usageCache: { data: any; fetchedAt: number } | null = null
const USAGE_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

app.get('/usage', (_req, res) => {
  if (!USAGE_SCRIPT) {
    return res.status(501).json({ error: 'Usage monitoring not configured. Set USAGE_SCRIPT in .env' })
  }

  // Return cached data if fresh
  if (usageCache && Date.now() - usageCache.fetchedAt < USAGE_CACHE_TTL) {
    return res.json({ ...usageCache.data, cached: true, cachedAt: usageCache.fetchedAt })
  }

  execFile('bash', [USAGE_SCRIPT, '--json'], { timeout: 15000 }, (err, stdout, stderr) => {
    try {
      if (!stdout || !stdout.trim()) {
        if (usageCache) {
          return res.json({ ...usageCache.data, cached: true, rateLimited: true, cachedAt: usageCache.fetchedAt })
        }
        return res.status(429).json({ error: 'Usage data unavailable. Will retry automatically.' })
      }
      const data = JSON.parse(stdout)

      if (data.error) {
        if (data.error.includes('rate_limit_error') || data.error.includes('Rate limited')) {
          if (usageCache) {
            return res.json({ ...usageCache.data, cached: true, rateLimited: true, cachedAt: usageCache.fetchedAt })
          }
          return res.status(429).json({ error: 'API rate limited. Try again in a few minutes.' })
        }
        if (data.error.includes('no_credentials') || data.error.includes('no_token')) {
          return res.status(401).json({ error: 'Agent credentials not configured.' })
        }
        return res.status(500).json({ error: data.error })
      }

      usageCache = { data, fetchedAt: Date.now() }
      res.json(data)
    } catch {
      if (err) {
        console.error('Usage script error:', stderr || err.message)
        if (usageCache) {
          return res.json({ ...usageCache.data, cached: true, stale: true, cachedAt: usageCache.fetchedAt })
        }
        return res.status(500).json({ error: 'Failed to fetch usage data', details: stderr || err.message })
      }
      res.json({ raw: stdout })
    }
  })
})

// ─── Skills endpoint ────────────────────────────────────────────────────────

async function parseSkillMd(dirPath: string): Promise<{ name: string; description: string; emoji: string } | null> {
  try {
    const skillMdPath = join(dirPath, 'SKILL.md')
    const content = await readFile(skillMdPath, 'utf-8')
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return { name: dirPath.split('/').pop() || 'Unknown', description: '', emoji: '' }
    const frontmatter = yaml.load(frontmatterMatch[1]) as Record<string, string>
    return {
      name: frontmatter.name || dirPath.split('/').pop() || 'Unknown',
      description: frontmatter.description || '',
      emoji: frontmatter.emoji || frontmatter.icon || '',
    }
  } catch {
    return null
  }
}

app.get('/skills', async (_req, res) => {
  try {
    const skills: Array<{ name: string; description: string; emoji: string; path: string }> = []
    for (const dir of SKILL_DIRS) {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = join(dir, entry.name)
            const parsed = await parseSkillMd(fullPath)
            if (parsed) {
              skills.push({ ...parsed, path: fullPath })
            }
          }
        }
      } catch {
        // Directory may not exist — that's fine
      }
    }
    res.json(skills)
  } catch (e) {
    res.status(500).json({ error: 'Failed to list skills' })
  }
})

// ─── File endpoints (workspace editor) ──────────────────────────────────────

function isWithinWorkspace(filePath: string): boolean {
  const resolved = resolve(filePath)
  return resolved.startsWith(resolve(WORKSPACE_ROOT))
}

app.get('/files', async (_req, res) => {
  try {
    const files: string[] = []

    async function walk(dir: string, prefix: string) {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          // Recurse into subdirectories (memory, configs, etc.)
          await walk(join(dir, entry.name), relativePath)
        } else if (
          entry.name.endsWith('.md') ||
          entry.name.endsWith('.txt') ||
          entry.name.endsWith('.yaml') ||
          entry.name.endsWith('.yml') ||
          entry.name.endsWith('.json')
        ) {
          files.push(relativePath)
        }
      }
    }

    await walk(WORKSPACE_ROOT, '')
    res.json(files)
  } catch (e) {
    res.status(500).json({ error: 'Failed to list files' })
  }
})

app.get('/file', async (req, res) => {
  const filePath = req.query.path as string
  if (!filePath) return res.status(400).json({ error: 'path required' })

  const fullPath = resolve(WORKSPACE_ROOT, filePath)
  if (!isWithinWorkspace(fullPath)) {
    return res.status(403).json({ error: 'Access denied: outside workspace' })
  }

  try {
    const content = await readFile(fullPath, 'utf-8')
    res.json({ path: filePath, content })
  } catch {
    res.status(404).json({ error: 'File not found' })
  }
})

app.post('/file', async (req, res) => {
  const { path: filePath, content } = req.body
  if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' })

  const fullPath = resolve(WORKSPACE_ROOT, filePath)
  if (!isWithinWorkspace(fullPath)) {
    return res.status(403).json({ error: 'Access denied: outside workspace' })
  }

  try {
    await writeFile(fullPath, content, 'utf-8')
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to write file' })
  }
})

// ─── Cron Jobs endpoints ────────────────────────────────────────────────────

async function readCronData() {
  const content = await readFile(CRON_JOBS_FILE, 'utf-8')
  return JSON.parse(content)
}

async function writeCronData(data: any) {
  await writeFile(CRON_JOBS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

app.get('/cron/jobs', async (_req, res) => {
  try {
    const data = await readCronData()
    res.json(data.jobs ?? [])
  } catch {
    res.json([])
  }
})

app.patch('/cron/jobs/:id', async (req, res) => {
  try {
    const data = await readCronData()
    const idx = data.jobs.findIndex((j: any) => j.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Job not found' })
    data.jobs[idx] = { ...data.jobs[idx], ...req.body, updatedAtMs: Date.now() }
    await writeCronData(data)
    res.json(data.jobs[idx])
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/cron/jobs/:id/toggle', async (req, res) => {
  try {
    const data = await readCronData()
    const idx = data.jobs.findIndex((j: any) => j.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Job not found' })
    data.jobs[idx].enabled = !data.jobs[idx].enabled
    data.jobs[idx].updatedAtMs = Date.now()
    await writeCronData(data)
    res.json({ enabled: data.jobs[idx].enabled })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/cron/jobs/:id', async (req, res) => {
  try {
    const data = await readCronData()
    const before = data.jobs.length
    data.jobs = data.jobs.filter((j: any) => j.id !== req.params.id)
    if (data.jobs.length === before) return res.status(404).json({ error: 'Job not found' })
    await writeCronData(data)
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Activity endpoint ──────────────────────────────────────────────────────

app.get('/activity', async (_req, res) => {
  try {
    const content = await readFile(ACTIVITY_FILE, 'utf-8')
    const entries = JSON.parse(content) as Array<{ timestamp: string; tag: string; summary: string }>
    res.json(entries.reverse())
  } catch {
    res.json([])
  }
})

// ─── GitHub Trending endpoint ───────────────────────────────────────────────

interface TrendingRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  language: string | null
  html_url: string
  category: string
}

let trendingCache: { data: TrendingRepo[]; fetchedAt: number } | null = null
const TRENDING_TTL = 10 * 60 * 1000

const TRENDING_QUERIES: { q: string; category: string }[] = [
  { q: 'topic:ai-agents stars:>50 pushed:>2024-01-01', category: 'AI Agents' },
  { q: 'topic:developer-tools stars:>100 pushed:>2024-01-01', category: 'Developer Tools' },
  { q: 'language:typescript stars:>100 pushed:>2024-01-01', category: 'TypeScript' },
  { q: 'language:python topic:ai stars:>100 pushed:>2024-01-01', category: 'Python AI' },
  { q: 'topic:llm topic:workflow stars:>50 pushed:>2024-01-01', category: 'Agent Workflows' },
]

async function fetchTrending(): Promise<TrendingRepo[]> {
  if (trendingCache && Date.now() - trendingCache.fetchedAt < TRENDING_TTL) {
    return trendingCache.data
  }

  const results = await Promise.allSettled(
    TRENDING_QUERIES.map(async ({ q, category }) => {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=8`
      const res = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'agent-bunker' },
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.items || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        stargazers_count: r.stargazers_count,
        language: r.language,
        html_url: r.html_url,
        category,
      }))
    })
  )

  const seen = new Set<number>()
  const repos: TrendingRepo[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const repo of result.value) {
        if (!seen.has(repo.id)) {
          seen.add(repo.id)
          repos.push(repo)
        }
      }
    }
  }

  trendingCache = { data: repos, fetchedAt: Date.now() }
  return repos
}

app.get('/github/trending', async (_req, res) => {
  try {
    const repos = await fetchTrending()
    res.json(repos)
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch trending repos', details: e.message })
  }
})

// ─── Moltbook proxy endpoints (optional) ────────────────────────────────────

if (MOLTBOOK_API_TOKEN) {
  const moltbookHeaders = { Authorization: `Bearer ${MOLTBOOK_API_TOKEN}` }

  app.get('/moltbook/home', async (_req, res) => {
    try {
      const response = await fetch(`${MOLTBOOK_BASE}/home`, { headers: moltbookHeaders })
      const data = await response.json()
      res.status(response.status).json(data)
    } catch (e: any) {
      res.status(502).json({ error: 'Failed to reach Moltbook', details: e.message })
    }
  })

  app.get('/moltbook/profile', async (_req, res) => {
    try {
      const response = await fetch(`${MOLTBOOK_BASE}/agents/me`, { headers: moltbookHeaders })
      const data = await response.json()
      res.status(response.status).json(data)
    } catch (e: any) {
      res.status(502).json({ error: 'Failed to reach Moltbook', details: e.message })
    }
  })

  app.get('/moltbook/posts', async (_req, res) => {
    try {
      let response = await fetch(`${MOLTBOOK_BASE}/agents/${MOLTBOOK_AGENT_NAME}/posts`, { headers: moltbookHeaders })
      if (response.status === 404) {
        response = await fetch(`${MOLTBOOK_BASE}/search?q=${MOLTBOOK_AGENT_NAME}&type=posts`, { headers: moltbookHeaders })
      }
      const data = await response.json()
      res.status(response.status).json(data)
    } catch (e: any) {
      res.status(502).json({ error: 'Failed to reach Moltbook', details: e.message })
    }
  })
} else {
  // Moltbook not configured — return helpful message
  const moltbookDisabled = (_req: any, res: any) => {
    res.status(501).json({ error: 'Moltbook integration not configured. Set MOLTBOOK_API_TOKEN in .env' })
  }
  app.get('/moltbook/home', moltbookDisabled)
  app.get('/moltbook/profile', moltbookDisabled)
  app.get('/moltbook/posts', moltbookDisabled)
}

// ─── Agents Playground endpoint ─────────────────────────────────────────────

app.get('/agents/playground', async (_req, res) => {
  try {
    const [cronRaw, subagentRaw, sessionsRaw, progressRaw, logsRaw] = await Promise.allSettled([
      readFile(CRON_JOBS_FILE, 'utf-8'),
      readFile(SUBAGENT_RUNS_FILE, 'utf-8'),
      readFile(SESSIONS_FILE, 'utf-8'),
      readFile(PROGRESS_FILE, 'utf-8'),
      readdir(LOGS_DIR).then(async (files) => {
        const logFiles = files.filter(f => f.endsWith('.log') || f.endsWith('.json'))
        const stats = await Promise.all(
          logFiles.map(async (f) => {
            const s = await stat(join(LOGS_DIR, f))
            return { name: f, modifiedAt: s.mtimeMs, size: s.size }
          })
        )
        return stats.sort((a, b) => b.modifiedAt - a.modifiedAt)
      }),
    ])

    const cronJobs = cronRaw.status === 'fulfilled' ? JSON.parse(cronRaw.value).jobs ?? [] : []
    const subagentRuns = subagentRaw.status === 'fulfilled' ? JSON.parse(subagentRaw.value).runs ?? {} : {}
    const sessions = sessionsRaw.status === 'fulfilled' ? JSON.parse(sessionsRaw.value) : {}
    const progress = progressRaw.status === 'fulfilled' ? JSON.parse(progressRaw.value) : {}
    const recentLogs = logsRaw.status === 'fulfilled' ? logsRaw.value.slice(0, 10) : []

    const subagentList = Object.values(subagentRuns).map((run: any) => ({
      runId: run.runId,
      task: run.task?.substring(0, 300) + (run.task?.length > 300 ? '...' : ''),
      status: run.outcome?.status ?? (run.endedAt ? 'ended' : 'running'),
      model: run.model,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      durationMs: run.endedAt && run.startedAt ? run.endedAt - run.startedAt : null,
      result: run.frozenResultText?.substring(0, 500) + (run.frozenResultText?.length > 500 ? '...' : ''),
    }))

    const sessionList = Object.entries(sessions).map(([key, s]: [string, any]) => ({
      key,
      sessionId: s.sessionId,
      updatedAt: s.updatedAt,
      chatType: s.chatType,
      channel: s.origin?.surface ?? s.deliveryContext?.channel ?? 'unknown',
      label: s.origin?.label ?? key,
      compactionCount: s.compactionCount ?? 0,
    }))

    res.json({
      cronJobs,
      subagents: subagentList.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
      sessions: sessionList,
      progress,
      recentLogs,
      fetchedAt: Date.now(),
    })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to aggregate agent data', details: e.message })
  }
})

// ─── MCP Explorer endpoint ──────────────────────────────────────────────────

interface McpServer {
  name: string
  description: string
  url: string
  category: string
  lang: string[]
  scope: string[]
  official: boolean
}

let mcpCache: { data: McpServer[]; categories: string[]; fetchedAt: number } | null = null
const MCP_TTL = 60 * 60 * 1000 // 1 hour

function parseMcpReadme(content: string): { servers: McpServer[]; categories: string[] } {
  const servers: McpServer[] = []
  const categories: string[] = []
  let currentCategory = ''

  const langMap: Record<string, string> = {
    '🐍': 'Python', '📇': 'TypeScript', '🏎️': 'Go', '🦀': 'Rust',
    '#️⃣': 'C#', '☕': 'Java', '🌊': 'C/C++', '💎': 'Ruby',
  }
  const scopeMap: Record<string, string> = {
    '☁️': 'Cloud', '🏠': 'Local', '📟': 'Embedded',
  }

  for (const line of content.split('\n')) {
    const catMatch = line.match(/^###\s+.*<a name="([^"]+)"><\/a>(.+)$/)
    if (catMatch) {
      currentCategory = catMatch[2].trim().replace(/\p{Emoji}/gu, '').trim()
      if (currentCategory && !categories.includes(currentCategory)) {
        categories.push(currentCategory)
      }
      continue
    }

    if (!line.startsWith('- ') || !currentCategory) continue
    if (['What is MCP?', 'Clients', 'Tutorials', 'Community', 'Legend', 'Frameworks', 'Tips & Tricks'].includes(currentCategory)) continue

    const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
    if (!linkMatch) continue

    const name = linkMatch[1]
    const url = linkMatch[2]

    const stripped = line
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    const descMatch = stripped.match(/\)\s*[-–]\s*(.+)$/)
    const description = descMatch
      ? descMatch[1].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
      : ''

    const langs: string[] = []
    const scopes: string[] = []
    for (const [emoji, label] of Object.entries(langMap)) {
      if (line.includes(emoji)) langs.push(label)
    }
    for (const [emoji, label] of Object.entries(scopeMap)) {
      if (line.includes(emoji)) scopes.push(label)
    }
    const official = line.includes('🎖️')

    if (name && url) {
      servers.push({ name, description, url, category: currentCategory, lang: langs, scope: scopes, official })
    }
  }

  return { servers, categories: categories.sort() }
}

app.get('/mcp/servers', async (_req, res) => {
  if (!MCP_README) {
    return res.status(501).json({ error: 'MCP Explorer not configured. Set MCP_README in .env to the path of an awesome-mcp-servers README.md' })
  }
  try {
    if (mcpCache && Date.now() - mcpCache.fetchedAt < MCP_TTL) {
      return res.json(mcpCache)
    }
    const content = await readFile(MCP_README, 'utf-8')
    const { servers, categories } = parseMcpReadme(content)
    mcpCache = { data: servers, categories, fetchedAt: Date.now() }
    res.json(mcpCache)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Start server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Agent Bunker backend running on http://localhost:${PORT}`)
  console.log(`  Workspace:  ${WORKSPACE_ROOT}`)
  console.log(`  Cron file:  ${CRON_JOBS_FILE}`)
  console.log(`  Activity:   ${ACTIVITY_FILE}`)
  console.log(`  Moltbook:   ${MOLTBOOK_API_TOKEN ? 'enabled' : 'disabled'}`)
  console.log(`  Usage:      ${USAGE_SCRIPT || 'disabled'}`)
  console.log(`  MCP:        ${MCP_README || 'disabled'}`)
})
