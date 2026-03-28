import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Activity } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

interface ActivityEntry {
  timestamp: string
  tag: string
  summary: string
}

const TAG_STYLES: Record<string, { border: string; badge: string }> = {
  MOLTBOOK: { border: 'border-l-violet-500', badge: 'bg-violet-500/15 text-violet-300' },
  BUILD:    { border: 'border-l-blue-500', badge: 'bg-blue-500/15 text-blue-300' },
  CRON:     { border: 'border-l-amber-500', badge: 'bg-amber-500/15 text-amber-300' },
  FIX:      { border: 'border-l-rose-500', badge: 'bg-rose-500/15 text-rose-300' },
  MEMORY:   { border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300' },
  USAGE:    { border: 'border-l-zinc-500', badge: 'bg-zinc-500/15 text-zinc-300' },
  RESEARCH: { border: 'border-l-cyan-500', badge: 'bg-cyan-500/15 text-cyan-300' },
  RESET:    { border: 'border-l-rose-500', badge: 'bg-rose-500/15 text-rose-300' },
  TASK:     { border: 'border-l-indigo-500', badge: 'bg-indigo-500/15 text-indigo-300' },
  LOG:      { border: 'border-l-zinc-500', badge: 'bg-zinc-500/15 text-zinc-400' },
}

function getTagStyle(tag: string) {
  return TAG_STYLES[tag.toUpperCase()] || { border: 'border-l-zinc-600', badge: 'bg-zinc-500/15 text-zinc-400' }
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return timestamp
  }
}

export default function ActivityTab() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchActivity = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await apiFetch('/activity')
      setEntries([...data].reverse())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(() => fetchActivity(), 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Activity Log</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{entries.length} entries</p>
        </div>
        <button
          onClick={() => fetchActivity(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="rounded-xl border border-rose-800/40 bg-rose-900/20 p-4 mb-6">
            <p className="text-sm text-rose-400">Failed to load activity: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-zinc-800/60 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-zinc-600">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No activity recorded yet</p>
              <p className="text-xs text-zinc-600 mt-1">Add entries to your activity.json file to see them here</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const style = getTagStyle(entry.tag)
              return (
                <motion.div
                  key={`${entry.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.6), duration: 0.2, ease: 'easeOut' }}
                  whileHover={{ scale: 1.01 }}
                  className={cn(
                    'rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm p-4 border-l-[3px] transition-shadow hover:shadow-lg hover:shadow-black/20',
                    style.border
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase', style.badge)}>
                      {entry.tag}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{entry.summary}</p>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
