'use client'

import React, { useState } from 'react'

interface Collaborator {
  clientId: number
  isCurrent: boolean
  user: {
    name: string
    color: string
  }
}

interface PresenceStackProps {
  collaborators: Collaborator[]
}

/**
 * PresenceStack — overlapping avatar chips.
 *
 * Shows up to MAX_VISIBLE avatars with the current user always included.
 * Overflow beyond MAX_VISIBLE renders as "+N" count chip.
 * Each avatar shows initials, uses the collaborator's vivid presence colour
 * as a ring border (not as a background — keeping the vivid colour constrained
 * to the outline so it doesn't compete with the document content).
 */

const MAX_VISIBLE = 4

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function Avatar({
  collaborator,
  zIndex,
}: {
  collaborator: Collaborator
  zIndex: number
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const { user, isCurrent, clientId } = collaborator
  const initials = getInitials(user.name)

  return (
    <div
      className="relative"
      style={{ zIndex, marginLeft: zIndex === MAX_VISIBLE ? 0 : '-8px' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {/* Avatar circle */}
      <div
        role="img"
        aria-label={`${user.name}${isCurrent ? ' (you)' : ''}`}
        className="w-7 h-7 rounded-full flex items-center justify-center text-2xs font-semibold select-none cursor-default"
        style={{
          // Vivid presence colour as a ring border; neutral paper background for legibility
          backgroundColor: 'var(--color-paper-2)',
          color: user.color,
          boxShadow: isCurrent
            ? `0 0 0 2px var(--color-accent), 0 0 0 3.5px var(--color-chrome-bg)`
            : `0 0 0 2px ${user.color}, 0 0 0 3.5px var(--color-chrome-bg)`,
          fontFamily: 'var(--font-ui)',
        }}
      >
        {initials}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 mb-2 whitespace-nowrap rounded px-2 py-1 text-2xs font-medium pointer-events-none animate-fade-in"
          style={{
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-ink)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-ui)',
            zIndex: 100,
            boxShadow: '0 2px 6px rgb(0 0 0 / 0.2)',
          }}
          role="tooltip"
        >
          {user.name}{isCurrent ? ' (you)' : ''}
          {/* Tooltip arrow */}
          <span
            className="absolute top-full left-1/2"
            style={{
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: `4px solid var(--color-ink)`,
            }}
          />
        </div>
      )}
    </div>
  )
}

export function PresenceStack({ collaborators }: PresenceStackProps) {
  if (collaborators.length === 0) return null

  // Current user first, then others
  const sorted = [...collaborators].sort((a, b) => {
    if (a.isCurrent) return -1
    if (b.isCurrent) return 1
    return 0
  })

  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = sorted.length - MAX_VISIBLE

  return (
    <div className="flex items-center" aria-label={`${collaborators.length} collaborator${collaborators.length !== 1 ? 's' : ''} online`}>
      <div className="flex items-center" style={{ paddingLeft: '8px' }}>
        {visible.map((c, i) => (
          <Avatar
            key={c.clientId}
            collaborator={c}
            zIndex={MAX_VISIBLE - i}
          />
        ))}
        {overflow > 0 && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-2xs font-semibold select-none"
            style={{
              marginLeft: '-8px',
              zIndex: 0,
              backgroundColor: 'var(--color-paper-3)',
              color: 'var(--color-ink-2)',
              border: '2px solid var(--color-chrome-bg)',
              fontFamily: 'var(--font-ui)',
            }}
            aria-label={`${overflow} more collaborator${overflow !== 1 ? 's' : ''}`}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}

export default PresenceStack
