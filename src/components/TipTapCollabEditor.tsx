'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'

const CURSOR_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
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

function EditorSurface({
  doc,
  provider,
  currentUser,
}: {
  doc: Y.Doc
  provider: WebsocketProvider
  currentUser: UserState
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // CRITICAL: Disable TipTap default history extension.
      // Yjs handles undo/redo via y-prosemirror with multi-user awareness.
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
        class: 'focus:outline-none min-h-[320px] text-slate-800 p-5',
      },
    },
  })

  if (!editor) {
    return (
      <div className="p-10 text-center text-slate-400">
        Loading editor surface...
      </div>
    )
  }

  return (
    <div>
      {/* Rich Text Toolbar */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('bold') ? 'bg-slate-200 text-blue-600 font-bold' : 'text-slate-600'}`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('italic') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('strike') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('code') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-200 text-blue-600 font-bold' : 'text-slate-600'}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 text-blue-600 font-bold' : 'text-slate-600'}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('bulletList') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('orderedList') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-slate-100 transition ${editor.isActive('blockquote') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}
          title="Blockquote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="min-h-[320px] bg-white cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

interface TipTapCollabEditorProps {
  roomName?: string
  serverUrl?: string
}

export default function TipTapCollabEditor({
  roomName = 'collaborative-doc-demo',
  serverUrl = 'ws://localhost:1234',
}: TipTapCollabEditorProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<UserState>(() => generateRandomUser())
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [showUserModal, setShowUserModal] = useState<boolean>(false)
  const [isSimulatingOffline, setIsSimulatingOffline] = useState<boolean>(false)

  // Single stable Y.Doc instance across re-renders
  const doc = useMemo(() => new Y.Doc(), [])
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)

  useEffect(() => {
    const wsProvider = new WebsocketProvider(serverUrl, roomName, doc, {
      connect: true,
    })

    wsProvider.awareness.setLocalStateField('user', currentUser)

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
      wsProvider.off('status', handleStatus)
      wsProvider.awareness.off('change', handleAwareness)
      wsProvider.destroy()
      doc.destroy()
    }
  }, [serverUrl, roomName, doc])

  const handleUpdateUser = (updated: Partial<UserState>) => {
    const nextUser = { ...currentUser, ...updated }
    setCurrentUser(nextUser)
    if (provider) {
      provider.awareness.setLocalStateField('user', nextUser)
    }
  }

  // Stage 5 Network simulation: Disconnect / Reconnect
  const toggleNetworkSimulation = () => {
    if (!provider) return

    if (isSimulatingOffline) {
      console.log('[Resilience] Reconnecting WebSocket provider...')
      provider.connect()
      setIsSimulatingOffline(false)
    } else {
      console.log('[Resilience] Simulating network drop: disconnecting WebSocket...')
      provider.disconnect()
      setIsSimulatingOffline(true)
      setStatus('disconnected')
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Header / Collaboration Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-slate-800 text-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}
            ></span>
            Room: <span className="font-mono font-semibold text-blue-600">{roomName}</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-mono">{serverUrl}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Stage 5 Kill Network / Reconnect Toggle */}
          <button
            type="button"
            onClick={toggleNetworkSimulation}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition ${
              isSimulatingOffline
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 animate-pulse'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="Stage 5 Reconnect Test: Simulate network drop to verify offline editing and delta sync recovery"
          >
            {isSimulatingOffline ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Reconnect Wifi</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-500" />
                <span>Simulate Disconnect</span>
              </>
            )}
          </button>

          {/* Active Collaborators Avatars */}
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {collaborators.map((c) => (
              <div
                key={c.clientId}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ring-2 ring-white shadow-sm cursor-pointer transition hover:scale-110"
                style={{ backgroundColor: c.user.color }}
                title={`${c.user.name}${c.isCurrent ? ' (You)' : ''}`}
              >
                {c.user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Current User Pill / Customize Profile */}
          <button
            type="button"
            onClick={() => setShowUserModal(!showUserModal)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <span
              className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-300"
              style={{ backgroundColor: currentUser.color }}
            />
            <span className="font-medium truncate max-w-[100px]">{currentUser.name}</span>
            <Palette className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {/* Status Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: status === 'connected' ? '#f0fdf4' : status === 'connecting' ? '#fefce8' : '#fef2f2',
              borderColor: status === 'connected' ? '#bbf7d0' : status === 'connecting' ? '#fef08a' : '#fecaca',
              color: status === 'connected' ? '#166534' : status === 'connecting' ? '#854d0e' : '#991b1b',
            }}
          >
            {status === 'connected' ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span className="capitalize">{status}</span>
          </div>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {status === 'disconnected' && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Disconnected from relay.</strong> You can keep editing — your changes are stored locally in CRDT state and will delta-sync automatically upon reconnect.
            </span>
          </div>
          {isSimulatingOffline && (
            <button
              type="button"
              onClick={toggleNetworkSimulation}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded shadow-xs text-xs"
            >
              Resume Connection
            </button>
          )}
        </div>
      )}

      {/* User Customization Bar */}
      {showUserModal && (
        <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Display Name:</span>
            <input
              type="text"
              value={currentUser.name}
              onChange={(e) => handleUpdateUser({ name: e.target.value })}
              className="px-2.5 py-1 rounded border border-slate-300 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-medium"
              placeholder="Your name"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Cursor Color:</span>
            <div className="flex items-center gap-1.5">
              {CURSOR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleUpdateUser({ color: c })}
                  className={`w-5 h-5 rounded-full transition-transform ${currentUser.color === c ? 'scale-125 ring-2 ring-slate-800 ring-offset-1' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowUserModal(false)}
              className="ml-3 px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Editor Surface */}
      {provider ? (
        <EditorSurface doc={doc} provider={provider} currentUser={currentUser} />
      ) : (
        <div className="p-12 text-center text-slate-400">Connecting to collaborative relay...</div>
      )}

      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 flex items-center justify-between">
        <p>
          💡 <strong>Stage 5 (Reconnect & Delta Sync):</strong> Click &quot;Simulate Disconnect&quot; to test offline editing. When reconnecting, Yjs exchanges state vectors and sends only missing delta diffs.
        </p>
        <div className="flex items-center gap-2">
          <span>{collaborators.length} collaborator{collaborators.length === 1 ? '' : 's'} online</span>
          {lastSyncTime && <span>• Synced at {lastSyncTime}</span>}
        </div>
      </div>
    </div>
  )
}
