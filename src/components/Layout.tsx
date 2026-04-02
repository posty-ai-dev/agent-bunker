import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Puzzle,
  FileCode2,
  PanelLeftClose,
  PanelLeft,
  Timer,
  TrendingUp,
  Cpu,
  Package,
} from 'lucide-react'
import type { TabId } from '../App'
import { cn, apiFetch } from '../lib/utils'

const tabs: { id: TabId; label: string; icon?: typeof Activity; emoji?: string }[] = [
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'agents', label: 'Agents', icon: Cpu },
  { id: 'moltbook', label: 'Moltbook', emoji: '🦞' },
  { id: 'cron', label: 'Cron & Jobs', icon: Timer },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'skills', label: 'Skills', icon: Puzzle },
  { id: 'editor', label: 'Editor', icon: FileCode2 },
  { id: 'mcp', label: 'MCP Explorer', icon: Package },
]

interface LayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: React.ReactNode
}

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [usagePct, setUsagePct] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await apiFetch('/usage')
        const s = data.session || data.five_hour || data['5h']
        if (s) {
          const pct = s.percentage ?? s.percent ?? (s.limit ? Math.round((s.used / s.limit) * 100) : null)
          setUsagePct(pct)
        }
      } catch {
        setUsagePct(null)
      }
    }
    fetchUsage()
    const interval = setInterval(fetchUsage, 60000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = days[d.getDay()]
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    const s = d.getSeconds().toString().padStart(2, '0')
    return `${day} ${h}:${m}:${s}`
  }

  const getUsageColor = (pct: number) => {
    if (pct >= 80) return 'text-rose-400'
    if (pct >= 50) return 'text-amber-400'
    return 'text-emerald-400'
  }

  const getUsageBg = (pct: number) => {
    if (pct >= 80) return 'bg-rose-500/10 border-rose-500/20'
    if (pct >= 50) return 'bg-amber-500/10 border-amber-500/20'
    return 'bg-emerald-500/10 border-emerald-500/20'
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex flex-col shrink-0 border-r border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm"
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-zinc-800/50">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">AB</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-semibold text-zinc-100 whitespace-nowrap overflow-hidden"
              >
                Agent Bunker
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={collapsed ? tab.label : undefined}
                className={cn(
                  'relative flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                )}
              >
                {tab.emoji ? (
                  <span className="text-base shrink-0 w-[18px] flex items-center justify-center">{tab.emoji}</span>
                ) : Icon ? (
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                ) : null}
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )
          })}
        </nav>

        {/* Bottom: status + collapse */}
        <div className="p-3 border-t border-zinc-800/50 space-y-2">
          {/* Agent status */}
          <div className={cn(
            'flex items-center gap-2 px-2',
            collapsed ? 'justify-center' : ''
          )}>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs text-zinc-500 whitespace-nowrap overflow-hidden"
                >
                  Agent online
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full h-9 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm">
          <h1 className="text-sm font-semibold text-zinc-100">
            {tabs.find((t) => t.id === activeTab)?.label}
          </h1>
          <div className="flex items-center gap-4">
            {/* Usage badge */}
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border',
              usagePct !== null ? getUsageBg(usagePct) : 'bg-zinc-800/50 border-zinc-700/50'
            )}>
              <span className={cn(
                usagePct !== null ? getUsageColor(usagePct) : 'text-zinc-500'
              )}>
                Session {usagePct !== null ? `${usagePct}%` : '--'}
              </span>
            </div>

            {/* Clock */}
            <span className="text-xs text-zinc-500 font-mono tabular-nums">
              {formatTime(currentTime)}
            </span>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <span className="text-sm font-semibold text-violet-300">A</span>
            </div>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
