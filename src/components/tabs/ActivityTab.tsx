import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Activity, Search, X, ChevronDown } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

interface ActivityEntry {
  timestamp: string
  tag?: string
  type?: string
  summary?: string
  message?: string
}

const TAG_STYLES: Record<string, { border: string; badge: string }> = {
  MOLTBOOK: { border: 'border-l-violet-500', badge: 'bg-violet-500/15 text-violet-300' },
  BUILD:    { border: 'border-l-blue-500',   badge: 'bg-blue-500/15 text-blue-300' },
  CRON:     { border: 'border-l-amber-500',  badge: 'bg-amber-500/15 text-amber-300' },
  FIX:      { border: 'border-l-rose-500',   badge: 'bg-rose-500/15 text-rose-300' },
  MEMORY:   { border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300' },
  USAGE:    { border: 'border-l-zinc-500',   badge: 'bg-zinc-500/15 text-zinc-300' },
  RESEARCH: { border: 'border-l-cyan-500',   badge: 'bg-cyan-500/15 text-cyan-300' },
  RESET:    { border: 'border-l-rose-500',   badge: 'bg-rose-500/15 text-rose-300' },
  TASK:     { border: 'border-l-indigo-500', badge: 'bg-indigo-500/15 text-indigo-300' },
  LOG:      { border: 'border-l-zinc-500',   badge: 'bg-zinc-500/15 text-zinc-400' },
}

function getTagStyle(tag: string | undefined) {
  if (!tag) return { border: 'border-l-zinc-600', badge: 'bg-zinc-500/15 text-zinc-400' }
  return TAG_STYLES[tag.toUpperCase()] || { border: 'border-l-zinc-600', badge: 'bg-zinc-500/15 text-zinc-400' }
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch { return timestamp }
}

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0]
}

const DATE_PRESETS = [
  { label: 'Today',     getDates: () => { const t = new Date(); return [toDateInputValue(t), toDateInputValue(t)] } },
  { label: 'Yesterday', getDates: () => { const t = new Date(); t.setDate(t.getDate()-1); return [toDateInputValue(t), toDateInputValue(t)] } },
  { label: 'Last 7d',   getDates: () => { const t = new Date(), f = new Date(); f.setDate(f.getDate()-6); return [toDateInputValue(f), toDateInputValue(t)] } },
  { label: 'Last 30d',  getDates: () => { const t = new Date(), f = new Date(); f.setDate(f.getDate()-29); return [toDateInputValue(f), toDateInputValue(t)] } },
]

export default function ActivityTab() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchActivity = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await apiFetch('/activity')
      setEntries(data)
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

  // Collect all unique tags from entries
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    entries.forEach(e => { const t = e.tag || e.type; if (t) tags.add(t.toUpperCase()) })
    return ['ALL', ...Array.from(tags).sort()]
  }, [entries])

  // Apply filters
  const filtered = useMemo(() => {
    return entries.filter(entry => {
      const resolvedTag = (entry.tag || entry.type || 'LOG').toUpperCase()
      const text = (entry.summary || entry.message || '').toLowerCase()

      if (selectedTag !== 'ALL' && resolvedTag !== selectedTag) return false
      if (search && !text.includes(search.toLowerCase()) && !resolvedTag.includes(search.toUpperCase())) return false

      if (dateFrom || dateTo) {
        try {
          const entryDate = toDateInputValue(new Date(entry.timestamp))
          if (dateFrom && entryDate < dateFrom) return false
          if (dateTo && entryDate > dateTo) return false
        } catch { /* skip malformed timestamps */ }
      }

      return true
    })
  }, [entries, selectedTag, search, dateFrom, dateTo])

  const hasActiveFilters = search || selectedTag !== 'ALL' || dateFrom || dateTo

  const clearFilters = () => {
    setSearch('')
    setSelectedTag('ALL')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Activity Log</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {hasActiveFilters
              ? `${filtered.length} of ${entries.length} entries`
              : `${entries.length} entries`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              showFilters || hasActiveFilters
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            )}
          >
            <Search className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 bg-violet-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                {[search, selectedTag !== 'ALL', dateFrom || dateTo].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
          </button>
          <button
            onClick={() => fetchActivity(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-zinc-800/50 bg-zinc-900/40"
          >
            <div className="px-6 py-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Tag filter */}
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5 block">Tag</label>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => {
                      const style = tag === 'ALL' ? null : getTagStyle(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(tag)}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase border transition-colors',
                            selectedTag === tag
                              ? tag === 'ALL'
                                ? 'bg-zinc-200 text-zinc-900 border-zinc-200'
                                : cn(style?.badge, 'border-current')
                              : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/40 hover:text-zinc-300'
                          )}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Date range */}
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5 block">Date Range</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50"
                    />
                    <span className="text-zinc-600 text-xs">→</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {DATE_PRESETS.map(preset => {
                      const [f, t] = preset.getDates()
                      const active = dateFrom === f && dateTo === t
                      return (
                        <button
                          key={preset.label}
                          onClick={() => { setDateFrom(f); setDateTo(t) }}
                          className={cn(
                            'px-2 py-1 rounded-md text-[11px] border transition-colors',
                            active
                              ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                              : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/40 hover:text-zinc-300'
                          )}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-zinc-600">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">
                {hasActiveFilters ? 'No entries match your filters' : 'No activity recorded yet'}
              </p>
              {hasActiveFilters ? (
                <button onClick={clearFilters} className="mt-2 text-xs text-violet-400 hover:text-violet-300">
                  Clear filters
                </button>
              ) : (
                <p className="text-xs text-zinc-600 mt-1">Add entries to your activity.json file to see them here</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry, i) => {
              const resolvedTag = entry.tag || entry.type
              const style = getTagStyle(resolvedTag)
              return (
                <motion.div
                  key={`${entry.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2, ease: 'easeOut' }}
                  whileHover={{ scale: 1.005 }}
                  className={cn(
                    'rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm p-4 border-l-[3px] transition-shadow hover:shadow-lg hover:shadow-black/20',
                    style.border
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase', style.badge)}>
                      {resolvedTag || 'LOG'}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{entry.summary || entry.message || ''}</p>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
