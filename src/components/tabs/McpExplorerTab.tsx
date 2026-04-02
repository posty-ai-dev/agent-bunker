import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, X, ExternalLink, RefreshCw, Package, Star, ChevronDown } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

interface McpServer {
  name: string
  description: string
  url: string
  category: string
  lang: string[]
  scope: string[]
  official: boolean
}

interface McpData {
  data: McpServer[]
  categories: string[]
  fetchedAt: number
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/15 text-blue-300',
  Python:     'bg-yellow-500/15 text-yellow-300',
  Go:         'bg-cyan-500/15 text-cyan-300',
  Rust:       'bg-orange-500/15 text-orange-300',
  'C#':       'bg-purple-500/15 text-purple-300',
  Java:       'bg-red-500/15 text-red-300',
  'C/C++':    'bg-zinc-500/15 text-zinc-300',
  Ruby:       'bg-rose-500/15 text-rose-300',
}

const SCOPE_COLORS: Record<string, string> = {
  Cloud: 'bg-sky-500/15 text-sky-300',
  Local: 'bg-emerald-500/15 text-emerald-300',
  Embedded: 'bg-amber-500/15 text-amber-300',
}

// Priority categories to show first in filter
const PRIORITY_CATS = [
  'Browser Automation', 'Databases', 'Developer Tools', 'Coding Agents',
  'Knowledge & Memory', 'Code Execution', 'File Systems', 'Monitoring',
  'Communication', 'Search', 'Cloud Platforms',
]

function ServerCard({ server, index }: { server: McpServer; index: number }) {
  const isGithub = server.url.includes('github.com')
  const repoName = isGithub ? server.url.replace('https://github.com/', '') : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.4), duration: 0.2 }}
      className="group rounded-xl border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700/60 p-4 transition-all hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {server.official && (
            <span title="Official implementation" className="text-amber-400 text-xs shrink-0">🎖️</span>
          )}
          <span className="text-sm font-semibold text-zinc-100 truncate">{server.name}</span>
        </div>
        <a
          href={server.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors opacity-0 group-hover:opacity-100"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {server.description && (
        <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-2">{server.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {server.lang.map(l => (
          <span key={l} className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', LANG_COLORS[l] || 'bg-zinc-700/40 text-zinc-400')}>{l}</span>
        ))}
        {server.scope.map(s => (
          <span key={s} className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', SCOPE_COLORS[s] || 'bg-zinc-700/40 text-zinc-400')}>{s}</span>
        ))}
        {repoName && (
          <span className="ml-auto text-[10px] font-mono text-zinc-600 truncate max-w-[140px]">{repoName}</span>
        )}
      </div>
    </motion.div>
  )
}

export default function McpExplorerTab() {
  const [mcpData, setMcpData] = useState<McpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [selectedLang, setSelectedLang] = useState('All')
  const [selectedScope, setSelectedScope] = useState('All')
  const [officialOnly, setOfficialOnly] = useState(false)
  const [showAllCats, setShowAllCats] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 30

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await apiFetch('/mcp/servers')
      setMcpData(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, selectedCat, selectedLang, selectedScope, officialOnly])

  const allLangs = useMemo(() => {
    if (!mcpData) return []
    const s = new Set<string>()
    mcpData.data.forEach(sv => sv.lang.forEach(l => s.add(l)))
    return Array.from(s).sort()
  }, [mcpData])

  const filtered = useMemo(() => {
    if (!mcpData) return []
    return mcpData.data.filter(sv => {
      if (selectedCat !== 'All' && sv.category !== selectedCat) return false
      if (selectedLang !== 'All' && !sv.lang.includes(selectedLang)) return false
      if (selectedScope !== 'All' && !sv.scope.includes(selectedScope)) return false
      if (officialOnly && !sv.official) return false
      if (search) {
        const q = search.toLowerCase()
        return sv.name.toLowerCase().includes(q) || sv.description.toLowerCase().includes(q) || sv.category.toLowerCase().includes(q)
      }
      return true
    })
  }, [mcpData, selectedCat, selectedLang, selectedScope, officialOnly, search])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paginated.length < filtered.length

  const visibleCats = useMemo(() => {
    if (!mcpData) return []
    const all = mcpData.categories
    const priority = PRIORITY_CATS.filter(c => all.includes(c))
    const rest = all.filter(c => !PRIORITY_CATS.includes(c))
    return showAllCats ? ['All', ...priority, ...rest] : ['All', ...priority]
  }, [mcpData, showAllCats])

  const hasFilters = search || selectedCat !== 'All' || selectedLang !== 'All' || selectedScope !== 'All' || officialOnly

  const clearFilters = () => {
    setSearch(''); setSelectedCat('All'); setSelectedLang('All')
    setSelectedScope('All'); setOfficialOnly(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            MCP Explorer
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {mcpData
              ? `${filtered.length} of ${mcpData.data.length} servers · ${mcpData.categories.length} categories`
              : 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-zinc-800/50 space-y-3 bg-zinc-900/20">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search servers by name, description, or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div>
          <div className="flex flex-wrap gap-1.5">
            {visibleCats.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                  selectedCat === cat
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/40 hover:text-zinc-300'
                )}
              >
                {cat}
              </button>
            ))}
            {mcpData && !showAllCats && mcpData.categories.length > PRIORITY_CATS.length && (
              <button
                onClick={() => setShowAllCats(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-700/40 text-zinc-600 hover:text-zinc-400 bg-zinc-800/30 flex items-center gap-1"
              >
                +{mcpData.categories.length - PRIORITY_CATS.length} more
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
            {showAllCats && (
              <button onClick={() => setShowAllCats(false)} className="px-2.5 py-1 rounded-lg text-xs border border-zinc-700/40 text-zinc-600 hover:text-zinc-400">
                collapse
              </button>
            )}
          </div>
        </div>

        {/* Lang / Scope / Official row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Language */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-600 uppercase tracking-wide">Lang:</span>
            {['All', ...allLangs].map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                  selectedLang === lang
                    ? lang === 'All' ? 'bg-zinc-200 text-zinc-900 border-zinc-200' : cn(LANG_COLORS[lang], 'border-current')
                    : 'bg-zinc-800/40 text-zinc-600 border-zinc-700/30 hover:text-zinc-400'
                )}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Scope */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-600 uppercase tracking-wide">Scope:</span>
            {['All', 'Cloud', 'Local'].map(scope => (
              <button
                key={scope}
                onClick={() => setSelectedScope(scope)}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                  selectedScope === scope
                    ? scope === 'All' ? 'bg-zinc-200 text-zinc-900 border-zinc-200' : cn(SCOPE_COLORS[scope], 'border-current')
                    : 'bg-zinc-800/40 text-zinc-600 border-zinc-700/30 hover:text-zinc-400'
                )}
              >
                {scope}
              </button>
            ))}
          </div>

          {/* Official only */}
          <button
            onClick={() => setOfficialOnly(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium border transition-colors',
              officialOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-800/40 text-zinc-600 border-zinc-700/30 hover:text-zinc-400'
            )}
          >
            <Star className="w-3 h-3" /> Official only
          </button>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 ml-auto transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="rounded-xl border border-rose-800/40 bg-rose-900/20 p-4 mb-4">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse h-24">
                <div className="h-4 bg-zinc-800 rounded w-1/2 mb-2" />
                <div className="h-3 bg-zinc-800/60 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-800/40 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-zinc-600">
            <div className="text-center">
              <Package className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No servers match your filters</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-xs text-purple-400 hover:text-purple-300">Clear filters</button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {paginated.map((sv, i) => (
                <ServerCard key={`${sv.url}-${i}`} server={sv} index={i} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-6 py-2 rounded-xl border border-zinc-700/50 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
                >
                  Load more ({filtered.length - paginated.length} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
