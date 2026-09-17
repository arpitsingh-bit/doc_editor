'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
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
} from 'lucide-react'

interface SelectionToolbarProps {
  editor: Editor | null
}

interface ToolbarPosition {
  top: number
  left: number
}

/**
 * SelectionToolbar — floats above the selection.
 *
 * Appears only when the editor has a non-collapsed selection.
 * Disappears when the selection collapses.
 * Positioned via editor.view.coordsAtPos() so it tracks the selection precisely.
 *
 * The undo/redo buttons are always accessible here (not just on selection),
 * anchored to a fixed position at the bottom-left of the editor container.
 *
 * Per the brief: 150ms transitions on state changes only.
 */
export function SelectionToolbar({ editor }: SelectionToolbarProps) {
  const [position, setPosition] = useState<ToolbarPosition | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!editor || editor.state.selection.empty) {
      setIsVisible(false)
      return
    }

    const { from, to } = editor.state.selection
    const start = editor.view.coordsAtPos(from)
    const end = editor.view.coordsAtPos(to)

    // Place toolbar centered above the selection start
    const toolbarWidth = toolbarRef.current?.offsetWidth ?? 280
    const midX = (start.left + end.left) / 2
    const topY = start.top

    // Clamp to viewport — don't let it go off-screen
    const clampedLeft = Math.max(
      8,
      Math.min(midX - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8)
    )

    setPosition({
      top: topY + window.scrollY - (toolbarRef.current?.offsetHeight ?? 40) - 8,
      left: clampedLeft,
    })
    setIsVisible(true)
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      // Small rAF delay lets the DOM settle before measuring coords
      requestAnimationFrame(updatePosition)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('update', handleSelectionUpdate)

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('update', handleSelectionUpdate)
    }
  }, [editor, updatePosition])

  // Hide on scroll to prevent stale positioning
  useEffect(() => {
    const onScroll = () => setIsVisible(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!editor) return null

  const btn = (
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    title: string
  ) => (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent the toolbar click from stealing editor focus
        e.preventDefault()
        onClick()
      }}
      className={`selection-toolbar-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {icon}
    </button>
  )

  const divider = <span className="selection-toolbar-divider" aria-hidden />

  return (
    <>
      {/* Floating contextual toolbar — appears on non-empty selection */}
      {isVisible && position && (
        <div
          ref={toolbarRef}
          className="selection-toolbar"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            // Ensure it appears above editor content and cursor labels
            zIndex: 50,
          }}
          role="toolbar"
          aria-label="Text formatting"
          // Don't capture pointer events when not visible
          onMouseDown={(e) => e.preventDefault()}
        >
          {btn(
            editor.isActive('bold'),
            () => editor.chain().focus().toggleBold().run(),
            <Bold className="w-3.5 h-3.5" />,
            'Bold — ⌘B'
          )}
          {btn(
            editor.isActive('italic'),
            () => editor.chain().focus().toggleItalic().run(),
            <Italic className="w-3.5 h-3.5" />,
            'Italic — ⌘I'
          )}
          {btn(
            editor.isActive('strike'),
            () => editor.chain().focus().toggleStrike().run(),
            <Strikethrough className="w-3.5 h-3.5" />,
            'Strikethrough'
          )}
          {btn(
            editor.isActive('code'),
            () => editor.chain().focus().toggleCode().run(),
            <Code className="w-3.5 h-3.5" />,
            'Inline code — ⌘E'
          )}

          {divider}

          {btn(
            editor.isActive('heading', { level: 1 }),
            () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            <Heading1 className="w-3.5 h-3.5" />,
            'Heading 1 — ⌘⌥1'
          )}
          {btn(
            editor.isActive('heading', { level: 2 }),
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            <Heading2 className="w-3.5 h-3.5" />,
            'Heading 2 — ⌘⌥2'
          )}

          {divider}

          {btn(
            editor.isActive('bulletList'),
            () => editor.chain().focus().toggleBulletList().run(),
            <List className="w-3.5 h-3.5" />,
            'Bullet list'
          )}
          {btn(
            editor.isActive('orderedList'),
            () => editor.chain().focus().toggleOrderedList().run(),
            <ListOrdered className="w-3.5 h-3.5" />,
            'Numbered list'
          )}
          {btn(
            editor.isActive('blockquote'),
            () => editor.chain().focus().toggleBlockquote().run(),
            <Quote className="w-3.5 h-3.5" />,
            'Blockquote'
          )}

          {divider}

          {btn(
            false,
            () => editor.chain().focus().undo().run(),
            <Undo className="w-3.5 h-3.5" />,
            'Undo — ⌘Z'
          )}
          {btn(
            false,
            () => editor.chain().focus().redo().run(),
            <Redo className="w-3.5 h-3.5" />,
            'Redo — ⌘⇧Z'
          )}
        </div>
      )}
    </>
  )
}

export default SelectionToolbar
