'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

interface PlainSyncEditorProps {
  roomName?: string
  serverUrl?: string
}

export default function PlainSyncEditor({
  roomName = 'collaborative-doc-demo',
  serverUrl = 'ws://localhost:1234',
}: PlainSyncEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [activeUsers, setActiveUsers] = useState<number>(1)
  const [charCount, setCharCount] = useState<number>(0)
  const [lastSyncTime, setLastSyncTime] = useState<string>('')

  // Crucial: Single stable instances of Y.Doc and Provider across re-renders
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const isLocalChange = useRef<boolean>(false)

  useEffect(() => {
    // 1. Initialize single Y.Doc
    const doc = new Y.Doc()
    ydocRef.current = doc

    // 2. Initialize y-websocket provider
    const provider = new WebsocketProvider(serverUrl, roomName, doc, {
      connect: true,
    })
    providerRef.current = provider

    // 3. Shared Y.Text instance
    const yText = doc.getText('plain-sync')

    // 4. Status listener
    const handleStatus = (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setStatus(event.status)
      if (event.status === 'connected') {
        setLastSyncTime(new Date().toLocaleTimeString())
      }
    }
    provider.on('status', handleStatus)

    // 5. Awareness listener (number of active connected tabs/clients)
    const handleAwareness = () => {
      const states = provider.awareness.getStates()
      setActiveUsers(Math.max(1, states.size))
    }
    provider.awareness.on('change', handleAwareness)
    handleAwareness()

    // 6. Observe Y.Text changes from peers
    const handleYTextChange = () => {
      if (isLocalChange.current) return

      const textarea = textareaRef.current
      if (!textarea) return

      const currentContent = yText.toString()
      if (textarea.value !== currentContent) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        textarea.value = currentContent
        setCharCount(currentContent.length)
        setLastSyncTime(new Date().toLocaleTimeString())

        // Preserve cursor if focused
        if (document.activeElement === textarea) {
          textarea.setSelectionRange(start, end)
        }
      }
    }
    yText.observe(handleYTextChange)

    // Initial load
    if (textareaRef.current) {
      const initialText = yText.toString()
      textareaRef.current.value = initialText
      setCharCount(initialText.length)
    }

    // Cleanup on unmount
    return () => {
      provider.off('status', handleStatus)
      provider.awareness.off('change', handleAwareness)
      yText.unobserve(handleYTextChange)
      provider.destroy()
      doc.destroy()
      ydocRef.current = null
      providerRef.current = null
    }
  }, [roomName, serverUrl])

  // 7. Handle local textarea typing with diff calculation
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const doc = ydocRef.current
    if (!doc) return
    const yText = doc.getText('plain-sync')
    const textarea = e.target

    const oldText = yText.toString()
    const newText = textarea.value
    setCharCount(newText.length)

    if (oldText === newText) return

    // Find common prefix
    let start = 0
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
      start++
    }

    // Find common suffix
    let endOld = oldText.length
    let endNew = newText.length
    while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
      endOld--
      endNew--
    }

    isLocalChange.current = true
    try {
      doc.transact(() => {
        if (endOld > start) {
          yText.delete(start, endOld - start)
        }
        if (endNew > start) {
          yText.insert(start, newText.slice(start, endNew))
        }
      })
      setLastSyncTime(new Date().toLocaleTimeString())
    } finally {
      isLocalChange.current = false
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header / Connection Bar */}
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: status === 'connected' ? '#f0fdf4' : status === 'connecting' ? '#fefce8' : '#fef2f2',
              borderColor: status === 'connected' ? '#bbf7d0' : status === 'connecting' ? '#fef08a' : '#fecaca',
              color: status === 'connected' ? '#166534' : status === 'connecting' ? '#854d0e' : '#991b1b'
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: status === 'connected' ? '#22c55e' : status === 'connecting' ? '#eab308' : '#ef4444'
              }}
            />
            <span className="capitalize">{status}</span>
          </div>

          {/* Connected Peers Counter */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span>👥</span>
            <span>{activeUsers} active {activeUsers === 1 ? 'client' : 'clients'}</span>
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="p-5">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-600">Stage 1 — Plain Sync Surface (&lt;textarea&gt;)</span>
          <div className="flex items-center gap-3">
            <span>{charCount} characters</span>
            {lastSyncTime && <span>Synced at {lastSyncTime}</span>}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          onChange={handleInput}
          placeholder="Start typing simultaneously in two browser tabs or windows to test real-time CRDT sync..."
          className="w-full h-80 p-4 font-mono text-sm leading-relaxed text-slate-800 bg-slate-50 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          spellCheck={false}
        />
      </div>

      {/* Stage 1 Instructions Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 flex items-center justify-between">
        <p>
          💡 <strong>Stage 1 Sync Test:</strong> Open <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">http://localhost:3000</code> in two side-by-side browser tabs. Text typed in one tab syncs immediately with no data loss.
        </p>
      </div>
    </div>
  )
}
