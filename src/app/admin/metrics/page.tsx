'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  Server,
  Database,
  Cpu,
  Layers,
  RefreshCw,
  Zap,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Radio,
  FileText,
} from 'lucide-react'

interface ServerMetrics {
  timestamp: string
  uptimeSeconds: number
  activeRoomsCount: number
  rooms: {
    room: string
    connections: number
    subscribers: number
  }[]
  relay: {
    instanceId: string
    mode: string
    subscribedRoomsCount: number
    messagesPublished: number
    messagesReceived: number
    messagesEchoFiltered: number
    avgLatencyMs: number
    p95LatencyMs: number
    lastSyncTime: string | null
    connectedPeers?: number
  }
  compaction: {
    totalCompactions: number
    totalBytesSaved: number
    lastCompactionTime: string | null
    activeTrackedDocs: number
    updateThreshold: number
    intervalMs: number
    history?: any[]
  }
  storage: {
    redisHits: number
    postgresHits: number
    legacyHits: number
    totalLoads: number
    flushes: number
    redis: {
      type: string
      cachedDocsCount: number
      stats: {
        hits: number
        misses: number
        writes: number
        evictions: number
      }
      defaultTTLSeconds: number
    }
    isLivePostgres: boolean
  }
  memory: {
    heapUsedMB: string
    heapTotalMB: string
    rssMB: string
  }
}

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCompacting, setIsCompacting] = useState(false)
  const [compactMessage, setCompactMessage] = useState<string | null>(null)

  const serverUrl =
    process.env.NEXT_PUBLIC_WS_SERVER_URL?.replace(/^ws/, 'http') || 'http://localhost:1234'

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${serverUrl}/metrics`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch metrics`)
      const data = await res.json()
      setMetrics(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Server offline or unreachable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const timer = setInterval(fetchMetrics, 2500)
    return () => clearInterval(timer)
  }, [])

  const triggerCompaction = async () => {
    setIsCompacting(true)
    setCompactMessage(null)
    try {
      const res = await fetch(`${serverUrl}/api/compaction/run`, { method: 'POST' })
      const data = await res.json()
      setCompactMessage(`Compacted ${data.count} active documents!`)
      setTimeout(() => setCompactMessage(null), 4000)
      await fetchMetrics()
    } catch (err: any) {
      setCompactMessage(`Compaction failed: ${err.message}`)
    } finally {
      setIsCompacting(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition border border-slate-800"
              title="Return to Document Editor"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-400" />
                  Cluster Telemetry & Operations Dashboard
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Observable metrics for CRDT sync, multi-tier persistence, and horizontal scaling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerCompaction}
              disabled={isCompacting}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Zap className={`w-3.5 h-3.5 ${isCompacting ? 'animate-bounce' : ''}`} />
              <span>{isCompacting ? 'Compacting...' : 'Trigger Compaction'}</span>
            </button>
            <button
              onClick={fetchMetrics}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {compactMessage && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{compactMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold">Failed to connect to relay server ({serverUrl})</p>
              <p className="text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {metrics && (
          <>
            {/* Top KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Uptime */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Server Uptime</span>
                  <Server className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-2">
                  {formatUptime(metrics.uptimeSeconds)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Instance: <span className="font-mono text-slate-300">{metrics.relay?.instanceId}</span>
                </div>
              </div>

              {/* Active Rooms */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Active Rooms</span>
                  <Layers className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-bold font-mono text-blue-400 mt-2">
                  {metrics.activeRoomsCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Connections:{' '}
                  <span className="font-mono text-slate-300">
                    {metrics.rooms.reduce((a, b) => a + b.connections, 0)}
                  </span>
                </div>
              </div>

              {/* CRDT Compaction */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Memory Reclaimed</span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-2">
                  {(metrics.compaction.totalBytesSaved / 1024).toFixed(1)} KB
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Total Cycles: <span className="font-mono text-slate-300">{metrics.compaction.totalCompactions}</span>
                </div>
              </div>

              {/* Relay Sync Latency */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>p95 Sync Latency</span>
                  <Radio className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-2">
                  {metrics.relay?.p95LatencyMs || '< 1'} ms
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Mode: <span className="font-mono text-slate-300">{metrics.relay?.mode}</span>
                </div>
              </div>
            </div>

            {/* Detailed Diagnostics Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Panel 1: Memory & Runtime */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span>V8 Memory & Heap Allocation</span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Heap Used / Total</span>
                      <span>
                        {metrics.memory.heapUsedMB} MB / {metrics.memory.heapTotalMB} MB
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (parseFloat(metrics.memory.heapUsedMB) /
                              parseFloat(metrics.memory.heapTotalMB)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Resident Set Size (RSS)</span>
                    <span className="text-white font-bold">{metrics.memory.rssMB} MB</span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Tracked Active Y.Docs</span>
                    <span className="text-white font-bold">{metrics.compaction.activeTrackedDocs}</span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Multi-Tier Storage Cascade */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>Multi-Tier Storage Cascade</span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Redis Hot Cache</span>
                    <span className="text-cyan-300 font-bold">{metrics.storage.redis.type}</span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Cache Hits / Misses</span>
                    <span className="text-slate-200">
                      {metrics.storage.redis.stats.hits} / {metrics.storage.redis.stats.misses}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">PostgreSQL Durable Store</span>
                    <span className="text-slate-200 font-bold">
                      {metrics.storage.isLivePostgres ? 'Live PostgreSQL' : 'Adaptive SQL JSON'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Durable Flushes Executed</span>
                    <span className="text-emerald-400 font-bold">{metrics.storage.flushes}</span>
                  </div>
                </div>
              </div>

              {/* Panel 3: Horizontal Relay Scaling */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>Inter-Relay Pub/Sub Cluster</span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Cluster Architecture</span>
                    <span className="text-emerald-300 font-bold">{metrics.relay?.mode}</span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Messages Published</span>
                    <span className="text-slate-200">{metrics.relay?.messagesPublished || 0}</span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Messages Received</span>
                    <span className="text-slate-200">{metrics.relay?.messagesReceived || 0}</span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400">Echo Prevention Filtered</span>
                    <span className="text-amber-400">{metrics.relay?.messagesEchoFiltered || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Rooms Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Active Collaborative Document Rooms</span>
              </h3>

              {metrics.rooms.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No active rooms currently open.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-slate-400 border-b border-slate-800 pb-2">
                      <tr>
                        <th className="py-2">Room Identifier</th>
                        <th className="py-2">WebSocket Connections</th>
                        <th className="py-2">Awareness Subscribers</th>
                        <th className="py-2 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {metrics.rooms.map((r) => (
                        <tr key={r.room} className="hover:bg-slate-800/40">
                          <td className="py-2.5 font-bold text-white">{r.room}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                              {r.connections} clients
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                              {r.subscribers} cursors
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <Link
                              href={`/?room=${r.room}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              Join Room →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
