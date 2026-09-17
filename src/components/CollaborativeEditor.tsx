'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  Palette,
  AlertTriangle,
  FileText,
  Share2,
  CheckCircle2,
  Copy,
  Sidebar as SidebarIcon,
  Sparkles,
  History,
  MessageSquare,
  Activity,
  Sun,
  Moon,
} from 'lucide-react'
import Link from 'next/link'
import VersionHistoryDrawer from './VersionHistoryDrawer'
import CommentsSidebar from './CommentsSidebar'

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
  return {
    name: `${adj} ${anim}`,
    color,
  }
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

// Inner TipTap Editor Surface
function EditorSurface({
  doc,
  provider,
  currentUser,
  onStatsUpdate,
}: {
  doc: Y.Doc
  provider: WebsocketProvider
  currentUser: UserState
  onStatsUpdate: (stats: { words: number; chars: number }) => void
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // CRITICAL: Disable TipTap default history extension.
      // Yjs handles undo/redo via y-prosemirror for multi-user awareness.
      StarterKit.configure({
        history: false,
      }),
      Collaboration.configure({
        document: doc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: currentUser,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[480px] text-slate-800 p-8 sm:p-12 leading-relaxed',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText()
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      const chars = text.length
      onStatsUpdate({ words, chars })
    },
  })

  // Keep stats up to date
  useEffect(() => {
    if (editor) {
      const text = editor.getText()
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      const chars = text.length
      onStatsUpdate({ words, chars })
    }
  }, [editor, onStatsUpdate])

  // Update cursor user dynamically when profile changes
  useEffect(() => {
    if (editor && provider) {
      provider.awareness.setLocalStateField('user', currentUser)
    }
  }, [currentUser, editor, provider])

  if (!editor) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="font-mono text-xs">Initializing TipTap collaborative canvas...</span>
      </div>
    )
  }

  const btnActive = 'bg-blue-50 text-blue-600 font-bold border border-blue-200 shadow-xs'
  const btnInactive = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
  const dividerClass = 'h-5 w-[1px] bg-slate-200 mx-1.5'

  return (
    <div>
      {/* Floating / Sticky Rich Text Toolbar */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-2 flex flex-wrap items-center gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-lg transition ${editor.isActive('bold') ? btnActive : btnInactive}`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-lg transition ${editor.isActive('italic') ? btnActive : btnInactive}`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded-lg transition ${editor.isActive('strike') ? btnActive : btnInactive}`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded-lg transition ${editor.isActive('code') ? btnActive : btnInactive}`}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className={dividerClass}></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded-lg transition ${editor.isActive('heading', { level: 1 }) ? btnActive : btnInactive}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded-lg transition ${editor.isActive('heading', { level: 2 }) ? btnActive : btnInactive}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className={dividerClass}></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-lg transition ${editor.isActive('bulletList') ? btnActive : btnInactive}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-lg transition ${editor.isActive('orderedList') ? btnActive : btnInactive}`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded-lg transition ${editor.isActive('blockquote') ? btnActive : btnInactive}`}
          title="Blockquote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className={dividerClass}></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900"
          title="Undo (CRDT history)"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900"
          title="Redo (CRDT history)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Surface */}
      <div
        className="min-h-[520px] cursor-text bg-white text-slate-800"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

interface CollaborativeEditorProps {
  roomName?: string
  serverUrl?: string
}

export default function CollaborativeEditor({
  roomName = 'hackathon-document',
  serverUrl,
}: CollaborativeEditorProps) {
  // Dynamically resolve WebSocket URL matching current browser host (resolves localhost vs 127.0.0.1 mismatch)
  const resolvedServerUrl = useMemo(() => {
    if (serverUrl) return serverUrl
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.hostname || 'localhost'
      return `${protocol}//${host}:1234`
    }
    return 'ws://localhost:1234'
  }, [serverUrl])

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<UserState>(() => generateRandomUser())
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [showUserModal, setShowUserModal] = useState<boolean>(false)
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false)
  const [showSidebar, setShowSidebar] = useState<boolean>(true)
  const [showVersionHistory, setShowVersionHistory] = useState<boolean>(false)
  const [showCommentsSidebar, setShowCommentsSidebar] = useState<boolean>(false)
  const [isSuggestingMode, setIsSuggestingMode] = useState<boolean>(false)
  const [isSimulatingOffline, setIsSimulatingOffline] = useState<boolean>(false)
  const [isLightPaper, setIsLightPaper] = useState<boolean>(false)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false)
  const [docStats, setDocStats] = useState<{ words: number; chars: number }>({ words: 0, chars: 0 })

  // Collaborative Document Title
  const [docTitle, setDocTitle] = useState<string>('Untitled Collaborative Document')
  const isLocalTitleChange = useRef<boolean>(false)

  // Stable Y.Doc per roomName
  const doc = useMemo(() => new Y.Doc(), [roomName])
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)

  useEffect(() => {
    const wsProvider = new WebsocketProvider(resolvedServerUrl, roomName, doc, {
      connect: true,
    })

    // Set initial awareness state
    wsProvider.awareness.setLocalStateField('user', currentUser)

    // Synchronize document title via Y.Text('title')
    const yTitle = doc.getText('title')
    const updateLocalTitle = () => {
      if (isLocalTitleChange.current) return
      const text = yTitle.toString()
      setDocTitle(text || 'Untitled Collaborative Document')
    }
    yTitle.observe(updateLocalTitle)
    if (yTitle.toString().length > 0) {
      setDocTitle(yTitle.toString())
    }

    const handleStatus = (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setStatus(event.status)
      if (event.status === 'connected') {
        setLastSyncTime(new Date().toLocaleTimeString())
      }
    }
    wsProvider.on('status', handleStatus)

    const handleAwareness = () => {
      const states = wsProvider.awareness.getStates()
      const list: Collaborator[] = []

      states.forEach((state, clientId) => {
        if (state.user) {
          list.push({
            clientId,
            isCurrent: clientId === wsProvider.awareness.clientID,
            user: state.user as UserState,
          })
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
      doc.destroy()
    }
  }, [resolvedServerUrl, roomName, doc])

  // Handle title edit synced via Yjs
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setDocTitle(newTitle)
    const yTitle = doc.getText('title')
    isLocalTitleChange.current = true
    try {
      doc.transact(() => {
        yTitle.delete(0, yTitle.length)
        yTitle.insert(0, newTitle)
      })
    } finally {
      isLocalTitleChange.current = false
    }
  }

  // Update user profile in awareness
  const handleUpdateUser = (updated: Partial<UserState>) => {
    const nextUser = { ...currentUser, ...updated }
    setCurrentUser(nextUser)
    if (provider) {
      provider.awareness.setLocalStateField('user', nextUser)
    }
  }

  // Toggle simulate offline network drop
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

  // Share room URL
  const copyShareUrl = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomName)}`
      navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  // Copy Judge Pitch
  const copyJudgePitch = () => {
    const pitch = "Built on the same CRDT approach real products like Google Docs and Figma use, so it's conflict-free by construction, not by luck."
    navigator.clipboard.writeText(pitch)
    setCopiedPitch(true)
    setTimeout(() => setCopiedPitch(false), 2000)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: App Logo & Document Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <input
                type="text"
                value={docTitle}
                onChange={handleTitleChange}
                placeholder="Untitled Document"
                className="text-lg font-bold text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1.5 py-0.5 transition w-64 sm:w-80 truncate border border-transparent hover:border-slate-300"
                title="Click to edit document title (collaboratively synced in real-time)"
              />
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 px-1.5 mt-0.5">
                <span>room: {roomName}</span>
                <span>•</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Auto-saved to disk
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions, Users & Status */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Demo Script Guide Button */}
            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs transition cursor-pointer"
              title="Open Hackathon Demo Script"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Demo Guide</span>
            </button>

            {/* Stage 5 Simulate Disconnect */}
            <button
              type="button"
              onClick={toggleNetworkSimulation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-xs transition cursor-pointer ${
                isSimulatingOffline
                  ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 animate-pulse'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Test Stage 5: Simulate network disconnect & delta recovery"
            >
              {isSimulatingOffline ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reconnect Wifi</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline">Simulate Disconnect</span>
                </>
              )}
            </button>

            {/* Share Room Link */}
            <button
              type="button"
              onClick={copyShareUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
              title="Copy link to open in second tab/window"
            >
              {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
              <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
            </button>

            {/* Version History Button (Stage D) */}
            <button
              type="button"
              onClick={() => setShowVersionHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
              title="View Version History & Time-Travel Restore"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">History</span>
            </button>

            {/* Comments & Suggestions Button (Stage E) */}
            <button
              type="button"
              onClick={() => setShowCommentsSidebar(!showCommentsSidebar)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                showCommentsSidebar
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Toggle Comments & Suggestions Panel"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Comments</span>
            </button>

            {/* Ops / Metrics Dashboard Link (Stage F) */}
            <Link
              href="/admin/metrics"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
              title="Open Cluster Ops & Sync Metrics Dashboard"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Metrics</span>
            </Link>

            {/* Current User Pill */}
            <button
              type="button"
              onClick={() => setShowUserModal(!showUserModal)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 shadow-xs transition cursor-pointer"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: currentUser.color }}
              />
              <span className="font-semibold text-slate-800 max-w-[90px] truncate">{currentUser.name}</span>
              <Palette className="w-3 h-3 text-slate-400" />
            </button>

            {/* Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                showSidebar
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title="Toggle Collaborators Sidebar"
            >
              <SidebarIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Offline Alert Banner */}
      {status === 'disconnected' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
            <span>
              <strong>Relay Disconnected (Simulated Offline Mode).</strong> Edits are buffered locally and will delta-sync automatically without data loss upon reconnect.
            </span>
          </div>
          {isSimulatingOffline && (
            <button
              type="button"
              onClick={toggleNetworkSimulation}
              className="px-3 py-0.5 bg-white text-amber-800 rounded font-semibold text-xs shadow-xs hover:bg-amber-50 cursor-pointer"
            >
              Reconnect
            </button>
          )}
        </div>
      )}

      {/* User Customization Dropdown Panel */}
      {showUserModal && (
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Display Name:</span>
            <input
              type="text"
              value={currentUser.name}
              onChange={(e) => handleUpdateUser({ name: e.target.value })}
              className="px-2.5 py-1 rounded border border-slate-300 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              placeholder="Your name"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Cursor Flag Color:</span>
            <div className="flex items-center gap-1.5">
              {CURSOR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleUpdateUser({ color: c })}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${currentUser.color === c ? 'scale-125 ring-2 ring-slate-800 ring-offset-1' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowUserModal(false)}
              className="ml-3 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Editor Canvas Area */}
        <div className="flex-1 overflow-y-auto py-8 px-4 sm:px-8 flex justify-center bg-slate-100">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-16 transition-all">
            {provider ? (
              <EditorSurface
                doc={doc}
                provider={provider}
                currentUser={currentUser}
                onStatsUpdate={setDocStats}
              />
            ) : (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span className="font-mono text-xs">Connecting to collaborative relay...</span>
              </div>
            )}
          </div>
        </div>

        {/* Collaborators & Stats Sidebar */}
        {showSidebar && (
          <aside className="w-80 border-l border-slate-200 bg-white p-5 flex flex-col gap-6 shadow-sm overflow-y-auto text-slate-800">
            {/* Active Collaborators Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Collaborators ({collaborators.length})
                </h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>

              <div className="space-y-2">
                {collaborators.map((c) => (
                  <div
                    key={c.clientId}
                    className={`flex items-center justify-between p-2 rounded-lg border transition ${
                      c.isCurrent ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-xs"
                        style={{ backgroundColor: c.user.color }}
                      >
                        {c.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                          {c.user.name}
                          {c.isCurrent && (
                            <span className="text-[10px] font-normal px-1 py-0.2 rounded bg-blue-100 text-blue-700">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          client #{c.clientId}
                        </div>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                  </div>
                ))}
              </div>
            </div>

            {/* Document Metrics */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono">
                Document Metrics
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 text-[10px] uppercase font-bold font-mono">Words</div>
                  <div className="text-base font-semibold text-slate-800">{docStats.words}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 text-[10px] uppercase font-bold font-mono">Characters</div>
                  <div className="text-base font-semibold text-slate-800">{docStats.chars}</div>
                </div>
              </div>
            </div>

            {/* System Connection Details */}
            <div className="border-t border-slate-200 pt-4 text-xs space-y-2 text-slate-600">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                CRDT Sync Engine
              </h3>
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                <span>Architecture</span>
                <span className="font-semibold text-slate-800">Yjs CRDT + TipTap</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                <span>Transport</span>
                <span className="font-mono text-slate-800">y-websocket</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                <span>Persistence</span>
                <span className="text-emerald-600 font-semibold font-mono">Binary Snapshot</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                <span>Delta Sync</span>
                <span className="text-blue-600 font-semibold font-mono">State Vector</span>
              </div>
              {lastSyncTime && (
                <div className="flex justify-between py-1 text-slate-500 font-mono">
                  <span>Last Sync</span>
                  <span className="text-slate-800">{lastSyncTime}</span>
                </div>
              )}
            </div>

            {/* Hackathon Pitch Snippet */}
            <div className="border-t border-slate-200 pt-4 mt-auto">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Judge One-Liner</span>
                  <button
                    type="button"
                    onClick={copyJudgePitch}
                    className="text-blue-600 hover:text-blue-800 text-[11px] flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {copiedPitch ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedPitch ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-slate-500 text-[11px] italic">
                  &quot;Built on the same CRDT approach real products like Google Docs and Figma use, so it&apos;s conflict-free by construction, not by luck.&quot;
                </p>
              </div>
            </div>
          </aside>
        )}

        {/* Stage E: Comments & Suggestions Panel */}
        {showCommentsSidebar && (
          <CommentsSidebar
            doc={doc}
            currentUser={currentUser}
            isSuggestingMode={isSuggestingMode}
            onToggleSuggestingMode={setIsSuggestingMode}
          />
        )}
      </div>

      {/* Judge Demo Script Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-900">Judge Demo Script Walkthrough</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                <strong>How to Demo in 60 Seconds:</strong>
              </div>

              <ol className="list-decimal pl-5 space-y-2.5">
                <li>
                  <strong>Open two browser windows side by side:</strong> Click the <em>Share</em> button in the navbar to copy the room URL, then paste it in a second window.
                </li>
                <li>
                  <strong>Instant concurrent typing:</strong> Type in window A — formatted text appears instantaneously in window B with no conflict.
                </li>
                <li>
                  <strong>Live presence & cursor tags:</strong> Move your cursor and select text in window A — see the colored name tag and caret moving live in window B.
                </li>
                <li>
                  <strong>Persistence verification:</strong> Refresh window B — the full document content and formatting are restored completely from disk snapshot.
                </li>
                <li>
                  <strong>Resilience & delta sync:</strong> Click <em>&quot;Simulate Disconnect&quot;</em> in window A. Type offline in window A, and type in window B. Click <em>&quot;Reconnect Wifi&quot;</em> — watch both sides exchange state vectors and delta-sync automatically!
                </li>
              </ol>

              <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 mt-2">
                <span className="font-semibold text-slate-800">One-line Pitch:</span>
                <p className="italic text-slate-600 mt-1">
                  &quot;Built on the same CRDT approach real products like Google Docs and Figma use, so it&apos;s conflict-free by construction, not by luck.&quot;
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={copyShareUrl}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition cursor-pointer"
              >
                {copiedLink ? 'Copied Room Link!' : 'Copy Room URL'}
              </button>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage D: Version History Drawer */}
      <VersionHistoryDrawer
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        roomName={roomName}
        currentUser={currentUser}
      />
    </div>
  )
}
