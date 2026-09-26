'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { useEditor, EditorContent } from '@tiptap/react'
import { Mark, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { ySyncPluginKey } from 'y-prosemirror'
import { Copy, CheckCircle2, Sparkles, FileCheck, ToggleLeft, ToggleRight, Users, Palette } from 'lucide-react'
import Link from 'next/link'

import { TopBar } from './TopBar'
import { PresenceStack } from './PresenceStack'
import { SelectionToolbar } from './SelectionToolbar'
import { ConnectionStatus } from './ConnectionStatus'
import VersionHistoryDrawer from './VersionHistoryDrawer'
import CommentsSidebar from './CommentsSidebar'

// ── Presence colour palette ────────────────────────────────────────────────
// Intentionally vivid — must not appear in the UI token palette.
// Applied only to: cursors, avatar rings, block-awareness chips.
const CURSOR_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
]

const ADJECTIVES = ['Swift', 'Clever', 'Bright', 'Calm', 'Brave', 'Keen', 'Quick', 'Bold', 'Wise', 'Nimble']
const ANIMALS = ['Fox', 'Panda', 'Koala', 'Falcon', 'Cheetah', 'Otter', 'Badger', 'Lynx', 'Dolphin', 'Eagle']

function generateRandomUser() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const anim = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const color = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]
  return { name: `${adj} ${anim}`, color }
}

interface UserState {
  name: string
  color: string
}

interface Collaborator {
  clientId: number
  isCurrent: boolean
  user: UserState
}

// ── Yjs utilities ─────────────────────────────────────────────────────────

/**
 * patchYText — minimal-diff update for Y.Text.
 * Preserves awareness by only transacting the changed slice.
 */
export const patchYText = (doc: Y.Doc, text: Y.Text, next: string) => {
  const previous = text.toString()
  let prefix = 0
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++
  let suffix = 0
  while (
    suffix < previous.length - prefix && suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix++
  const removed = previous.length - prefix - suffix
  const inserted = next.slice(prefix, next.length - suffix)
  doc.transact(() => {
    if (removed) text.delete(prefix, removed)
    if (inserted) text.insert(prefix, inserted)
  }, 'title-minimal-diff')
}

// ── TipTap extensions ─────────────────────────────────────────────────────

const suggestionMark = Mark.create({
  name: 'suggestion',
  addAttributes() {
    return {
      suggestionId: { default: null },
      authorName: { default: null },
      authorColor: { default: null },
      type: { default: 'insert' },
    }
  },
  parseHTML() { return [{ tag: 'span[data-suggestion-id]' }] },
  renderHTML({ HTMLAttributes }) {
    const deleting = HTMLAttributes.type === 'delete'
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-suggestion-id': HTMLAttributes.suggestionId,
        class: deleting ? 'suggestion-delete' : 'suggestion-insert',
        style: `--suggestion-color:${HTMLAttributes.authorColor}`,
      },
      0,
    ]
  },
})

const blockAwarenessPlugin = (provider: WebsocketProvider, me: UserState) =>
  new Plugin({
    key: new PluginKey('block-awareness'),
    props: {
      decorations(state) {
        const decorations: Decoration[] = []
        provider.awareness.getStates().forEach((value: any, clientId) => {
          const block = value.blockEditing
          if (!block || clientId === provider.awareness.clientID || Date.now() - block.updatedAt > 6000) return
          const pos = Math.min(Math.max(0, block.pos), state.doc.content.size)
          const node = state.doc.nodeAt(pos)
          if (!node) return
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: 'remote-editing-block',
              style: `border-left:3px solid ${block.color}; position:relative`,
            })
          )
          decorations.push(
            Decoration.widget(pos + 1, () => {
              const chip = document.createElement('span')
              chip.className = 'remote-editing-chip'
              chip.style.backgroundColor = block.color
              chip.textContent = `${block.name} is editing`
              return chip
            })
          )
        })
        return DecorationSet.create(state.doc, decorations)
      },
    },
    view(view) {
      const refresh = () => view.dispatch(view.state.tr.setMeta('block-awareness-refresh', Date.now()))
      provider.awareness.on('change', refresh)
      return { destroy: () => provider.awareness.off('change', refresh) }
    },
  })

// ── EditorSkeleton — replaces the spinning spinner ────────────────────────

function EditorSkeleton() {
  return (
    <div className="p-12 space-y-4" aria-label="Loading editor…" aria-busy="true">
      {/* Title placeholder */}
      <div className="skeleton-line h-8 w-2/3 rounded" style={{ maxWidth: '360px' }} />
      {/* Paragraph placeholders */}
      <div className="space-y-2.5 mt-6">
        <div className="skeleton-line h-4 w-full rounded" />
        <div className="skeleton-line h-4 w-5/6 rounded" />
        <div className="skeleton-line h-4 w-4/5 rounded" />
      </div>
      <div className="space-y-2.5 mt-4">
        <div className="skeleton-line h-4 w-full rounded" />
        <div className="skeleton-line h-4 w-3/4 rounded" />
      </div>
    </div>
  )
}

// ── Inner EditorSurface — all TipTap/ProseMirror logic ───────────────────

function EditorSurface({
  doc,
  provider,
  currentUser,
  onStatsUpdate,
  isSuggestingMode,
  onEditorReady,
}: {
  doc: Y.Doc
  provider: WebsocketProvider
  currentUser: UserState
  onStatsUpdate: (stats: { words: number; chars: number }) => void
  isSuggestingMode: boolean
  onEditorReady: (editor: any) => void
}) {
  const [pendingDelete, setPendingDelete] = useState(false)
  const allowDeleteRef = useRef(false)

  const editor = useEditor({
    // CRITICAL: immediatelyRender: false prevents SSR hydration mismatch.
    // Must stay false — random user generation is client-only.
    immediatelyRender: false,
    extensions: [
      // CRITICAL: Disable TipTap default history — Yjs handles undo/redo
      // via y-prosemirror for multi-user awareness.
      StarterKit.configure({ history: false }),
      Collaboration.configure({
        document: doc,
        // Restrict UndoManager to local changes only via ySyncPluginKey origin.
        yUndoOptions: { trackedOrigins: [ySyncPluginKey] },
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: currentUser,
      }),
      Placeholder.configure({
        placeholder: 'Start writing — or paste to begin.',
        showOnlyWhenEditable: true,
      }),
      suggestionMark,
      Extension.create({
        name: 'softBlockAwareness',
        addProseMirrorPlugins: () => [blockAwarenessPlugin(provider, currentUser)],
      }),
    ],
    editorProps: {
      attributes: {
        // The editor element itself — measure + spacing live in .editor-page wrapper
        class: 'editor-prose focus:outline-none',
      },
      handleTextInput: (view, from, to, text) => {
        if (!isSuggestingMode) return false
        const id = `suggestion-${doc.clientID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        doc.getMap<any>('suggestions').set(id, {
          id, type: 'insert', authorName: currentUser.name, authorColor: currentUser.color,
          text, createdAt: Date.now(), status: 'pending', from, to: from + text.length,
        })
        view.dispatch(
          view.state.tr
            .insertText(text, from, to)
            .addMark(from, from + text.length, view.state.schema.marks.suggestion.create({
              suggestionId: id, authorName: currentUser.name, authorColor: currentUser.color, type: 'insert',
            }))
        )
        return true
      },
      handleKeyDown: (view, event) => {
        if (isSuggestingMode && (event.key === 'Backspace' || event.key === 'Delete') && !view.state.selection.empty) {
          const { from, to } = view.state.selection
          const text = view.state.doc.textBetween(from, to, ' ')
          const id = `suggestion-${doc.clientID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          doc.getMap<any>('suggestions').set(id, {
            id, type: 'delete', authorName: currentUser.name, authorColor: currentUser.color,
            text, createdAt: Date.now(), status: 'pending', from, to,
          })
          view.dispatch(
            view.state.tr.addMark(from, to, view.state.schema.marks.suggestion.create({
              suggestionId: id, authorName: currentUser.name, authorColor: currentUser.color, type: 'delete',
            }))
          )
          return true
        }
        if (!allowDeleteRef.current && (event.key === 'Backspace' || event.key === 'Delete') && !view.state.selection.empty) {
          const blockPos = view.state.selection.$from.before(view.state.selection.$from.depth)
          const recentOthers = Array.from(provider.awareness.getStates().entries()).filter(
            ([id, value]: any) =>
              id !== provider.awareness.clientID &&
              value.blockEditing?.pos === blockPos &&
              Date.now() - value.blockEditing.updatedAt < 5000
          )
          if (recentOthers.length) {
            event.preventDefault()
            setPendingDelete(true)
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText()
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      onStatsUpdate({ words, chars: text.length })
    },
  })

  useEffect(() => { if (editor) onEditorReady(editor) }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor) return
    const publishBlock = () => {
      const $from = editor.state.selection.$from
      const pos = $from.depth ? $from.before($from.depth) : 0
      provider.awareness.setLocalStateField('blockEditing', {
        pos, name: currentUser.name, color: currentUser.color, updatedAt: Date.now(),
      })
    }
    editor.on('selectionUpdate', publishBlock)
    editor.on('update', publishBlock)
    publishBlock()
    return () => {
      editor.off('selectionUpdate', publishBlock)
      editor.off('update', publishBlock)
      provider.awareness.setLocalStateField('blockEditing', null)
    }
  }, [editor, provider, currentUser])

  // Keep stats up to date on mount
  useEffect(() => {
    if (editor) {
      const text = editor.getText()
      onStatsUpdate({ words: text.trim() ? text.trim().split(/\s+/).length : 0, chars: text.length })
    }
  }, [editor, onStatsUpdate])

  // Update awareness cursor user when profile changes
  useEffect(() => {
    if (editor && provider) {
      provider.awareness.setLocalStateField('user', currentUser)
    }
  }, [currentUser, editor, provider])

  if (!editor) return <EditorSkeleton />

  return (
    <div className="relative">
      {/* Floating conflict guard banner — not an alert box, a contextual strip */}
      {pendingDelete && (
        <div
          className="mx-6 mt-4 flex items-center gap-3 rounded px-3 py-2 text-xs"
          style={{
            backgroundColor: 'var(--color-paper-3)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-ui)',
          }}
          role="alert"
        >
          <span>Another collaborator just edited this paragraph.</span>
          <button
            className="font-semibold underline"
            style={{ color: 'var(--color-accent)' }}
            onClick={() => {
              allowDeleteRef.current = true
              editor.commands.deleteSelection()
              allowDeleteRef.current = false
              setPendingDelete(false)
            }}
          >
            Delete anyway
          </button>
          <button
            className="font-semibold underline"
            style={{ color: 'var(--color-ink-2)' }}
            onClick={() => setPendingDelete(false)}
          >
            Keep
          </button>
        </div>
      )}

      {/* The floating SelectionToolbar — positions itself */}
      <SelectionToolbar editor={editor} />

      {/* Editor content — measure is constrained by the .editor-page wrapper */}
      <div
        className="cursor-text"
        onClick={() => editor.commands.focus()}
        style={{ minHeight: '520px' }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

// ── Main CollaborativeEditor ──────────────────────────────────────────────

interface CollaborativeEditorProps {
  roomName?: string
  serverUrl?: string
}

export default function CollaborativeEditor({
  roomName = 'hackathon-document',
  serverUrl,
}: CollaborativeEditorProps) {
  // Dynamically resolve WebSocket URL matching current browser host
  const resolvedServerUrl = useMemo(() => {
    if (serverUrl) return serverUrl
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      // If browsing directly on port 3000 in local dev, connect to relay on 1234
      if (window.location.port === '3000') {
        return `${protocol}//${window.location.hostname}:1234`
      }
      // If browsing on port 1234, connect to port 1234
      if (window.location.port === '1234') {
        return `${protocol}//${window.location.hostname}:1234`
      }
      // On public tunnels or cloud deployments (standard 80/443 ports), use the exact same host
      return `${protocol}//${window.location.host}`
    }
    return 'ws://localhost:1234'
  }, [serverUrl])

  // ── State ──────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting')
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  // CRITICAL: deferred client-only — must NOT run during SSR (hydration mismatch)
  const [currentUser, setCurrentUser] = useState<UserState>({ name: 'Loading...', color: '#3b82f6' })
  const [isMounted, setIsMounted] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [showUserModal, setShowUserModal] = useState<boolean>(false)
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false)
  const [showVersionHistory, setShowVersionHistory] = useState<boolean>(false)
  const [showCommentsSidebar, setShowCommentsSidebar] = useState<boolean>(false)
  const [isSuggestingMode, setIsSuggestingMode] = useState<boolean>(false)
  const [isSimulatingOffline, setIsSimulatingOffline] = useState<boolean>(false)
  const [isLightPaper, setIsLightPaper] = useState<boolean>(false)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false)
  const [docStats, setDocStats] = useState<{ words: number; chars: number }>({ words: 0, chars: 0 })
  const [indexedDbReady, setIndexedDbReady] = useState(false)
  const [pendingOfflineUpdates, setPendingOfflineUpdates] = useState(0)
  const [reconnectReview, setReconnectReview] = useState<{ changes: number; people: number } | null>(null)
  const [isReviewingReconnect, setIsReviewingReconnect] = useState(false)
  const editorRef = useRef<any>(null)
  const disconnectSnapshot = useRef<{ snapshot: Y.Snapshot; stateVector: Uint8Array } | null>(null)

  // Collaborative document title
  const [docTitle, setDocTitle] = useState<string>('Untitled document')
  const isLocalTitleChange = useRef<boolean>(false)

  // Stable Y.Doc per roomName
  const doc = useMemo(() => new Y.Doc(), [roomName])
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)

  // ── Client-only: generate random user after hydration ─────────────────
  useEffect(() => {
    const user = generateRandomUser()
    setCurrentUser(user)
    setIsMounted(true)
  }, [])

  // ── Yjs provider + IndexedDB persistence ──────────────────────────────
  useEffect(() => {
    const indexeddb = new IndexeddbPersistence(`collab-editor-${roomName}`, doc)
    const wsProvider = new WebsocketProvider(resolvedServerUrl, roomName, doc, { connect: false })
    let wasDisconnected = false

    const saveDisconnectSnapshot = () => {
      disconnectSnapshot.current = {
        snapshot: Y.snapshot(doc),
        stateVector: Y.encodeStateVector(doc),
      }
      try {
        localStorage.setItem(
          `lastOnlineSnapshot:${roomName}`,
          JSON.stringify({ stateVector: Array.from(disconnectSnapshot.current.stateVector), at: Date.now() })
        )
      } catch {}
    }

    const onIndexedDbSynced = () => {
      setIndexedDbReady(true)
      wsProvider.connect()
    }
    indexeddb.on('synced', onIndexedDbSynced)

    wsProvider.awareness.setLocalStateField('user', currentUser)

    // Collaborative title via Y.Text('title')
    const yTitle = doc.getText('title')
    const updateLocalTitle = () => {
      if (isLocalTitleChange.current) return
      const text = yTitle.toString()
      setDocTitle(text || 'Untitled document')
    }
    yTitle.observe(updateLocalTitle)
    if (yTitle.toString().length > 0) setDocTitle(yTitle.toString())

    const handleStatus = (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setStatus(event.status)
      if (event.status === 'disconnected') {
        wasDisconnected = true
        saveDisconnectSnapshot()
      }
      if (event.status === 'connected') {
        setLastSyncTime(new Date().toLocaleTimeString())
        if (
          wasDisconnected &&
          disconnectSnapshot.current &&
          !Y.equalSnapshots(disconnectSnapshot.current.snapshot, Y.snapshot(doc))
        ) {
          const changes = Math.max(1, pendingOfflineUpdates)
          const people = Math.max(1, wsProvider.awareness.getStates().size - 1)
          setReconnectReview({ changes, people })
          const httpUrl = resolvedServerUrl.replace(/^ws/, 'http')
          fetch(`${httpUrl}/api/documents/${roomName}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `Before ${currentUser.name} reconnected, ${new Date().toLocaleTimeString()}`,
              authorName: currentUser.name,
              authorColor: currentUser.color,
            }),
          }).catch(() => undefined)
        }
        wasDisconnected = false
        setPendingOfflineUpdates(0)
      }
    }
    wsProvider.on('status', handleStatus)

    const onOffline = () => { saveDisconnectSnapshot(); wsProvider.disconnect() }
    const onOnline = () => wsProvider.connect()
    const onDocUpdate = () => {
      if (wasDisconnected || navigator.onLine === false) {
        setPendingOfflineUpdates((count) => count + 1)
      }
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    doc.on('update', onDocUpdate)

    const handleAwareness = () => {
      const states = wsProvider.awareness.getStates()
      const list: Collaborator[] = []
      states.forEach((state, clientId) => {
        if (state.user) {
          list.push({ clientId, isCurrent: clientId === wsProvider.awareness.clientID, user: state.user as UserState })
        }
      })
      setCollaborators(list)
    }
    wsProvider.awareness.on('change', handleAwareness)
    handleAwareness()
    setProvider(wsProvider)

    return () => {
      yTitle.unobserve(updateLocalTitle)
      wsProvider.off('status', handleStatus)
      wsProvider.awareness.off('change', handleAwareness)
      wsProvider.destroy()
      indexeddb.off('synced', onIndexedDbSynced)
      indexeddb.destroy()
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      doc.off('update', onDocUpdate)
      doc.destroy()
    }
  }, [resolvedServerUrl, roomName, doc])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setDocTitle(newTitle)
    const yTitle = doc.getText('title')
    isLocalTitleChange.current = true
    try { patchYText(doc, yTitle, newTitle) }
    finally { isLocalTitleChange.current = false }
  }

  const handleUpdateUser = (updated: Partial<UserState>) => {
    const nextUser = { ...currentUser, ...updated }
    setCurrentUser(nextUser)
    if (provider) provider.awareness.setLocalStateField('user', nextUser)
  }

  const toggleNetworkSimulation = () => {
    if (!provider) return
    if (isSimulatingOffline) {
      provider.connect()
      setIsSimulatingOffline(false)
    } else {
      provider.disconnect()
      setIsSimulatingOffline(true)
      setStatus('disconnected')
    }
  }

  const resolveSuggestion = (suggestion: any, accept: boolean) => {
    const editor = editorRef.current
    if (!editor) return
    const from = Math.min(suggestion.from || 0, editor.state.doc.content.size)
    const to = Math.min(suggestion.to || from, editor.state.doc.content.size)
    doc.transact(() => {
      if (suggestion.type === 'insert' && !accept)
        editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run()
      else if (suggestion.type === 'delete' && accept)
        editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run()
      else
        editor.chain().focus().setTextSelection({ from, to }).unsetMark('suggestion').run()
      doc.getMap<any>('suggestions').set(suggestion.id, { ...suggestion, status: accept ? 'accepted' : 'rejected' })
    }, { origin: 'suggestion-resolution', suggestionId: suggestion.id })
  }

  const copyShareUrl = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomName)}`
      navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const copyJudgePitch = () => {
    navigator.clipboard.writeText(
      "Built on the same CRDT approach real products like Google Docs and Figma use, so it's conflict-free by construction, not by luck."
    )
    setCopiedPitch(true)
    setTimeout(() => setCopiedPitch(false), 2000)
  }

  // ── SSR guard — wait for hydration before rendering dynamic content ────
  if (!isMounted) {
    return (
      <div
        className="flex flex-col min-h-screen items-center justify-center"
        style={{ backgroundColor: 'var(--color-paper)' }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
          aria-label="Loading…"
        />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--color-paper)' }}
      // isLightPaper toggle applies a CSS variable override via data attribute
      data-light-paper={isLightPaper ? 'true' : undefined}
    >
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <TopBar
        docTitle={docTitle}
        roomName={roomName}
        currentUser={currentUser}
        collaborators={collaborators}
        isSimulatingOffline={isSimulatingOffline}
        showCommentsSidebar={showCommentsSidebar}
        showVersionHistory={showVersionHistory}
        copiedLink={copiedLink}
        isLightPaper={isLightPaper}
        showUserModal={showUserModal}
        status={status}
        lastSyncTime={lastSyncTime}
        pendingOfflineUpdates={pendingOfflineUpdates}
        onTitleChange={handleTitleChange}
        onToggleOffline={toggleNetworkSimulation}
        onToggleComments={() => setShowCommentsSidebar(!showCommentsSidebar)}
        onOpenVersionHistory={() => setShowVersionHistory(true)}
        onCopyShareUrl={copyShareUrl}
        onToggleLightPaper={() => setIsLightPaper(!isLightPaper)}
        onToggleUserModal={() => setShowUserModal(!showUserModal)}
        onOpenDemoModal={() => setShowDemoModal(true)}
      />

      {/* ── Offline strip — calm informational, not an alert box ──── */}
      {status === 'disconnected' && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--color-paper-3)',
            borderBottom: '1px solid var(--color-border)',
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-ui)',
          }}
          role="status"
          aria-live="polite"
        >
          <span>
            Working offline
            {pendingOfflineUpdates > 0 && ` — ${pendingOfflineUpdates} edit${pendingOfflineUpdates !== 1 ? 's' : ''} buffered locally`}.
            Your work is safe.
          </span>
          {isSimulatingOffline && (
            <button
              type="button"
              onClick={toggleNetworkSimulation}
              className="font-medium underline underline-offset-2 transition-opacity hover:opacity-75 cursor-pointer"
              style={{ color: 'var(--color-accent)' }}
            >
              Reconnect
            </button>
          )}
        </div>
      )}

      {/* ── User modal — displayed as a sub-bar under the topbar ──── */}
      {showUserModal && (
        <div
          className="px-4 py-3 border-b flex flex-wrap items-center gap-4 text-sm animate-fade-in"
          style={{
            backgroundColor: 'var(--color-chrome-bg)',
            borderColor: 'var(--color-chrome-border)',
            fontFamily: 'var(--font-ui)',
          }}
          role="dialog"
          aria-label="User settings"
        >
          <div className="flex items-center gap-2">
            <label
              htmlFor="display-name-input"
              className="text-xs font-medium"
              style={{ color: 'var(--color-ink-2)' }}
            >
              Display name
            </label>
            <input
              id="display-name-input"
              type="text"
              value={currentUser.name}
              onChange={(e) => handleUpdateUser({ name: e.target.value })}
              className="px-2 py-1 rounded text-xs border transition-colors"
              style={{
                color: 'var(--color-ink)',
                backgroundColor: 'var(--color-paper)',
                borderColor: 'var(--color-border)',
                fontFamily: 'var(--font-ui)',
              }}
              placeholder="Your name"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-ink-2)' }}>
              Cursor colour
            </span>
            <div className="flex items-center gap-1">
              {CURSOR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleUpdateUser({ color: c })}
                  className="w-5 h-5 rounded-full transition-transform cursor-pointer"
                  style={{
                    backgroundColor: c,
                    transform: currentUser.color === c ? 'scale(1.3)' : 'scale(1)',
                    boxShadow: currentUser.color === c ? `0 0 0 2px var(--color-chrome-bg), 0 0 0 3.5px ${c}` : 'none',
                  }}
                  title={c}
                  aria-label={`Select cursor colour ${c}`}
                  aria-pressed={currentUser.color === c}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowUserModal(false)}
            className="ml-auto px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--color-paper-3)',
              color: 'var(--color-ink-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* ── Main workspace ────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor area — centred page surface */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            backgroundColor: 'var(--color-paper)',
            paddingTop: '2.5rem',
            paddingBottom: '6rem',
          }}
        >
          {/* Document page surface — white card, centred, constrained measure */}
          <div
            className="mx-auto w-full px-4"
            style={{ maxWidth: '72ch' }}
          >
            <article
              className="relative"
              style={{
                backgroundColor: 'var(--color-page-surface)',
                borderRadius: '4px',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 16px 0 rgb(0 0 0 / 0.04)',
                padding: '3rem 3.5rem 5rem',
              }}
            >
              {/* Editor content or skeleton */}
              {provider && indexedDbReady ? (
                <EditorSurface
                  doc={doc}
                  provider={provider}
                  currentUser={currentUser}
                  onStatsUpdate={setDocStats}
                  isSuggestingMode={isSuggestingMode}
                  onEditorReady={(editor) => { editorRef.current = editor }}
                />
              ) : (
                <EditorSkeleton />
              )}
            </article>
          </div>
        </div>

        {/* Right-hand panel: CommentsSidebar — slides over, doesn't squeeze column */}
        {showCommentsSidebar && (
          <div className="panel-overlay" aria-modal="true">
            <div className="panel-sheet" style={{ top: '48px' }}>
              <CommentsSidebar
                doc={doc}
                currentUser={currentUser}
                isSuggestingMode={isSuggestingMode}
                onToggleSuggestingMode={setIsSuggestingMode}
                onAcceptSuggestion={(suggestion) => resolveSuggestion(suggestion, true)}
                onRejectSuggestion={(suggestion) => resolveSuggestion(suggestion, false)}
              />
            </div>
            {/* Click-outside to dismiss */}
            <div
              className="absolute inset-0"
              style={{ zIndex: -1 }}
              onClick={() => setShowCommentsSidebar(false)}
              aria-hidden
            />
          </div>
        )}
      </main>

      {/* ── Status bar ───────────────────────────────────────────── */}
      <footer
        className="sticky bottom-0 z-20 border-t flex items-center justify-between px-5 flex-shrink-0"
        style={{
          backgroundColor: 'var(--color-chrome-bg)',
          borderColor: 'var(--color-chrome-border)',
          height: '28px',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Left: connection status */}
        <ConnectionStatus
          status={status}
          lastSyncTime={lastSyncTime}
          pendingOfflineUpdates={pendingOfflineUpdates}
        />

        {/* Centre: suggestion mode indicator */}
        {isSuggestingMode && (
          <span
            className="text-2xs font-medium px-2 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-text)',
              fontFamily: 'var(--font-mono)',
            }}
            aria-live="polite"
          >
            Suggesting mode
          </span>
        )}

        {/* Right: word count + autosave indicator */}
        <div className="flex items-center gap-3">
          <span
            className="text-2xs font-mono"
            style={{ color: 'var(--color-ink-3)' }}
            aria-label={`${docStats.words} words`}
          >
            {docStats.words.toLocaleString()} {docStats.words === 1 ? 'word' : 'words'}
          </span>
          <span
            className="text-2xs flex items-center gap-1"
            style={{ color: 'var(--color-ink-3)' }}
            aria-label="Auto-saved locally"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--color-state-connected)' }}
              aria-hidden
            />
            Auto-saved
          </span>
        </div>
      </footer>

      {/* ── Reconnect review toast ────────────────────────────────── */}
      {reconnectReview && (
        <div
          className="fixed bottom-10 left-1/2 z-40 -translate-x-1/2 rounded px-4 py-3 text-xs shadow-xl border animate-fade-in"
          style={{
            backgroundColor: 'var(--color-chrome-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-ink)',
            fontFamily: 'var(--font-ui)',
            maxWidth: '28rem',
          }}
          role="status"
          aria-live="polite"
        >
          <span>
            Back online — {reconnectReview.changes} change{reconnectReview.changes !== 1 ? 's' : ''} from{' '}
            {reconnectReview.people} {reconnectReview.people === 1 ? 'person' : 'people'} while you were away.
          </span>
          <button
            className="ml-2 font-semibold underline underline-offset-2 cursor-pointer"
            style={{ color: 'var(--color-accent)' }}
            onClick={() => {
              setIsReviewingReconnect(true)
              editorRef.current?.commands.focus()
              editorRef.current?.view?.dispatch(
                editorRef.current.view.state.tr.setMeta(ySyncPluginKey, {
                  reviewSnapshot: disconnectSnapshot.current,
                })
              )
            }}
          >
            Review
          </button>
          <button
            className="ml-2 underline underline-offset-2 cursor-pointer"
            style={{ color: 'var(--color-ink-2)' }}
            onClick={() => setReconnectReview(null)}
          >
            Dismiss
          </button>
          {isReviewingReconnect && (
            <span className="ml-2" style={{ color: 'var(--color-accent)' }}>
              Review active ·{' '}
              <button
                className="underline underline-offset-2 cursor-pointer"
                onClick={() => setIsReviewingReconnect(false)}
              >
                Exit
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── Offline edits count toast ─────────────────────────────── */}
      {pendingOfflineUpdates > 0 && status !== 'disconnected' && (
        <div
          className="fixed bottom-10 left-4 z-40 rounded px-3 py-2 text-2xs font-mono shadow"
          style={{
            backgroundColor: 'var(--color-ink)',
            color: 'var(--color-paper)',
          }}
          role="status"
          aria-live="polite"
        >
          {pendingOfflineUpdates} {pendingOfflineUpdates === 1 ? 'edit' : 'edits'} saved locally
        </div>
      )}

      {/* ── Demo guide modal ──────────────────────────────────────── */}
      {showDemoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgb(0 0 0 / 0.4)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Demo guide"
        >
          <div
            className="w-full max-w-md rounded-lg shadow-2xl border overflow-hidden animate-fade-in"
            style={{
              backgroundColor: 'var(--color-chrome-bg)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  className="w-4 h-4"
                  style={{ color: 'var(--color-accent)' }}
                  aria-hidden
                />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-ui)' }}
                >
                  Demo Guide
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="text-sm font-medium cursor-pointer transition-opacity hover:opacity-60"
                style={{ color: 'var(--color-ink-3)' }}
                aria-label="Close demo guide"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div
              className="px-5 py-4 space-y-3 text-xs overflow-y-auto"
              style={{
                color: 'var(--color-ink-2)',
                fontFamily: 'var(--font-ui)',
                maxHeight: '60vh',
              }}
            >
              <ol className="list-decimal pl-4 space-y-2.5">
                <li>
                  <strong style={{ color: 'var(--color-ink)' }}>Two windows side by side:</strong>{' '}
                  Click <em>Share</em> to copy the room URL, then paste into a second window.
                </li>
                <li>
                  <strong style={{ color: 'var(--color-ink)' }}>Instant concurrent typing:</strong>{' '}
                  Type in window A — text appears in window B instantly, no conflict.
                </li>
                <li>
                  <strong style={{ color: 'var(--color-ink)' }}>Live presence & cursors:</strong>{' '}
                  Move your cursor in window A — see the coloured name tag in window B.
                </li>
                <li>
                  <strong style={{ color: 'var(--color-ink)' }}>Persistence:</strong>{' '}
                  Refresh window B — full content restores from local snapshot.
                </li>
                <li>
                  <strong style={{ color: 'var(--color-ink)' }}>Resilience & delta sync:</strong>{' '}
                  Click <em>Disconnect</em> in window A. Type offline. Reconnect — both sides sync automatically.
                </li>
              </ol>

              {/* One-liner pitch */}
              <div
                className="p-3 rounded text-xs mt-2"
                style={{
                  backgroundColor: 'var(--color-paper-2)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  className="flex items-center justify-between mb-1 font-medium"
                  style={{ color: 'var(--color-ink)' }}
                >
                  <span>One-liner pitch</span>
                  <button
                    type="button"
                    onClick={copyJudgePitch}
                    className="flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-60"
                    style={{ color: 'var(--color-accent)' }}
                    aria-label={copiedPitch ? 'Pitch copied' : 'Copy pitch'}
                  >
                    {copiedPitch
                      ? <CheckCircle2 className="w-3 h-3" aria-hidden />
                      : <Copy className="w-3 h-3" aria-hidden />
                    }
                    {copiedPitch ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p style={{ color: 'var(--color-ink-2)', fontStyle: 'italic' }}>
                  &quot;Built on the same CRDT approach real products like Google Docs and Figma use,
                  so it&apos;s conflict-free by construction, not by luck.&quot;
                </p>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex justify-end gap-2 px-5 py-3 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <button
                type="button"
                onClick={copyShareUrl}
                className="topbar-btn"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                {copiedLink ? 'Copied!' : 'Copy Room URL'}
              </button>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="topbar-btn topbar-btn-primary"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version history drawer ────────────────────────────────── */}
      <VersionHistoryDrawer
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        roomName={roomName}
        currentUser={currentUser}
      />
    </div>
  )
}
