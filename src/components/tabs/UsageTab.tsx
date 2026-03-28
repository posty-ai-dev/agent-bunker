import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

interface UsageWindow {
  label: string
  used: number
  limit: number
  resetAt: string
  percentage: number
}

export default function UsageTab() {
  const [usage, setUsage] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchUsage = async () => {
    try {
      const data = await apiFetch('/usage')
      setUsage(data)
      setError(null)
      setLastRefresh(new Date())
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => {
    fetchUsage()
    const interval = setInterval(fetchUsage, 60000)
    return () => clearInterval(interval)
  }, [])

  const getBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-red-500'
    if (pct >= 50) return 'bg-yellow-500'
    return 'bg-emerald-500'
  }

  const getTextColor = (pct: number) => {
    if (pct >= 80) return 'text-red-400'
    if (pct >= 50) return 'text-yellow-400'
    return 'text-emerald-400'
  }

  const getGlowColor = (pct: number) => {
    if (pct >= 80) return 'shadow-red-500/10'
    if (pct >= 50) return 'shadow-yellow-500/10'
    return 'shadow-emerald-500/10'
  }

  const parseUsage = (): UsageWindow[] => {
    if (!usage) return []
    const windows: UsageWindow[] = []

    if (usage.session || usage.five_hour || usage['5h']) {
      const s = usage.session || usage.five_hour || usage['5h'] || {}
      const pct = s.percentage ?? s.percent ?? (s.limit ? Math.round((s.used / s.limit) * 100) : 0)
      windows.push({
        label: 'Session (5h window)',
        used: s.used ?? 0,
        limit: s.limit ?? 0,
        resetAt: s.reset_at ?? s.resetAt ?? s.resets ?? '',
        percentage: pct,
      })
    }

    if (usage.weekly || usage.seven_day || usage['7d']) {
      const w = usage.weekly || usage.seven_day || usage['7d'] || {}
      const pct = w.percentage ?? w.percent ?? (w.limit ? Math.round((w.used / w.limit) * 100) : 0)
      windows.push({
        label: 'Weekly (7d window)',
        used: w.used ?? 0,
        limit: w.limit ?? 0,
        resetAt: w.reset_at ?? w.resetAt ?? w.resets ?? '',
        percentage: pct,
      })
    }

    if (windows.length === 0 && usage.raw) return []
    return windows
  }

  const windows = parseUsage()

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Usage Monitor</h2>
          <p className="text-xs text-zinc-500">API usage tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-zinc-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchUsage}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-700/60 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="glass-card rounded-xl p-4 mb-6 border-red-800/40">
            <p className="text-sm text-red-400">{error}</p>
            <p className="text-xs text-red-500 mt-2">
              {error.includes('not configured')
                ? 'Set USAGE_SCRIPT in your .env file to enable usage monitoring.'
                : error.includes('rate')
                ? 'The API is temporarily rate-limited. Try again in a few moments.'
                : error.includes('credentials')
                ? 'Agent credentials are not configured.'
                : 'Please check your configuration and try again.'}
            </p>
          </div>
        )}

        {windows.length > 0 ? (
          <div className="space-y-6">
            {windows.map((w, i) => (
              <motion.div
                key={w.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn('glass-card rounded-xl p-6 shadow-lg', getGlowColor(w.percentage))}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-zinc-300">{w.label}</h3>
                  <span className={cn('text-2xl font-bold', getTextColor(w.percentage))}>
                    {w.percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(w.percentage, 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', getBarColor(w.percentage))}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {w.used.toLocaleString()} / {w.limit.toLocaleString()} tokens
                  </span>
                  {w.resetAt && <span>Resets: {w.resetAt}</span>}
                </div>
              </motion.div>
            ))}
          </div>
        ) : usage?.raw ? (
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-sm font-medium mb-3 text-zinc-300">Raw Usage Output</h3>
            <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">{usage.raw}</pre>
          </div>
        ) : !error ? (
          <div className="flex items-center justify-center h-64 text-zinc-600">
            <div className="text-center">
              <BarChartIcon className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm">Loading usage data...</p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-600">Auto-refreshes every 60 seconds</p>
        </div>
      </div>
    </div>
  )
}

function BarChartIcon(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 16h8" /><path d="M7 11h12" /><path d="M7 6h3" />
    </svg>
  )
}
