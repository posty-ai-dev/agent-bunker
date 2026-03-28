import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Puzzle } from 'lucide-react'
import { apiFetch } from '../../lib/utils'

interface Skill {
  name: string
  description: string
  emoji: string
  path: string
}

export default function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiFetch('/skills')
      .then((data) => {
        setSkills(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills
    const q = search.toLowerCase()
    return skills.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
  }, [skills, search])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Skills Registry</h2>
          </div>
        </div>
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-900/60 border border-zinc-800/50 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600/40 transition-all"
          />
        </div>
        <p className="text-xs text-zinc-500 mt-2">{filteredSkills.length} skills found</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="rounded-xl border border-rose-800/40 bg-rose-900/20 p-4 mb-6">
            <p className="text-sm text-rose-400">Failed to load skills: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800" />
                  <div className="flex-1">
                    <div className="h-4 bg-zinc-800 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-zinc-800/60 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-zinc-600">
            <div className="text-center">
              <Puzzle className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">{search ? 'No matching skills' : 'No skills found'}</p>
              <p className="text-xs text-zinc-600 mt-1">Add skill directories to SKILL_DIRS in your .env</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill, i) => (
              <motion.div
                key={skill.path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                whileHover={{ scale: 1.01 }}
                className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm p-5 transition-shadow hover:shadow-lg hover:shadow-black/20 group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{skill.emoji || '🔧'}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-violet-400 transition-colors">{skill.name}</h3>
                    {skill.description && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-3">{skill.description}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
