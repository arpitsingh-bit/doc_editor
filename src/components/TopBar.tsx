'use client'

import React from 'react'
import Link from 'next/link'
import {
  Share2,
  CheckCircle2,
  History,
  MessageSquare,
  Activity,
  WifiOff,
  RefreshCw,
  Sparkles,
  Palette,
  Sun,
  Moon,
  PenLine,
} from 'lucide-react'
import { PresenceStack } from './PresenceStack'
import { ConnectionStatus } from './ConnectionStatus'

interface UserState {
  name: string
  color: string
}

interface Collaborator {
  clientId: number
  isCurrent: boolean
  user: UserState
}

interface TopBarProps {
  docTitle: string
  roomName: string
  currentUser: UserState
  collaborators: Collaborator[]
  isSimulatingOffline: boolean
  showCommentsSidebar: boolean
  showVersionHistory: boolean
  copiedLink: boolean
  isLightPaper: boolean
  showUserModal: boolean
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  lastSyncTime: string
  pendingOfflineUpdates: number
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onToggleOffline: () => void
  onToggleComments: () => void
  onOpenVersionHistory: () => void
  onCopyShareUrl: () => void
  onToggleLightPaper: () => void
  onToggleUserModal: () => void
  onOpenDemoModal: () => void
}

/**
 * TopBar — the slim, recessive top chrome.
 *
 * Layout (left → right):
 *   [Logo mark]  [Title input]   ────────   [PresenceStack] [Actions] [User pill]
 *
 * Chrome must recede — no gradients, no heavy borders, no competing colours.
 * Every interactive element has focus-visible styling (via global :focus-visible).
 */
export function TopBar({
  docTitle,
  roomName,
  currentUser,
  collaborators,
  isSimulatingOffline,
  showCommentsSidebar,
  copiedLink,
  isLightPaper,
  showUserModal,
  status,
  lastSyncTime,
  pendingOfflineUpdates,
  onTitleChange,
  onToggleOffline,
  onToggleComments,
  onOpenVersionHistory,
  onCopyShareUrl,
  onToggleLightPaper,
  onToggleUserModal,
  onOpenDemoModal,
}: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b flex-shrink-0"
      style={{
        backgroundColor: 'var(--color-chrome-bg)',
        borderColor: 'var(--color-chrome-border)',
        height: '48px',
      }}
    >
      <div
        className="h-full max-w-topbar mx-auto px-4 flex items-center justify-between gap-3"
      >
        {/* ── Left: Logo mark + Title ─────────────────────────────── */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Logo mark — minimal pen icon in accent */}
          <div
            className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center"
            style={{
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
            }}
            aria-hidden
          >
            <PenLine className="w-3.5 h-3.5" />
          </div>

          {/* Document title — inline editable, synced via Yjs */}
          <div className="min-w-0 flex flex-col justify-center">
            <input
              type="text"
              id="doc-title-input"
              value={docTitle}
              onChange={onTitleChange}
              placeholder="Untitled document"
              title="Edit document title — changes sync to all collaborators"
              className="min-w-0 max-w-xs sm:max-w-sm truncate text-sm font-semibold bg-transparent border border-transparent rounded px-1 py-0.5 transition-[border-color,background-color]"
              style={{
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-ui)',
                // Show border only on hover/focus so title feels like text, not a field
              }}
              onMouseEnter={(e) => {
                ;(e.target as HTMLInputElement).style.borderColor = 'var(--color-border)'
              }}
              onMouseLeave={(e) => {
                if (document.activeElement !== e.target) {
                  ;(e.target as HTMLInputElement).style.borderColor = 'transparent'
                }
              }}
              onFocus={(e) => {
                ;(e.target as HTMLInputElement).style.borderColor = 'var(--color-accent)'
                ;(e.target as HTMLInputElement).style.backgroundColor = 'var(--color-paper-2)'
              }}
              onBlur={(e) => {
                ;(e.target as HTMLInputElement).style.borderColor = 'transparent'
                ;(e.target as HTMLInputElement).style.backgroundColor = 'transparent'
              }}
            />
            <span
              className="px-1 text-2xs leading-none"
              style={{
                color: 'var(--color-ink-3)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {roomName}
            </span>
          </div>
        </div>

        {/* ── Right: Presence + Actions ────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Presence avatars */}
          <PresenceStack collaborators={collaborators} />

          {/* The connection state belongs beside presence, where writers look
              before trusting a shared document. Hide its prose on narrow bars
              but retain the status icon and accessible state. */}
          <div className="hidden sm:block">
            <ConnectionStatus
              status={status}
              lastSyncTime={lastSyncTime}
              pendingOfflineUpdates={pendingOfflineUpdates}
            />
          </div>

          {/* Divider */}
          <span
            className="h-5 w-px mx-1"
            style={{ backgroundColor: 'var(--color-border)' }}
            aria-hidden
          />

          {/* Demo guide */}
          <button
            type="button"
            id="demo-guide-btn"
            onClick={onOpenDemoModal}
            className="topbar-btn topbar-btn-primary"
            title="Open demo walkthrough — ⌘?"
            aria-label="Open demo guide"
          >
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            <span className="topbar-label">Demo</span>
          </button>

          {/* Simulate disconnect */}
          <button
            type="button"
            id="simulate-disconnect-btn"
            onClick={onToggleOffline}
            className={`topbar-btn${isSimulatingOffline ? ' is-active' : ''}`}
            title={isSimulatingOffline ? 'Reconnect — restore WebSocket connection' : 'Simulate disconnect — test offline resilience'}
            aria-label={isSimulatingOffline ? 'Reconnect' : 'Simulate disconnect'}
            aria-pressed={isSimulatingOffline}
          >
            {isSimulatingOffline ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" aria-hidden />
                <span className="topbar-label">Reconnect</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                <span className="topbar-label hidden sm:inline">Disconnect</span>
              </>
            )}
          </button>

          {/* Share room link */}
          <button
            type="button"
            id="share-btn"
            onClick={onCopyShareUrl}
            className="topbar-btn"
            title="Copy share link — paste into another tab to collaborate"
            aria-label={copiedLink ? 'Link copied' : 'Copy share link'}
          >
            {copiedLink ? (
              <CheckCircle2
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: 'var(--color-state-connected)' }}
                aria-hidden
              />
            ) : (
              <Share2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            )}
            <span className="topbar-label">{copiedLink ? 'Copied' : 'Share'}</span>
          </button>

          {/* Version history */}
          <button
            type="button"
            id="history-btn"
            onClick={onOpenVersionHistory}
            className="topbar-btn"
            title="Version history — time-travel restore"
            aria-label="Open version history"
          >
            <History className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            <span className="topbar-label">History</span>
          </button>

          {/* Comments & suggestions */}
          <button
            type="button"
            id="comments-btn"
            onClick={onToggleComments}
            className={`topbar-btn${showCommentsSidebar ? ' is-active' : ''}`}
            title="Comments & suggestions panel — ⌘⇧M"
            aria-label="Toggle comments panel"
            aria-pressed={showCommentsSidebar}
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            <span className="topbar-label">Comments</span>
          </button>

          {/* Ops metrics (admin link) */}
          <Link
            href="/admin/metrics"
            id="metrics-link"
            className="topbar-btn"
            title="Cluster ops & sync metrics dashboard"
            aria-label="Open metrics dashboard"
          >
            <Activity className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            <span className="topbar-label hidden md:inline">Metrics</span>
          </Link>

          {/* Paper tone toggle */}
          <button
            type="button"
            id="paper-tone-btn"
            onClick={onToggleLightPaper}
            className="topbar-btn"
            title={isLightPaper ? 'Switch to neutral paper' : 'Switch to warm parchment'}
            aria-label={isLightPaper ? 'Switch to neutral paper' : 'Switch to warm parchment'}
            aria-pressed={isLightPaper}
          >
            {isLightPaper ? (
              <Moon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            ) : (
              <Sun className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            )}
          </button>

          {/* Current user pill */}
          <button
            type="button"
            id="user-menu-btn"
            onClick={onToggleUserModal}
            className={`topbar-btn${showUserModal ? ' is-active' : ''}`}
            title="Edit your display name and cursor colour"
            aria-label="User settings"
            aria-expanded={showUserModal}
            aria-haspopup="dialog"
          >
            {/* Presence colour dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentUser.color }}
              aria-hidden
            />
            <span
              className="max-w-[80px] truncate"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {currentUser.name}
            </span>
            <Palette className="w-3 h-3 flex-shrink-0" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
