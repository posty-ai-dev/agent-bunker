import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw,
  Bot,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Radio,
  ChevronDown,
  ChevronUp,
  Terminal,
  Cpu,
  Activity,
  Layers,
} from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

// ─── Types ──────────────────────────────────────────

interface CronJob {
  id: string
  name: string
  description?: string
  enabled: boolean
  schedule: { kind: string; expr?: string; everyMs?: number; tz?: string }
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastStatus?: string
    lastDurationMs?: number
    lastError?: string
    consecutiveErrors?: number
  }
  payload?: { message?: string }
}

interface SubagentRun {
  runId: string
  task: string
  status: string
  model: string
  createdAt: number
  startedAt?: number
  endedAt?: number
  durationMs?: number | null
  result?: string
}

interface AgentSession {
  key: string
  sessionId: string
  updatedAt: number
  chatType: string
  channel: string
  label: string
  compactionCount: number
}

interface LogFile {
  name: string
  modifiedAt: number
  size: number
}

interface PlaygroundData {
  cronJobs: CronJob[]
  subagents: SubagentRun[]
  sessions: AgentSession[]
  progress: any
  recentLogs: LogFile[]
  fetchedAt: number
}

// ─── Helpers ────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 0) return 'just now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function countdown(ms: number): string {
  const diff = ms - Date.now()
  if (diff <= 0) return 'now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const secs = ms / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${Math.floor(secs % 60)}s`
}

function formatTs(ms?: number): string {
  if (!ms) return '--'
  return new Date(ms).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ─── Status Pill ────────────────────────────────────

function StatusPill({ status, enabled = true }: { status?: string; enabled?: boolean }) {
  if (!enabled) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> offline
    </span>
  )
  if (status === 'ok' || status === 'success') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
      </span>
      ok
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
      <XCircle className="w-3 h-3" /> error
    </span>
  )
  if (status === 'running') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
      </span>
      running
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="w-3 h-3" /> pending
    </span>
  )
}

// ─── Animated Counter ───────────────────────────────

function LiveCounter({ targetMs }: { targetMs: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  return <span className="font-mono tabular-nums text-violet-300">{countdown(targetMs)}</span>
}

// ─── Glowing Orb ────────────────────────────────────

function AgentOrb({ status }: { status: 'active' | 'idle' | 'error' }) {
  const colors = {
    active: 'bg-emerald-500 shadow-emerald-500/50',
    idle: 'bg-amber-500 shadow-amber-500/50',
    error: 'bg-rose-500 shadow-rose-500/50',
  }
  return (
    <div className="relative">
      <div className={cn('w-3 h-3 rounded-full shadow-lg', colors[status])}>
        {status === 'active' && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-40 bg-emerald-400" />
        )}
      </div>
    </div>
  )
}

// ─── Cron Job Card ──────────────────────────────────

function CronJobCard({ job, index }: { job: CronJob; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = !job.enabled ? 'border-l-zinc-700'
    : job.state?.lastStatus === 'error' ? 'border-l-rose-500'
    : job.state?.lastStatus === 'ok' || job.state?.lastStatus === 'success' ? 'border-l-emerald-500'
    : 'border-l-violet-500'

  const scheduleLabel = job.schedule.kind === 'cron'
    ? job.schedule.expr
    : job.schedule.kind === 'every'
    ? `every ${formatDuration(job.schedule.everyMs ?? 0)}`
    : job.schedule.kind

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm border-l-[3px] overflow-hidden transition-all hover:bg-zinc-900/60 hover:shadow-lg hover:shadow-black/20',
        borderColor
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AgentOrb status={!job.enabled ? 'idle' : job.state?.lastStatus === 'error' ? 'error' : 'active'} />
              <span className="text-sm font-semibold text-zinc-100 truncate">{job.name}</span>
            </div>
            {job.description && (
              <p className="text-xs text-zinc-500 truncate ml-5">{job.description}</p>
            )}
          </div>
          <StatusPill status={job.state?.lastStatus} enabled={job.enabled} />
        </div>

        <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-mono ml-5 mt-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {scheduleLabel}
          </span>
          {job.state?.lastDurationMs && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> {formatDuration(job.state.lastDurationMs)}
            </span>
          )}
          {job.state?.consecutiveErrors ? (
            <span className="text-rose-400">{job.state.consecutiveErrors} errors</span>
          ) : null}
        </div>

        {job.enabled && job.state?.nextRunAtMs && (
          <div className="flex items-center gap-2 mt-3 ml-5 px-3 py-1.5 rounded-lg bg-violet-500/5 border border-violet-500/10 w-fit">
            <Radio className="w-3 h-3 text-violet-400" />
            <span className="text-[11px] text-zinc-400">Next run in</span>
            <LiveCounter targetMs={job.state.nextRunAtMs} />
          </div>
        )}

        <div className="flex items-center gap-4 mt-2 ml-5 text-[11px] text-zinc-600 font-mono">
          {job.state?.lastRunAtMs && <span>Last: {timeAgo(job.state.lastRunAtMs)}</span>}
          {job.state?.nextRunAtMs && <span>Next: {formatTs(job.state.nextRunAtMs)}</span>}
        </div>

        {(job.state?.lastError || job.payload?.message) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-2 ml-5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Less' : 'Details'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-zinc-800/40 px-4 py-3 space-y-2"
          >
            {job.state?.lastError && (
              <div className="rounded-lg bg-rose-950/30 border border-rose-800/20 px-3 py-2">
                <p className="text-[11px] font-mono text-rose-400 break-all">{job.state.lastError}</p>
              </div>
            )}
            {job.payload?.message && (
              <div>
                <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider mb-1">Task Payload</p>
                <pre className="text-[11px] text-zinc-400 font-mono bg-zinc-800/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {job.payload.message.substring(0, 600)}{job.payload.message.length > 600 ? '...' : ''}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Subagent Card ──────────────────────────────────

function SubagentCard({ run, index }: { run: SubagentRun; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm overflow-hidden hover:bg-zinc-900/60 transition-all hover:shadow-lg hover:shadow-black/20"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-mono text-zinc-400 truncate">{run.runId.substring(0, 8)}</p>
              <p className="text-[10px] text-zinc-600">{run.model?.split('/').pop()}</p>
            </div>
          </div>
          <StatusPill status={run.status} />
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2 mb-2">
          {run.task}
        </p>

        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
          {run.createdAt && <span>{timeAgo(run.createdAt)}</span>}
          {run.durationMs && <span>{formatDuration(run.durationMs)}</span>}
        </div>

        {run.result && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide result' : 'Show result'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && run.result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-zinc-800/40 px-4 py-3"
          >
            <pre className="text-[11px] text-zinc-400 font-mono bg-zinc-800/30 rounded-lg p-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {run.result}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Session Badge ──────────────────────────────────

function SessionCard({ session }: { session: AgentSession }) {
  const isRecent = Date.now() - session.updatedAt < 300_000
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-800/40 hover:bg-zinc-800/50 transition-colors">
      <div className={cn(
        'w-2 h-2 rounded-full shrink-0',
        isRecent ? 'bg-emerald-400' : 'bg-zinc-600'
      )} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-300 truncate">{session.label}</p>
        <p className="text-[10px] text-zinc-600 font-mono">{session.channel} · {timeAgo(session.updatedAt)}</p>
      </div>
      {session.compactionCount > 0 && (
        <span className="text-[10px] font-mono text-zinc-600 shrink-0">{session.compactionCount} compactions</span>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────

export default function AgentsPlaygroundTab() {
  const [data, setData] = useState<PlaygroundData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const result = await apiFetch('/agents/playground')
      setData(result)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 10000)
    return () => clearInterval(interval)
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const activeJobs = data.cronJobs.filter(j => j.enabled).length
    const errorJobs = data.cronJobs.filter(j => j.state?.lastStatus === 'error').length
    const runningSubagents = data.subagents.filter(s => s.status === 'running').length
    const totalSubagents = data.subagents.length
    const activeSessions = data.sessions.filter(s => Date.now() - s.updatedAt < 300_000).length
    return { activeJobs, errorJobs, runningSubagents, totalSubagents, activeSessions, totalSessions: data.sessions.length }
  }, [data])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-violet-400" />
            Agents Playground
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Live agent activity · auto-refresh 10s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-[11px] text-zinc-600 font-mono">
              synced {timeAgo(data.fetchedAt)}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-800/40 bg-rose-900/20 p-4">
            <p className="text-sm text-rose-400">Failed to load: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse">
                  <div className="h-6 bg-zinc-800 rounded w-12 mb-2" />
                  <div className="h-3 bg-zinc-800/60 rounded w-20" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse">
                  <div className="h-4 bg-zinc-800 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-zinc-800/60 rounded w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ) : data && stats ? (
          <div className="p-6 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0, duration: 0.2 }}
                className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm p-4 hover:border-emerald-500/20 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-2xl font-bold text-emerald-400 tabular-nums">{stats.activeJobs}</span>
                </div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Active Jobs</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05, duration: 0.2 }}
                className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm p-4 hover:border-rose-500/20 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span className={cn('text-2xl font-bold tabular-nums', stats.errorJobs > 0 ? 'text-rose-400' : 'text-zinc-600')}>{stats.errorJobs}</span>
                </div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Errors</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.2 }}
                className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm p-4 hover:border-blue-500/20 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <span className="text-2xl font-bold text-blue-400 tabular-nums">{stats.totalSubagents}</span>
                </div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Subagent Runs</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.2 }}
                className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm p-4 hover:border-violet-500/20 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <span className="text-2xl font-bold text-violet-400 tabular-nums">{stats.activeSessions}</span>
                  <span className="text-sm text-zinc-600">/ {stats.totalSessions}</span>
                </div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Sessions</p>
              </motion.div>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">Scheduled Tasks</h3>
                  <span className="text-[10px] text-zinc-600 font-mono ml-auto">{data.cronJobs.length} jobs</span>
                </div>
                {data.cronJobs.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
                    No scheduled tasks
                  </div>
                ) : (
                  data.cronJobs.map((job, i) => (
                    <CronJobCard key={job.id} job={job} index={i} />
                  ))
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-200">Active Sessions</h3>
                  </div>
                  <div className="space-y-1.5">
                    {data.sessions.length === 0 ? (
                      <p className="text-xs text-zinc-600 py-4 text-center">No sessions</p>
                    ) : (
                      data.sessions.map(s => (
                        <SessionCard key={s.key} session={s} />
                      ))
                    )}
                  </div>
                </div>

                {data.recentLogs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="w-4 h-4 text-zinc-500" />
                      <h3 className="text-sm font-semibold text-zinc-200">Recent Logs</h3>
                    </div>
                    <div className="space-y-1">
                      {data.recentLogs.map(log => (
                        <div key={log.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/20 border border-zinc-800/30">
                          <span className="text-[11px] font-mono text-zinc-400 truncate">{log.name}</span>
                          <span className="text-[10px] text-zinc-600 font-mono shrink-0 ml-2">{timeAgo(log.modifiedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subagent Runs */}
            {data.subagents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">Subagent Runs</h3>
                  <span className="text-[10px] text-zinc-600 font-mono ml-auto">{data.subagents.length} runs</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.subagents.map((run, i) => (
                    <SubagentCard key={run.runId} run={run} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
