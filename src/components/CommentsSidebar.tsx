'use client'

import React, { useEffect, useState } from 'react'
import * as Y from 'yjs'
import {
  MessageSquare,
  CheckCircle2,
  Send,
  Trash2,
  Clock,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  FileCheck,
} from 'lucide-react'

export interface CommentItem {
  id: string
  authorName: string
  authorColor: string
  text: string
  selectedText?: string
  createdAt: number
  resolved: boolean
  replies: {
    id: string
    authorName: string
    authorColor: string
    text: string
    createdAt: number
  }[]
}

export interface SuggestionItem {
  id: string
  type: 'insert' | 'delete'
  authorName: string
  authorColor: string
  text: string
  contextBefore?: string
  createdAt: number
  status: 'pending' | 'accepted' | 'rejected'
}

interface CommentsSidebarProps {
  doc: Y.Doc
  currentUser: { name: string; color: string }
  isSuggestingMode: boolean
  onToggleSuggestingMode: (enabled: boolean) => void
  onAcceptSuggestion?: (suggestion: SuggestionItem) => void
  onRejectSuggestion?: (suggestion: SuggestionItem) => void
}

export default function CommentsSidebar({
  doc,
  currentUser,
  isSuggestingMode,
  onToggleSuggestingMode,
  onAcceptSuggestion,
  onRejectSuggestion,
}: CommentsSidebarProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'suggestions'>('comments')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [newCommentText, setNewCommentText] = useState('')
  const [replyTexts, setReplyTexts] = useState<{ [commentId: string]: string }>({})

  const commentsMap = doc.getMap<CommentItem>('comments')
  const suggestionsMap = doc.getMap<SuggestionItem>('suggestions')

  useEffect(() => {
    const updateComments = () => {
      const all: CommentItem[] = []
      commentsMap.forEach((val) => { if (val && val.id) all.push(val) })
      all.sort((a, b) => b.createdAt - a.createdAt)
      setComments(all)
    }
    const updateSuggestions = () => {
      const all: SuggestionItem[] = []
      suggestionsMap.forEach((val) => { if (val && val.id) all.push(val) })
      all.sort((a, b) => b.createdAt - a.createdAt)
      setSuggestions(all)
    }
    commentsMap.observe(updateComments)
    suggestionsMap.observe(updateSuggestions)
    updateComments()
    updateSuggestions()
    return () => {
      commentsMap.unobserve(updateComments)
      suggestionsMap.unobserve(updateSuggestions)
    }
  }, [doc, commentsMap, suggestionsMap])

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim()) return
    const id = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    commentsMap.set(id, {
      id, authorName: currentUser.name, authorColor: currentUser.color,
      text: newCommentText.trim(), createdAt: Date.now(), resolved: false, replies: [],
    })
    setNewCommentText('')
  }

  const handleAddReply = (commentId: string) => {
    const text = replyTexts[commentId]?.trim()
    if (!text) return
    const comment = commentsMap.get(commentId)
    if (!comment) return
    commentsMap.set(commentId, {
      ...comment,
      replies: [...comment.replies, {
        id: `reply-${Date.now()}`,
        authorName: currentUser.name,
        authorColor: currentUser.color,
        text, createdAt: Date.now(),
      }],
    })
    setReplyTexts((prev) => ({ ...prev, [commentId]: '' }))
  }

  const handleToggleResolve = (commentId: string) => {
    const comment = commentsMap.get(commentId)
    if (!comment) return
    commentsMap.set(commentId, { ...comment, resolved: !comment.resolved })
  }

  const handleDeleteComment = (commentId: string) => {
    commentsMap.delete(commentId)
  }

  const handleAccept = (suggestion: SuggestionItem) => {
    suggestionsMap.set(suggestion.id, { ...suggestion, status: 'accepted' })
    if (onAcceptSuggestion) onAcceptSuggestion(suggestion)
  }

  const handleReject = (suggestion: SuggestionItem) => {
    suggestionsMap.set(suggestion.id, { ...suggestion, status: 'rejected' })
    if (onRejectSuggestion) onRejectSuggestion(suggestion)
  }

  const openComments = comments.filter((c) => !c.resolved)
  const resolvedComments = comments.filter((c) => c.resolved)
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending')

  // ── Shared style helpers ──────────────────────────────────────────────────
  const panelBg = { backgroundColor: 'var(--color-chrome-bg)' }
  const borderColor = { borderColor: 'var(--color-border)' }
  const inkStyle = { color: 'var(--color-ink)', fontFamily: 'var(--font-ui)' }
  const ink2Style = { color: 'var(--color-ink-2)', fontFamily: 'var(--font-ui)' }
  const ink3Style = { color: 'var(--color-ink-3)', fontFamily: 'var(--font-ui)' }

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ ...panelBg, fontFamily: 'var(--font-ui)' }}
    >
      {/* ── Panel header ─────────────────────────────────────────────── */}
      <div
        className="px-4 pt-4 pb-3 border-b flex-shrink-0"
        style={borderColor}
      >
        {/* Tab switcher */}
        <div className="flex gap-0.5 mb-3">
          {(['comments', 'suggestions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer capitalize"
              style={
                activeTab === tab
                  ? {
                      backgroundColor: 'var(--color-accent-subtle)',
                      color: 'var(--color-accent-text)',
                    }
                  : ink2Style
              }
              aria-pressed={activeTab === tab}
            >
              {tab === 'comments'
                ? `Comments (${openComments.length})`
                : `Suggestions (${pendingSuggestions.length})`}
            </button>
          ))}
        </div>

        {/* Suggestion mode toggle */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded"
          style={{
            backgroundColor: isSuggestingMode
              ? 'var(--color-accent-subtle)'
              : 'var(--color-paper-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <FileCheck
              className="w-3.5 h-3.5"
              style={{ color: isSuggestingMode ? 'var(--color-accent)' : 'var(--color-ink-3)' }}
              aria-hidden
            />
            <span
              className="text-xs font-medium"
              style={{ color: isSuggestingMode ? 'var(--color-accent-text)' : 'var(--color-ink-2)' }}
            >
              Suggestion mode
            </span>
          </div>
          <button
            type="button"
            onClick={() => onToggleSuggestingMode(!isSuggestingMode)}
            className="flex items-center gap-1 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: isSuggestingMode ? 'var(--color-accent-text)' : 'var(--color-ink-3)' }}
            aria-pressed={isSuggestingMode}
            aria-label={isSuggestingMode ? 'Disable suggestion mode' : 'Enable suggestion mode'}
          >
            <span className="font-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
              {isSuggestingMode ? 'ON' : 'OFF'}
            </span>
            {isSuggestingMode
              ? <ToggleRight className="w-5 h-5" aria-hidden />
              : <ToggleLeft className="w-5 h-5" aria-hidden />
            }
          </button>
        </div>
      </div>

      {/* ── Scrollable content area ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'comments' ? (
          <>
            {/* New comment form */}
            <form
              onSubmit={handleAddComment}
              className="p-3 rounded border"
              style={{
                backgroundColor: 'var(--color-paper-2)',
                borderColor: 'var(--color-border)',
              }}
            >
              <label
                className="block text-2xs font-medium uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}
              >
                Add comment
              </label>
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Give feedback or ask a question…"
                rows={3}
                className="w-full text-xs px-2.5 py-2 rounded border resize-none transition-colors"
                style={{
                  backgroundColor: 'var(--color-chrome-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-ui)',
                }}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-opacity cursor-pointer disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'hsl(40 20% 97%)',
                  }}
                >
                  <Send className="w-3 h-3" aria-hidden />
                  Post
                </button>
              </div>
            </form>

            {/* Comments list */}
            {comments.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="w-6 h-6" aria-hidden />}
                title="No comments yet"
                body="Post the first comment to start a thread."
              />
            ) : (
              comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  replyText={replyTexts[comment.id] || ''}
                  onReplyChange={(text) => setReplyTexts((prev) => ({ ...prev, [comment.id]: text }))}
                  onSubmitReply={() => handleAddReply(comment.id)}
                  onToggleResolve={() => handleToggleResolve(comment.id)}
                  onDelete={() => handleDeleteComment(comment.id)}
                />
              ))
            )}
          </>
        ) : (
          /* Suggestions tab */
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <EmptyState
                icon={<FileCheck className="w-6 h-6" aria-hidden />}
                title="No suggestions pending"
                body='Enable "Suggestion mode" to propose tracked changes.'
              />
            ) : (
              suggestions.map((sugg) => (
                <SuggestionCard
                  key={sugg.id}
                  suggestion={sugg}
                  onAccept={() => handleAccept(sugg)}
                  onReject={() => handleReject(sugg)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="py-10 text-center" style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="mx-auto mb-2 flex items-center justify-center" style={{ color: 'var(--color-ink-3)' }}>
        {icon}
      </div>
      <p className="text-xs font-medium" style={{ color: 'var(--color-ink-2)' }}>{title}</p>
      <p className="text-2xs mt-1" style={{ color: 'var(--color-ink-3)' }}>{body}</p>
    </div>
  )
}

function CommentCard({
  comment,
  replyText,
  onReplyChange,
  onSubmitReply,
  onToggleResolve,
  onDelete,
}: {
  comment: CommentItem
  replyText: string
  onReplyChange: (text: string) => void
  onSubmitReply: () => void
  onToggleResolve: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="p-3 rounded border transition-opacity"
      style={{
        backgroundColor: comment.resolved ? 'var(--color-paper-2)' : 'var(--color-chrome-bg)',
        borderColor: 'var(--color-border)',
        opacity: comment.resolved ? 0.6 : 1,
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Author row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: comment.authorColor }}
            aria-hidden
          />
          <span className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
            {comment.authorName}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleResolve}
            className="p-1 rounded transition-colors cursor-pointer"
            style={{ color: comment.resolved ? 'var(--color-state-connected)' : 'var(--color-ink-3)' }}
            title={comment.resolved ? 'Reopen thread' : 'Mark resolved'}
            aria-label={comment.resolved ? 'Reopen' : 'Resolve'}
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded transition-colors cursor-pointer"
            style={{ color: 'var(--color-ink-3)' }}
            title="Delete comment"
            aria-label="Delete comment"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Body */}
      <p className="text-xs leading-relaxed break-words" style={{ color: 'var(--color-ink)' }}>
        {comment.text}
      </p>
      <div className="mt-1 flex items-center gap-1" style={{ color: 'var(--color-ink-3)' }}>
        <Clock className="w-2.5 h-2.5" aria-hidden />
        <span className="text-2xs font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
          {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2.5 pt-2 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
          {comment.replies.map((reply) => (
            <div
              key={reply.id}
              className="pl-2.5 py-1.5 rounded-r text-xs"
              style={{
                borderLeft: `2px solid ${reply.authorColor}`,
                backgroundColor: 'var(--color-paper-2)',
                color: 'var(--color-ink)',
              }}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: reply.authorColor }}
                  aria-hidden
                />
                <span className="font-medium text-2xs" style={{ color: 'var(--color-ink-2)' }}>
                  {reply.authorName}
                </span>
              </div>
              <p>{reply.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {!comment.resolved && (
        <div className="mt-2 pt-2 border-t flex gap-1.5" style={{ borderColor: 'var(--color-border)' }}>
          <input
            type="text"
            value={replyText}
            onChange={(e) => onReplyChange(e.target.value)}
            placeholder="Reply…"
            className="flex-1 text-xs px-2 py-1 rounded border transition-colors"
            style={{
              backgroundColor: 'var(--color-paper-2)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-ui)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onSubmitReply() }
            }}
            aria-label="Write a reply"
          />
          <button
            type="button"
            onClick={onSubmitReply}
            disabled={!replyText.trim()}
            className="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
            style={{
              backgroundColor: 'var(--color-paper-3)',
              color: 'var(--color-ink-2)',
              border: '1px solid var(--color-border)',
            }}
            aria-label="Post reply"
          >
            Reply
          </button>
        </div>
      )}
    </div>
  )
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: SuggestionItem
  onAccept: () => void
  onReject: () => void
}) {
  const isAccepted = suggestion.status === 'accepted'
  const isRejected = suggestion.status === 'rejected'
  const isPending = suggestion.status === 'pending'

  return (
    <div
      className="p-3 rounded border transition-opacity"
      style={{
        backgroundColor: isAccepted
          ? 'var(--color-paper-2)'
          : isRejected
            ? 'var(--color-paper-2)'
            : 'var(--color-chrome-bg)',
        borderColor: 'var(--color-border)',
        opacity: isPending ? 1 : 0.6,
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Author + type badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: suggestion.authorColor }}
            aria-hidden
          />
          <span className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
            {suggestion.authorName}
          </span>
        </div>
        <span
          className="text-2xs font-medium px-1.5 py-0.5 rounded"
          style={{
            fontFamily: 'var(--font-mono)',
            backgroundColor:
              suggestion.type === 'insert' ? 'hsl(141 50% 92%)' : 'hsl(0 50% 93%)',
            color:
              suggestion.type === 'insert' ? 'var(--color-state-connected)' : 'hsl(0 65% 38%)',
          }}
        >
          {suggestion.type === 'insert' ? '+add' : '−delete'}
        </span>
      </div>

      {/* Diff preview */}
      <div
        className="px-2 py-1.5 rounded text-xs font-mono my-2"
        style={{
          backgroundColor: 'var(--color-paper-2)',
          border: '1px solid var(--color-border)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-ink)',
        }}
      >
        {suggestion.type === 'insert' ? (
          <span style={{ color: 'var(--color-state-connected)' }}>+{suggestion.text}</span>
        ) : (
          <span style={{ textDecoration: 'line-through', color: 'hsl(0 65% 45%)' }}>
            -{suggestion.text}
          </span>
        )}
      </div>

      {/* Actions or status */}
      {isPending ? (
        <div className="flex justify-end gap-1.5 mt-1">
          <button
            type="button"
            onClick={onReject}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer"
            style={{
              color: 'hsl(0 65% 45%)',
              borderColor: 'hsl(0 50% 83%)',
              backgroundColor: 'transparent',
            }}
            aria-label="Reject suggestion"
          >
            <X className="w-3 h-3" aria-hidden />
            Reject
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--color-state-connected)',
              color: 'white',
            }}
            aria-label="Accept suggestion"
          >
            <Check className="w-3 h-3" aria-hidden />
            Accept
          </button>
        </div>
      ) : (
        <div
          className="text-right text-2xs capitalize"
          style={{ color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}
        >
          {suggestion.status}
        </div>
      )}
    </div>
  )
}
