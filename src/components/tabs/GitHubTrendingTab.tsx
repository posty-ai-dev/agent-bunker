import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, TrendingUp, Star, ExternalLink } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

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

const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-500',
  Python: 'bg-emerald-500',
  Rust: 'bg-orange-500',
  Go: 'bg-cyan-500',
  Java: 'bg-red-500',
  'C++': 'bg-pink-500',
  C: 'bg-zinc-400',
  Ruby: 'bg-rose-500',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-violet-500',
  Shell: 'bg-lime-500',
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

export default function GitHubTrendingTab() {
  const [repos, setRepos] = useState<TrendingRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const fetchTrending = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await apiFetch('/github/trending')
      setRepos(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTrending()
    const interval = setInterval(() => fetchTrending(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(repos.map((r) => r.category))]
    return cats
  }, [repos])

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return repos
    return repos.filter((r) => r.category === activeCategory)
  }, [repos, activeCategory])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">GitHub Trending</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{repos.length} repos across {categories.length - 1} categories</p>
        </div>
        <button
          onClick={() => fetchTrending(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {!loading && repos.length > 0 && (
        <div className="px-6 py-3 border-b border-zinc-800/50 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                activeCategory === cat
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                  : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="rounded-xl border border-rose-800/40 bg-rose-900/20 p-4 mb-6">
            <p className="text-sm text-rose-400">Failed to load trending repos: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-1/2 mb-3" />
                <div className="h-3 bg-zinc-800/60 rounded w-full mb-2" />
                <div className="h-3 bg-zinc-800/60 rounded w-2/3 mb-3" />
                <div className="flex gap-3">
                  <div className="h-3 bg-zinc-800/40 rounded w-16" />
                  <div className="h-3 bg-zinc-800/40 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-zinc-600">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No trending repos found</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((repo, i) => (
              <motion.a
                key={repo.id}
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.6), duration: 0.2, ease: 'easeOut' }}
                whileHover={{ scale: 1.01 }}
                className="group rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm p-4 transition-shadow hover:shadow-lg hover:shadow-black/20 hover:border-zinc-700/50 block"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-violet-300 transition-colors truncate mr-2">
                    {repo.full_name}
                  </h3>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5 transition-colors" />
                </div>

                {repo.description && (
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-2">
                    {repo.description}
                  </p>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {repo.language && (
                    <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span className={cn('w-2.5 h-2.5 rounded-full', LANG_COLORS[repo.language] || 'bg-zinc-500')} />
                      {repo.language}
                    </span>
                  )}

                  <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <Star className="w-3 h-3 text-amber-500" />
                    {formatStars(repo.stargazers_count)}
                  </span>

                  <span className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800/80 text-zinc-500">
                    {repo.category}
                  </span>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
