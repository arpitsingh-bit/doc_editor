'use client'

import React, { useEffect, useMemo, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
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
} from 'lucide-react'

interface TipTapCollabEditorProps {
  roomName?: string
  serverUrl?: string
}

export default function TipTapCollabEditor({
  roomName = 'collaborative-doc-demo',
  serverUrl = 'ws://localhost:1234',
}: TipTapCollabEditorProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [activeUsers, setActiveUsers] = useState<number>(1)
  const [lastSyncTime, setLastSyncTime] = useState<string>('')

  // Single stable Y.Doc instance across re-renders (prevents sync stop bugs)
  const doc = useMemo(() => new Y.Doc(), [])

  // Single stable WebsocketProvider
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)

  useEffect(() => {
    const wsProvider = new WebsocketProvider(serverUrl, roomName, doc, {
      connect: true,
    })
    setProvider(wsProvider)

    const handleStatus = (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setStatus(event.status)
      if (event.status === 'connected') {
        setLastSyncTime(new Date().toLocaleTimeString())
      }
    }
    wsProvider.on('status', handleStatus)

    const handleAwareness = () => {
      const states = wsProvider.awareness.getStates()
      setActiveUsers(Math.max(1, states.size))
    }
    wsProvider.awareness.on('change', handleAwareness)
    handleAwareness()

    return () => {
      wsProvider.off('status', handleStatus)
      wsProvider.awareness.off('change', handleAwareness)
      wsProvider.destroy()
      doc.destroy()
    }
  }, [serverUrl, roomName, doc])

  // TipTap editor bound to Y.Doc
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // CRITICAL: Disable TipTap default history extension.
      // Yjs handles undo/redo via y-prosemirror to ensure conflict-free undo stacks.
      StarterKit.configure({
        history: false,
      }),
      Collaboration.configure({
        document: doc,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[300px] text-slate-800 p-5',
      },
    },
  })

  if (!editor) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
        Initializing collaborative editor...
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-slate-800 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
            Room: <span className="font-mono font-semibold text-blue-600">{roomName}</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-mono">{serverUrl}</span>
        </div>

        <div className="flex items-center gap-3">
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

          {/* Active Collaborators Counter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>{activeUsers} active {activeUsers === 1 ? 'user' : 'users'}</span>
          </div>
        </div>
      </div>

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
          title="Undo (CRDT history)"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition"
          title="Redo (CRDT history)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* TipTap Rich Editor Surface */}
      <div className="min-h-[320px] bg-white cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>

      {/* Stage 2 Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 flex items-center justify-between">
        <p>
          💡 <strong>Stage 2 (TipTap Rich Editor):</strong> Rich formatting (headings, lists, bold, blockquotes) and collaborative undo/redo are synchronized simultaneously via Yjs ProseMirror bindings.
        </p>
        {lastSyncTime && <span>Synced at {lastSyncTime}</span>}
      </div>
    </div>
  )
}
