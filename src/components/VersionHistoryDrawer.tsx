'use client'

import React, { useEffect, useState } from 'react'
import {
  History,
  X,
  RotateCcw,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react'

interface DocumentVersion {
  id: number | string
  document_id: string
  version_name: string
  author_name: string
  author_color: string
  created_at: string
  bytes: number
  is_named?: boolean
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
  const [restoringId, setRestoringId] = useState<number | string | null>(null)
  const [confirmingRestoreId, setConfirmingRestoreId] = useState<number | string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const serverUrl =
    process.env.NEXT_PUBLIC_WS_SERVER_URL?.replace(/^ws/, 'http') || 'http://localhost:1234'

  const fetchVersions = async (showToast = false) => {
    setLoading(true)
    setError(null)
    const minSpin = new Promise((r) => setTimeout(r, 450))
    try {
      const res = await fetch(`${serverUrl}/api/documents/${roomName}/versions?_t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch versions`)
      const data = await res.json()
      setVersions(data.versions || [])
      if (showToast) {
        setSuccessMessage('Version timeline refreshed!')
        setTimeout(() => setSuccessMessage(null), 2500)
      }
    } catch (err: any) {
      setError(err.message || 'Unable to reach backend version service')
    } finally {
      await minSpin
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) fetchVersions(false)
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
      const name = newVersionName.trim()
      setNewVersionName('')
      setSuccessMessage(`Checkpoint "${name}" saved.`)
      setTimeout(() => setSuccessMessage(null), 3000)
      await fetchVersions(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleRestore = async (version: DocumentVersion) => {
    setRestoringId(version.id)
    setError(null)
    try {
      const res = await fetch(`${serverUrl}/api/documents/${roomName}/restore/${version.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to restore version')
      setSuccessMessage(`Restored to "${version.version_name}".`)
      setConfirmingRestoreId(null)
      setTimeout(() => setSuccessMessage(null), 3500)
      await fetchVersions(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRestoringId(null)
    }
  }

  if (!isOpen) return null

  return (
    // Full-screen overlay — panel slides from right
    <div
      className="fixed inset-0 z-50"
      style={{ backgroundColor: 'rgb(0 0 0 / 0.3)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Version history"
    >
      {/* Click outside to close */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        className="absolute top-0 right-0 bottom-0 flex flex-col shadow-panel"
        style={{
          width: 'min(24rem, 92vw)',
          backgroundColor: 'var(--color-chrome-bg)',
          borderLeft: '1px solid var(--color-border)',
          animation: 'slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded"
              style={{
                backgroundColor: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
              }}
            >
              <History className="w-4 h-4" aria-hidden />
            </div>
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--color-ink)' }}
              >
                Version history
              </h3>
              <p
                className="text-2xs"
                style={{ color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}
              >
                Continuous auto-save · Time-travel restore
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchVersions(true)}
              disabled={loading}
              className="p-1.5 rounded transition-colors cursor-pointer"
              style={{ color: 'var(--color-ink-3)' }}
              title="Refresh timeline"
              aria-label="Refresh version timeline"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                style={loading ? { color: 'var(--color-accent)' } : undefined}
                aria-hidden
              />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded transition-colors cursor-pointer"
              style={{ color: 'var(--color-ink-3)' }}
              title="Close"
              aria-label="Close version history"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Notification banners */}
        {successMessage && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded flex items-center gap-2 text-xs animate-fade-in"
            style={{
              backgroundColor: 'hsl(141 50% 94%)',
              border: '1px solid hsl(141 40% 80%)',
              color: 'var(--color-state-connected)',
            }}
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            {successMessage}
          </div>
        )}

        {error && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded flex items-center gap-2 text-xs"
            style={{
              backgroundColor: 'hsl(0 50% 95%)',
              border: '1px solid hsl(0 40% 82%)',
              color: 'hsl(0 60% 40%)',
            }}
            role="alert"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            {error}
          </div>
        )}

        {/* Create named checkpoint form */}
        <form
          onSubmit={handleCreateCheckpoint}
          className="p-4 border-b flex-shrink-0"
          style={{
            backgroundColor: 'var(--color-paper-2)',
            borderColor: 'var(--color-border)',
          }}
        >
          <label className="block mb-1.5">
            <span
              className="text-2xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}
            >
              Name a milestone
            </span>
            <span
              className="ml-2 text-2xs"
              style={{ color: 'var(--color-state-connected)', fontFamily: 'var(--font-mono)' }}
            >
              All edits auto-saved below
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="e.g. v1.2 — Before review"
              className="flex-1 px-2.5 py-1.5 text-xs rounded border transition-colors"
              style={{
                backgroundColor: 'var(--color-chrome-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-ui)',
              }}
              disabled={isCreating}
              aria-label="Checkpoint name"
            />
            <button
              type="submit"
              disabled={isCreating || !newVersionName.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-40 cursor-pointer shrink-0"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'hsl(40 20% 97%)',
              }}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
              {isCreating ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>

        {/* Version timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && versions.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center gap-2">
              <RefreshCw
                className="w-5 h-5 animate-spin"
                style={{ color: 'var(--color-accent)' }}
                aria-hidden
              />
              <span
                className="text-xs"
                style={{ color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}
              >
                Loading timeline…
              </span>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-10 text-center">
              <History
                className="w-8 h-8 mx-auto mb-2"
                style={{ color: 'var(--color-ink-3)' }}
                aria-hidden
              />
              <p className="text-xs font-medium" style={{ color: 'var(--color-ink-2)' }}>
                No revisions yet.
              </p>
              <p className="text-2xs mt-1" style={{ color: 'var(--color-ink-3)' }}>
                Type in the editor — revisions save automatically.
              </p>
            </div>
          ) : (
            versions.map((ver, idx) => (
              <VersionCard
                key={ver.id}
                version={ver}
                isCurrent={idx === 0}
                isConfirming={confirmingRestoreId === ver.id}
                isRestoring={restoringId === ver.id}
                anyRestoring={restoringId !== null}
                onRestore={() => handleRestore(ver)}
                onConfirmRestore={() => setConfirmingRestoreId(ver.id)}
                onCancelRestore={() => setConfirmingRestoreId(null)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 border-t flex-shrink-0 text-2xs"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-ink-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Restores are non-destructive and propagate to all active peers.
        </div>
      </div>
    </div>
  )
}

function VersionCard({
  version,
  isCurrent,
  isConfirming,
  isRestoring,
  anyRestoring,
  onRestore,
  onConfirmRestore,
  onCancelRestore,
}: {
  version: DocumentVersion
  isCurrent: boolean
  isConfirming: boolean
  isRestoring: boolean
  anyRestoring: boolean
  onRestore: () => void
  onConfirmRestore: () => void
  onCancelRestore: () => void
}) {
  return (
    <div
      className="p-3.5 rounded border"
      style={{
        backgroundColor: 'var(--color-chrome-bg)',
        borderColor: 'var(--color-border)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Version name + badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span
              className="text-xs font-medium truncate"
              style={{ color: 'var(--color-ink)' }}
            >
              {version.version_name}
            </span>
            {isCurrent && (
              <span
                className="text-2xs px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent-text)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                current
              </span>
            )}
            <span
              className="text-2xs px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: version.is_named ? 'var(--color-paper-3)' : 'hsl(141 30% 92%)',
                color: version.is_named ? 'var(--color-ink-2)' : 'var(--color-state-connected)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {version.is_named ? 'named' : 'auto'}
            </span>
          </div>

          {/* Author + time */}
          <div className="flex items-center gap-2 text-2xs" style={{ color: 'var(--color-ink-3)' }}>
            <span className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: version.author_color || 'var(--color-accent)' }}
                aria-hidden
              />
              <span style={{ color: 'var(--color-ink-2)' }}>{version.author_name}</span>
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              <Clock className="w-2.5 h-2.5" aria-hidden />
              {new Date(version.created_at).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Restore action */}
        {isConfirming ? (
          <div className="flex items-center gap-1.5 flex-shrink-0 animate-fade-in">
            <button
              type="button"
              onClick={onRestore}
              disabled={isRestoring}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-opacity cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-state-connected)',
                color: 'white',
              }}
              aria-label="Confirm restore"
            >
              <Check
                className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {isRestoring ? 'Restoring…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={onCancelRestore}
              disabled={isRestoring}
              className="px-2 py-1 text-xs rounded transition-colors cursor-pointer"
              style={{ color: 'var(--color-ink-2)' }}
              aria-label="Cancel restore"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConfirmRestore}
            disabled={anyRestoring}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer disabled:opacity-40 flex-shrink-0"
            style={{
              color: 'var(--color-accent-text)',
              backgroundColor: 'var(--color-accent-subtle)',
              borderColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)',
            }}
            title="Time-travel restore to this snapshot"
            aria-label={`Restore to ${version.version_name}`}
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`}
              aria-hidden
            />
            Restore
          </button>
        )}
      </div>

      {/* Metadata footer */}
      <div
        className="mt-2.5 pt-2 border-t flex items-center justify-between text-2xs"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-ink-3)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>#{version.id}</span>
        <span>{version.bytes.toLocaleString()} bytes</span>
      </div>
    </div>
  )
}
