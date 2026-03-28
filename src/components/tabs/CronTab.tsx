import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, Pause, ChevronDown, ChevronUp, Trash2, ToggleLeft, ToggleRight, Pencil, Save, X } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

interface CronSchedule {
  kind: 'cron' | 'every' | 'at'
  expr?: string
  everyMs?: number
  at?: string
  tz?: string
}

interface CronState {
  nextRunAtMs?: number
  lastRunAtMs?: number
  lastRunStatus?: string
  lastStatus?: string
  lastDurationMs?: number
  lastError?: string
  consecutiveErrors?: number
}

interface CronJob {
  id: string
  name: string
  description?: string
  enabled: boolean
  deleteAfterRun?: boolean
  createdAtMs: number
  updatedAtMs?: number
  schedule: CronSchedule
  payload?: { kind: string; message?: string; timeoutSeconds?: number }
  state?: CronState
}

function formatSchedule(s: CronSchedule): string {
  if (s.kind === 'cron') return `${s.expr}${s.tz ? ` (${s.tz})` : ''}`
  if (s.kind === 'every') {
    const ms = s.everyMs ?? 0
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `Every ${h}h${m > 0 ? ` ${m}m` : ''}` : `Every ${m}m`
  }
  if (s.kind === 'at') {
    try { return `Once at ${new Date(s.at!).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}` }
    catch { return `At: ${s.at}` }
  }
  return 'Unknown'
}

function formatTs(ms?: number): string {
  if (!ms) return '--'
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function StatusBadge({ status, enabled }: { status?: string; enabled: boolean }) {
  if (!enabled) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-700/40 text-zinc-500">
      <Pause className="w-3 h-3" /> Disabled
    </span>
  )
  if (!status) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-700/40 text-zinc-400">
      <Clock className="w-3 h-3" /> Pending
    </span>
  )
  if (status === 'ok' || status === 'success') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> OK
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-400">
      <XCircle className="w-3 h-3" /> Error
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-400">
      <AlertCircle className="w-3 h-3" /> {status}
    </span>
  )
}

interface EditForm {
  name: string
  description: string
  scheduleExpr: string
  scheduleTz: string
  message: string
  timeoutSeconds: string
}

function EditModal({ job, onSave, onClose }: { job: CronJob; onSave: (id: string, patch: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<EditForm>({
    name: job.name,
    description: job.description ?? '',
    scheduleExpr: job.schedule.kind === 'cron' ? (job.schedule.expr ?? '') : '',
    scheduleTz: job.schedule.tz ?? 'UTC',
    message: job.payload?.message ?? '',
    timeoutSeconds: String(job.payload?.timeoutSeconds ?? 300),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const patch: any = {
        name: form.name,
        description: form.description,
        payload: {
          ...job.payload,
          message: form.message,
          timeoutSeconds: Number(form.timeoutSeconds),
        },
      }
      if (job.schedule.kind === 'cron' && form.scheduleExpr) {
        patch.schedule = { kind: 'cron', expr: form.scheduleExpr, tz: form.scheduleTz }
      }
      await onSave(job.id, patch)
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
          <h3 className="text-sm font-semibold text-zinc-100">Edit Job</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          {job.schedule.kind === 'cron' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Cron Expression</label>
                <input
                  value={form.scheduleExpr}
                  onChange={e => setForm(f => ({ ...f, scheduleExpr: e.target.value }))}
                  placeholder="0 4 * * *"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Timezone</label>
                <input
                  value={form.scheduleTz}
                  onChange={e => setForm(f => ({ ...f, scheduleTz: e.target.value }))}
                  placeholder="UTC"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Payload Message</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={10}
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono resize-y focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Timeout (seconds)</label>
            <input
              type="number"
              value={form.timeoutSeconds}
              onChange={e => setForm(f => ({ ...f, timeoutSeconds: e.target.value }))}
              className="w-40 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-900/20 border border-rose-800/30 px-3 py-2">
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800/60">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function CronTab() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editJob, setEditJob] = useState<CronJob | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchJobs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await apiFetch('/cron/jobs')
      setJobs(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(() => fetchJobs(), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleToggle = async (job: CronJob) => {
    setActionLoading(job.id + '-toggle')
    try {
      const res = await apiFetch(`/cron/jobs/${job.id}/toggle`, { method: 'POST' })
      setJobs(js => js.map(j => j.id === job.id ? { ...j, enabled: res.enabled } : j))
    } catch (e: any) {
      alert('Failed to toggle: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (job: CronJob) => {
    if (!confirm(`Delete "${job.name}"?`)) return
    setActionLoading(job.id + '-delete')
    try {
      await apiFetch(`/cron/jobs/${job.id}`, { method: 'DELETE' })
      setJobs(js => js.filter(j => j.id !== job.id))
    } catch (e: any) {
      alert('Failed to delete: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSave = async (id: string, patch: any) => {
    const res = await apiFetch(`/cron/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setJobs(js => js.map(j => j.id === id ? res : j))
  }

  const enabled = jobs.filter(j => j.enabled).length
  const disabled = jobs.filter(j => !j.enabled).length

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Cron & Jobs</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{enabled} active · {disabled} disabled</p>
        </div>
        <button
          onClick={() => fetchJobs(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="rounded-xl border border-rose-800/40 bg-rose-900/20 p-4 mb-6">
            <p className="text-sm text-rose-400">Failed to load jobs: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-1/2 mb-2" />
                <div className="h-3 bg-zinc-800/60 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No cron jobs configured</p>
              <p className="text-xs text-zinc-600 mt-1">Add jobs to your cron/jobs.json file</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job, i) => {
              const isExpanded = expanded === job.id
              const borderColor = !job.enabled ? 'border-l-zinc-700'
                : job.state?.lastStatus === 'error' ? 'border-l-rose-500'
                : job.state?.lastStatus === 'ok' || job.state?.lastStatus === 'success' ? 'border-l-emerald-500'
                : 'border-l-violet-500'

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.5), duration: 0.2 }}
                  className={cn(
                    'rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm border-l-[3px] overflow-hidden transition-shadow hover:shadow-lg hover:shadow-black/20',
                    borderColor
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium text-zinc-100">{job.name}</span>
                          {job.deleteAfterRun && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-700/50 text-zinc-500">one-shot</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 font-mono">{formatSchedule(job.schedule)}</p>
                        {job.description && <p className="text-xs text-zinc-600 mt-0.5 truncate">{job.description}</p>}
                      </div>
                      <StatusBadge status={job.state?.lastStatus} enabled={job.enabled} />
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-[11px] text-zinc-600 font-mono">
                      <span>Last: {formatTs(job.state?.lastRunAtMs)}</span>
                      <span>Next: {formatTs(job.state?.nextRunAtMs)}</span>
                      {job.state?.lastDurationMs && <span>{(job.state.lastDurationMs / 1000).toFixed(1)}s</span>}
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => handleToggle(job)}
                        disabled={actionLoading === job.id + '-toggle'}
                        title={job.enabled ? 'Disable' : 'Enable'}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                          job.enabled
                            ? 'border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/20'
                            : 'border-zinc-700/50 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
                        )}
                      >
                        {job.enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        {job.enabled ? 'Enabled' : 'Disabled'}
                      </button>

                      <button
                        onClick={() => setEditJob(job)}
                        title="Edit job"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>

                      <button
                        onClick={() => setExpanded(isExpanded ? null : job.id)}
                        title="Details"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Less' : 'Details'}
                      </button>

                      <button
                        onClick={() => handleDelete(job)}
                        disabled={actionLoading === job.id + '-delete'}
                        title="Delete job"
                        className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-rose-900/40 text-rose-500 hover:bg-rose-900/20 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="border-t border-zinc-800/50 px-4 py-3 space-y-3"
                      >
                        <div className="flex gap-6 text-xs flex-wrap">
                          <div>
                            <p className="text-zinc-600 mb-0.5">Job ID</p>
                            <p className="text-zinc-400 font-mono text-[11px]">{job.id}</p>
                          </div>
                          <div>
                            <p className="text-zinc-600 mb-0.5">Created</p>
                            <p className="text-zinc-400 font-mono text-[11px]">{formatTs(job.createdAtMs)}</p>
                          </div>
                          {job.state?.consecutiveErrors ? (
                            <div>
                              <p className="text-zinc-600 mb-0.5">Consecutive errors</p>
                              <p className="text-rose-400 font-mono text-[11px]">{job.state.consecutiveErrors}</p>
                            </div>
                          ) : null}
                        </div>
                        {job.state?.lastError && (
                          <div className="rounded-lg bg-rose-900/20 border border-rose-800/30 px-3 py-2">
                            <p className="text-[11px] text-rose-400 font-mono break-all">{job.state.lastError}</p>
                          </div>
                        )}
                        {job.payload?.message && (
                          <div>
                            <p className="text-zinc-600 text-[11px] mb-1">Payload</p>
                            <pre className="text-[11px] text-zinc-400 font-mono bg-zinc-800/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                              {job.payload.message}
                            </pre>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editJob && (
          <EditModal
            job={editJob}
            onSave={handleSave}
            onClose={() => setEditJob(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
