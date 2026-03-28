import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Check, AlertCircle, Save } from 'lucide-react'
import { apiFetch, cn } from '../../lib/utils'

interface Toast {
  message: string
  type: 'success' | 'error'
}

export default function EditorTab() {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    apiFetch('/files')
      .then(setFiles)
      .catch((e) => showToast(e.message, 'error'))
  }, [showToast])

  const loadFile = async (path: string) => {
    setSelectedFile(path)
    setLoading(true)
    setToast(null)
    try {
      const data = await apiFetch(`/file?path=${encodeURIComponent(path)}`)
      setContent(data.content)
      setOriginalContent(data.content)
    } catch (e: any) {
      showToast(e.message, 'error')
      setContent('')
      setOriginalContent('')
    } finally {
      setLoading(false)
    }
  }

  const saveFile = async () => {
    if (!selectedFile) return

    setSaving(true)
    try {
      await apiFetch('/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content }),
      })
      setOriginalContent(content)
      showToast('Saved', 'success')
    } catch (e: any) {
      showToast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = content !== originalContent
  const isOutsideWorkspace = selectedFile ? selectedFile.includes('..') : false

  // Group files by directory
  const grouped = files.reduce<Record<string, string[]>>((acc, f) => {
    const parts = f.split('/')
    const dir = parts.length > 1 ? parts[0] : ''
    if (!acc[dir]) acc[dir] = []
    acc[dir].push(f)
    return acc
  }, {})

  return (
    <div className="flex h-full relative">
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 0 }}
            className={cn(
              'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border backdrop-blur-sm',
              toast.type === 'success'
                ? 'bg-emerald-900/80 text-emerald-200 border-emerald-700/60'
                : 'bg-rose-900/80 text-rose-200 border-rose-700/60'
            )}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File tree */}
      <div className="w-56 border-r border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-zinc-800/50">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Workspace</h3>
        </div>
        <div className="py-2">
          {Object.entries(grouped).map(([dir, dirFiles]) => (
            <div key={dir || '__root'}>
              {dir && (
                <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  {dir}/
                </div>
              )}
              {dirFiles.map((f) => {
                const displayName = dir ? f.replace(`${dir}/`, '') : f
                return (
                  <button
                    key={f}
                    onClick={() => loadFile(f)}
                    className={cn(
                      'w-full text-left px-4 py-1.5 text-xs truncate transition-all duration-150',
                      dir ? 'pl-8' : 'pl-4',
                      selectedFile === f
                        ? 'bg-violet-600/10 text-violet-300 border-r-2 border-violet-500'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    )}
                  >
                    {displayName}
                  </button>
                )
              })}
            </div>
          ))}
          {files.length === 0 && (
            <p className="px-4 py-3 text-xs text-zinc-600">No files found</p>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOutsideWorkspace && <Lock className="w-3.5 h-3.5 text-amber-500" />}
            <span className="text-xs text-zinc-400">
              {selectedFile ?? 'No file selected'}
            </span>
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />
            )}
          </div>
          <button
            onClick={saveFile}
            disabled={!selectedFile || saving || !isDirty}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 text-xs rounded-lg font-medium transition-all duration-150',
              !selectedFile || !isDirty
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-600/20'
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {selectedFile ? (
            loading ? (
              <div className="flex items-center justify-center h-full text-zinc-600">
                <p className="text-sm animate-pulse">Loading...</p>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="w-full h-full p-4 bg-zinc-950 text-zinc-200 text-sm font-mono resize-none focus:outline-none leading-relaxed"
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600">
              <div className="text-center">
                <FileIcon className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                <p className="text-sm text-zinc-500">Select a file from the sidebar to edit</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FileIcon(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 13l-2 2 2 2" /><path d="M14 17l2-2-2-2" />
    </svg>
  )
}
