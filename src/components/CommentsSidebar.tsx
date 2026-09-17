'use client'

import React, { useEffect, useState } from 'react'
import * as Y from 'yjs'
import {
  MessageSquare,
  CheckCircle2,
  Send,
  Trash2,
  Clock,
  Sparkles,
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

  // Yjs Shared Maps
  const commentsMap = doc.getMap<CommentItem>('comments')
  const suggestionsMap = doc.getMap<SuggestionItem>('suggestions')

  useEffect(() => {
    const updateComments = () => {
      const allComments: CommentItem[] = []
      commentsMap.forEach((val) => {
        if (val && val.id) allComments.push(val)
      })
      allComments.sort((a, b) => b.createdAt - a.createdAt)
      setComments(allComments)
    }

    const updateSuggestions = () => {
      const allSuggestions: SuggestionItem[] = []
      suggestionsMap.forEach((val) => {
        if (val && val.id) allSuggestions.push(val)
      })
      allSuggestions.sort((a, b) => b.createdAt - a.createdAt)
      setSuggestions(allSuggestions)
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
    const comment: CommentItem = {
      id,
      authorName: currentUser.name,
      authorColor: currentUser.color,
      text: newCommentText.trim(),
      createdAt: Date.now(),
      resolved: false,
      replies: [],
    }

    commentsMap.set(id, comment)
    setNewCommentText('')
  }

  const handleAddReply = (commentId: string) => {
    const text = replyTexts[commentId]?.trim()
    if (!text) return

    const comment = commentsMap.get(commentId)
    if (!comment) return

    const updatedComment: CommentItem = {
      ...comment,
      replies: [
        ...comment.replies,
        {
          id: `reply-${Date.now()}`,
          authorName: currentUser.name,
          authorColor: currentUser.color,
          text,
          createdAt: Date.now(),
        },
      ],
    }

    commentsMap.set(commentId, updatedComment)
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

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shadow-xs shrink-0 select-none text-slate-800">
      {/* Tab Switcher & Mode Toggle */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1 bg-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('comments')}
              className={`px-2.5 py-1 rounded-md transition ${
                activeTab === 'comments'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Comments ({openComments.length})
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-2.5 py-1 rounded-md transition ${
                activeTab === 'suggestions'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Suggestions ({pendingSuggestions.length})
            </button>
          </div>
        </div>

        {/* Suggestion Mode Toggle Bar */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100 text-xs">
          <div className="flex items-center gap-1.5 text-blue-950 font-medium">
            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Suggestion Mode</span>
          </div>
          <button
            type="button"
            onClick={() => onToggleSuggestingMode(!isSuggestingMode)}
            className="flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 transition cursor-pointer"
          >
            {isSuggestingMode ? (
              <>
                <span className="text-[11px] text-emerald-600 font-mono">ON</span>
                <ToggleRight className="w-5 h-5 text-emerald-600" />
              </>
            ) : (
              <>
                <span className="text-[11px] text-slate-500 font-mono">OFF</span>
                <ToggleLeft className="w-5 h-5 text-slate-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white">
        {activeTab === 'comments' ? (
          <>
            {/* New Comment Input Box */}
            <form onSubmit={handleAddComment} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 font-mono uppercase tracking-wider">Add a Comment</label>
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Give feedback or ask a question..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1 transition cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Post</span>
                </button>
              </div>
            </form>

            {/* Comments List */}
            {comments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <MessageSquare className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
                <p className="font-medium text-slate-600">No comments yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Post the first comment to start a collaborative thread.</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-xl border transition ${
                    comment.resolved
                      ? 'bg-slate-50/70 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                  }`}
                >
                  {/* Author Header */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: comment.authorColor }}
                      />
                      <span className="font-semibold text-xs text-slate-800">{comment.authorName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleResolve(comment.id)}
                        className={`p-1 rounded transition ${
                          comment.resolved
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
                        }`}
                        title={comment.resolved ? 'Reopen thread' : 'Mark resolved'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Comment Body */}
                  <p className="text-xs text-slate-700 leading-relaxed break-words">{comment.text}</p>
                  <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Replies List */}
                  {comment.replies.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="pl-2 border-l-2 border-blue-500 bg-slate-50 p-2 rounded-r">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: reply.authorColor }}
                            />
                            <span className="font-semibold text-[11px] text-slate-800">{reply.authorName}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-normal">{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input Box */}
                  {!comment.resolved && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex gap-1">
                      <input
                        type="text"
                        value={replyTexts[comment.id] || ''}
                        onChange={(e) =>
                          setReplyTexts((prev) => ({ ...prev, [comment.id]: e.target.value }))
                        }
                        placeholder="Reply..."
                        className="flex-1 text-xs px-2.5 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 text-slate-800 placeholder:text-slate-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddReply(comment.id)
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddReply(comment.id)}
                        disabled={!replyTexts[comment.id]?.trim()}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white disabled:opacity-40 text-slate-600 rounded-md text-xs transition cursor-pointer"
                      >
                        Reply
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        ) : (
          /* Suggestions Tab */
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <FileCheck className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
                <p className="font-medium text-slate-600">No suggestions pending</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Turn on &quot;Suggestion Mode&quot; to propose tracked insertions and deletions.
                </p>
              </div>
            ) : (
              suggestions.map((sugg) => (
                <div
                  key={sugg.id}
                  className={`p-3 rounded-xl border transition ${
                    sugg.status === 'accepted'
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : sugg.status === 'rejected'
                      ? 'bg-rose-50/60 border-rose-200 opacity-60'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: sugg.authorColor }}
                      />
                      <span className="font-semibold text-xs text-slate-800">{sugg.authorName}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold font-mono uppercase px-1.5 py-0.5 rounded ${
                        sugg.type === 'insert'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {sugg.type === 'insert' ? 'Add' : 'Delete'}
                    </span>
                  </div>

                  {/* Diff Content Preview */}
                  <div className="p-2 rounded bg-slate-50 border border-slate-200 text-xs font-mono my-2">
                    {sugg.type === 'insert' ? (
                      <span className="text-emerald-700 bg-emerald-100/60 px-1 py-0.5 rounded">
                        +{sugg.text}
                      </span>
                    ) : (
                      <span className="text-rose-700 line-through bg-rose-100/60 px-1 py-0.5 rounded">
                        -{sugg.text}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {sugg.status === 'pending' ? (
                    <div className="flex justify-end gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => handleReject(sugg)}
                        className="px-2 py-1 rounded text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1 transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(sugg)}
                        className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition shadow-xs cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Accept</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] font-medium font-mono text-slate-500 text-right capitalize">
                      Status: {sugg.status}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
