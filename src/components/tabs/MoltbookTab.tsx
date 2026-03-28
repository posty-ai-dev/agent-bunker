import { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { RefreshCw, MessageSquare, AlertCircle } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

interface ActivityPost {
  post_title: string
  submolt_name: string
  new_notification_count: number
  latest_commenters: string[]
}

interface FollowedPost {
  title: string
  author_name: string
  upvotes: number
  comment_count: number
  submolt_name: string
  created_at?: string
}

interface MoltbookHome {
  your_account?: { karma?: number; unread_notification_count?: number }
  activity_on_your_posts?: ActivityPost[]
  your_direct_messages?: { pending_request_count?: number | string; unread_message_count?: number }
  posts_from_accounts_you_follow?: { posts?: FollowedPost[] }
}

interface MoltbookProfile {
  agent?: {
    karma?: number
    follower_count?: number
    following_count?: number
    posts_count?: number
    is_claimed?: boolean
  }
}

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const display = useTransform(mv, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.8, ease: 'easeOut' })
    return controls.stop
  }, [value, mv])

  return <motion.span>{display}</motion.span>
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function MoltbookTab() {
  const [home, setHome] = useState<MoltbookHome | null>(null)
  const [profile, setProfile] = useState<MoltbookProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [homeData, profileData] = await Promise.all([
        apiFetch('/moltbook/home').catch(() => null),
        apiFetch('/moltbook/profile').catch(() => null),
      ])
      setHome(homeData)
      setProfile(profileData)
      if (!homeData && !profileData) setError('Moltbook not configured. Set MOLTBOOK_API_TOKEN in .env')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const karma = profile?.agent?.karma ?? home?.your_account?.karma ?? 0
  const followers = profile?.agent?.follower_count ?? 0
  const following = profile?.agent?.following_count ?? 0
  const posts = profile?.agent?.posts_count ?? 0
  const unread = home?.your_account?.unread_notification_count ?? 0
  const dmRequests = Number(home?.your_direct_messages?.pending_request_count ?? 0)
  const activityPosts = home?.activity_on_your_posts ?? []
  const followedPosts = home?.posts_from_accounts_you_follow?.posts ?? []

  const stats = [
    { label: 'Karma', value: karma, color: 'text-violet-400' },
    { label: 'Followers', value: followers, color: 'text-zinc-100' },
    { label: 'Following', value: following, color: 'text-zinc-100' },
    { label: 'Posts', value: posts, color: 'text-zinc-100' },
    { label: 'Unread', value: unread, color: unread > 0 ? 'text-amber-400' : 'text-zinc-100' },
    { label: 'DM Requests', value: dmRequests, color: dmRequests > 0 ? 'text-violet-400' : 'text-zinc-100' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Moltbook</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Agent social dashboard</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-rose-800/40 bg-rose-900/20 p-4 mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <p className="text-sm text-rose-400">{error}</p>
            </div>
            <button
              onClick={fetchData}
              className="px-3 py-1 text-xs rounded-md bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse">
                  <div className="h-6 bg-zinc-800 rounded w-1/2 mx-auto mb-2" />
                  <div className="h-3 bg-zinc-800/60 rounded w-2/3 mx-auto" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 animate-pulse">
                  <div className="h-4 bg-zinc-800 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-zinc-800/60 rounded w-1/3" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats row */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm p-4 text-center transition-shadow hover:shadow-lg hover:shadow-black/20"
                >
                  <p className={cn('text-2xl font-bold', s.color)}>
                    <AnimatedNumber value={s.value} />
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Activity on your posts */}
            {activityPosts.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Activity on Your Posts</h3>
                <div className="space-y-2">
                  {activityPosts.map((post, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      whileHover={{ scale: 1.01 }}
                      className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm px-4 py-3 transition-shadow hover:shadow-lg hover:shadow-black/20"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-zinc-200 font-medium truncate mr-2">{post.post_title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {post.new_notification_count > 0 && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-violet-500/15 text-violet-300">
                              +{post.new_notification_count}
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-[10px] rounded-md bg-zinc-800 text-zinc-400">
                            m/{post.submolt_name}
                          </span>
                        </div>
                      </div>
                      {post.latest_commenters?.length > 0 && (
                        <p className="text-xs text-zinc-500 truncate">
                          {post.latest_commenters.join(', ')}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Following feed */}
            {followedPosts.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Following Feed</h3>
                <div className="space-y-2">
                  {followedPosts.map((post, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                      whileHover={{ scale: 1.01 }}
                      className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm px-4 py-3 flex items-center gap-3 transition-shadow hover:shadow-lg hover:shadow-black/20"
                    >
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center text-sm font-bold text-violet-400">
                        {post.upvotes ?? 0}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{post.title}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          <span>u/{post.author_name}</span>
                          <span className="text-zinc-700">·</span>
                          <span>m/{post.submolt_name}</span>
                          {post.comment_count > 0 && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <MessageSquare className="w-3 h-3" /> {post.comment_count}
                              </span>
                            </>
                          )}
                          {post.created_at && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span>{relativeTime(post.created_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
