'use client'

import React from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

interface ConnectionStatusProps {
  status: ConnectionState
  lastSyncTime: string
  pendingOfflineUpdates: number
}

/**
 * ConnectionStatus — four visually distinct states, not a badge with changed text.
 *
 * connecting    → amber pulsing dot  + "Connecting…"
 * connected     → solid green dot    + "Synced HH:MM" (or just "Synced")
 * disconnected  → grey dot           + "Offline"
 * reconnecting  → spinning ring      + "Reconnecting…"
 *
 * Lives in the StatusBar at the bottom of the editor.
 */
export function ConnectionStatus({
  status,
  lastSyncTime,
  pendingOfflineUpdates,
}: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-1.5" aria-live="polite" aria-label={`Connection: ${status}`}>
      <StatusDot status={status} />
      <span
        className="font-mono text-2xs leading-none"
        style={{ color: 'var(--color-ink-3)' }}
      >
        {status === 'connected' && (
          <span style={{ color: 'var(--color-state-connected)' }}>
            {lastSyncTime ? `Synced ${lastSyncTime}` : 'Synced'}
          </span>
        )}
        {status === 'connecting' && (
          <span style={{ color: 'var(--color-state-connecting)' }}>Connecting…</span>
        )}
        {status === 'disconnected' && (
          <span style={{ color: 'var(--color-state-offline)' }}>
            Offline{pendingOfflineUpdates > 0 ? ` · ${pendingOfflineUpdates} unsaved` : ''}
          </span>
        )}
        {status === 'reconnecting' && (
          <span style={{ color: 'var(--color-state-reconnecting)' }}>Reconnecting…</span>
        )}
      </span>
    </div>
  )
}

function StatusDot({ status }: { status: ConnectionState }) {
  if (status === 'reconnecting') {
    return (
      <Loader2
        className="w-3 h-3 animate-spin"
        style={{ color: 'var(--color-state-reconnecting)' }}
        aria-hidden
      />
    )
  }

  if (status === 'disconnected') {
    return (
      <WifiOff
        className="w-3 h-3"
        style={{ color: 'var(--color-state-offline)' }}
        aria-hidden
      />
    )
  }

  return (
    <span className="relative flex h-2 w-2 items-center justify-center" aria-hidden>
      {status === 'connecting' && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
          style={{ backgroundColor: 'var(--color-state-connecting)' }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{
          backgroundColor:
            status === 'connected'
              ? 'var(--color-state-connected)'
              : 'var(--color-state-connecting)',
        }}
      />
    </span>
  )
}

export default ConnectionStatus
