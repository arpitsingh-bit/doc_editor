'use client'

import React, { useEffect, useState } from 'react'
import {
  History,
  X,
  RotateCcw,
  CheckCircle2,
  Clock,
  User,
  Plus,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

interface DocumentVersion {
  id: number
  document_id: string
  version_name: string
  author_name: string
  author_color: string
  created_at: string
  bytes: number
}

interface VersionHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  roomName: string
  currentUser: { name: string; color: string }
}

export default function VersionHistoryDrawer({
  isOpen,
  onClose,
  roomName,
  currentUser,
}: VersionHistoryDrawerProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newVersionName, setNewVersionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const serverUrl =
    process.env.NEXT_PUBLIC_WS_SERVER_URL?.replace(/^ws/, 'http') || 'http://localhost:1234'

  const fetchVersions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${serverUrl}/api/documents/${roomName}/versions`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch versions`)
      const data = await res.json()
      setVersions(data.versions || [])
    } catch (err: any) {
      setError(err.message || 'Unable to reach backend version service')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchVersions()
    }
  }, [isOpen, roomName])

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVersionName.trim()) return

    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch(`${serverUrl}/api/documents/${roomName}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVersionName.trim(),
          authorName: currentUser.name,
          authorColor: currentUser.color,
        }),
      })
      if (!res.ok) throw new Error('Failed to create checkpoint')
      setNewVersionName('')
      setSuccessMessage('Checkpoint created!')
      setTimeout(() => setSuccessMessage(null), 3000)
      await fetchVersions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleRestore = async (version: DocumentVersion) => {
    const confirm = window.confirm(
      `Restore to "${version.version_name}"? All active collaborators will see this version in real time.`
    )
    if (!confirm) return

    setRestoringId(version.id)
    setError(null)
    try {
      const res = await fetch(`${serverUrl}/api/documents/${roomName}/restore/${version.id}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to restore version')
      setSuccessMessage(`Restored to "${version.version_name}"`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRestoringId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 text-slate-850">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Version History & Audit</h3>
              <p className="text-xs text-slate-500 font-mono">Non-destructive time-travel restore</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchVersions}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
              title="Refresh timeline"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Create Checkpoint Form */}
        <form onSubmit={handleCreateCheckpoint} className="p-4 border-b border-slate-200 bg-slate-50/60">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="font-mono uppercase tracking-wider text-[11px]">Create Named Checkpoint</span>
            <span className="text-[10px] text-blue-600 font-mono font-medium">Saves to PostgreSQL</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="e.g. v1.2 - Before design review"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 transition"
              disabled={isCreating}
            />
            <button
              type="submit"
              disabled={isCreating || !newVersionName.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1 transition shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </form>

        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {loading && versions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span className="font-mono">Loading version timeline...</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">No checkpoints recorded yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Use the box above to create your first named revision checkpoint.
              </p>
            </div>
          ) : (
            versions.map((ver, idx) => (
              <div
                key={ver.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition group relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-xs">
                        {ver.version_name}
                      </span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5">
                      <span className="flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: ver.author_color || '#3b82f6' }}
                        />
                        <span className="text-slate-700 font-medium">{ver.author_name}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(ver.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(ver)}
                    disabled={restoringId === ver.id}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-white hover:bg-blue-600 bg-blue-50 hover:border-blue-600 border border-blue-200 rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer shadow-xs"
                    title="Time-travel restore to this state"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restoringId === ver.id ? 'animate-spin' : ''}`} />
                    <span>Restore</span>
                  </button>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Snapshot #{ver.id}</span>
                  <span>{ver.bytes} bytes</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 text-[11px] text-slate-600 flex items-center gap-2 font-mono">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Restores are non-destructive and propagate to all active peers.</span>
        </div>
      </div>
    </div>
  )
}
