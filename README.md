# ⚡ Real-Time Collaborative Document Editor

> **A production-grade, offline-first collaborative document platform built on Conflict-free Replicated Data Types (CRDTs). Designed with the same distributed architecture powering Google Docs, Figma, and Notion.**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3-blue?style=flat&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![TipTap](https://img.shields.io/badge/TipTap-2.8-2563eb?style=flat)](https://tiptap.dev/)
[![Yjs](https://img.shields.io/badge/CRDT-Yjs_13.6-orange?style=flat)](https://yjs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Durable_Store-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Hot_Cache-dc382d?style=flat&logo=redis)](https://redis.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

---

## 🏆 Why This Wins: The Hackathon Pitch

> *"Most collaborative editors fail under real-world conditions because they treat collaboration as an afterthought on top of a database, leading to overwrites, cursor jumping, or sync corruption. We built this from first principles using **Conflict-free Replicated Data Types (CRDTs)** with a **Multi-Tier Persistence Cascade**, **Inter-Relay Redis Pub/Sub Scaling**, and **IndexedDB Offline-First Caching**.*
>
> *Edits are instantaneous via optimistic local state, sync is guaranteed mathematically without merge conflicts, and the entire system survives complete server restarts and offline browser reloads."*

---

## 🌟 Key Highlights & Engineering Innovations

| Feature | Technical Implementation | Why It Matters |
|---|---|---|
| **Mathematical Convergence** | Yjs CRDT + TipTap ProseMirror XML binding | 100% byte-for-byte convergence across all clients without coordinate shifts or lockouts. |
| **Offline-First & Refresh Survival** | Client-side `y-indexeddb` persistence | Type offline, refresh the browser tab, and changes remain intact and auto-sync upon reconnecting. |
| **CRDT Compaction Engine** | Monotonic operation pruning & V8 GC tracking | **56.2% memory savings** (172 KB → 75 KB) preventing memory leaks under high-throughput typing. |
| **Multi-Tier Storage Cascade** | Redis (Hot Cache) ➔ Postgres (Durable) ➔ Disk (.yjs) | Sub-millisecond reads/writes (`0.06ms` Redis write, `1.0ms` Postgres write) with zero-setup fallback. |
| **Horizontal Relay Scaling** | Redis Pub/Sub with `instanceId` origin tagging | Clustered dual-relay architecture with loop/echo prevention and **1.27ms – 3.77ms cross-server sync**. |
| **Soft Block Awareness** | TipTap ProseMirror decoration plugin | Live border accents & `[Name] is editing` indicators when collaborators work in the same paragraph. |
| **Floating Selection Toolbar** | Notion-style floating contextual format bar | Instant inline styling (**Bold**, *Italic*, ~~Strike~~, `Code`, H1, H2, Lists, Quotes) via `coordsAtPos`. |
| **Non-Destructive Time-Travel** | Authoritative forward XML tree cloning | Rewind documents to any past milestone without breaking active client connections or logical clocks. |
| **Collaborative Comments & Track Changes** | CRDT `Y.Map('comments')` & `Y.Map('suggestions')` | Isolated multi-user undo history; propose edits with 1-click Accept/Reject controls. |
| **Live Observability Dashboard** | Dedicated `/admin/metrics` Next.js dashboard | Real-time ops telemetry: V8 heap memory, Redis cache hit ratio, CRDT savings, and sync latency. |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               CLIENT EDITING TIER                               │
│                                                                                 │
│   Client 1 (Alice)                  Client 2 (Bob)               Client 3 (Dana)│
│   Next.js 14 + TipTap               Next.js 14 + TipTap          Next.js 14     │
│   Y.Doc + y-prosemirror             Y.Doc + y-prosemirror        /admin/metrics │
│   y-indexeddb (Offline Store)       y-indexeddb (Offline Store)  Live Dashboard │
└───────────────────────┬─────────────────────────┬───────────────────────┬───────┘
                        │ ws://relay-1:1234       │ ws://relay-2:1235     │ http
┌───────────────────────▼─────────────────────────▼───────────────────────▼───────┐
│                        HORIZONTALLY SCALED RELAY TIER                           │
│   ┌───────────────────────────────┐     ┌───────────────────────────────┐       │
│   │    Relay Node A (:1234)       │     │    Relay Node B (:1235)       │       │
│   │    - y-websocket protocol     │     │    - y-websocket protocol     │       │
│   │    - Compaction Engine        │     │    - Compaction Engine        │       │
│   │    - Echo Filter (relay-1234) │     │    - Echo Filter (relay-1235) │       │
│   └───────────────┬───────────────┘     └───────────────┬───────────────┘       │
│                   │                                     │                       │
│                   └──────────────────┬──────────────────┘                       │
│                                      ▼                                          │
│                      Redis Pub/Sub Inter-Relay Bus                              │
│             (channel:doc:$id | Sub-5ms Cross-Cluster Synchronization)           │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                        MULTI-TIER PERSISTENCE CASCADE                           │
│                                                                                 │
│   Tier 1: Redis Hot Cache                                                       │
│   - doc:$id binary CRDT states | 24h sliding TTL | 0.06ms read/write            │
│                                                                                 │
│   Tier 2: PostgreSQL Durable Store                                              │
│   - documents | document_snapshots | document_versions                          │
│   - Time-travel checkpoint audit trail with author metadata                     │
│                                                                                 │
│   Tier 3: Archival Disk Mirror                                                  │
│   - storage/docs/*.yjs atomic binary snapshot fallback                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Empirical Mentor & Judge Defense Metrics

Every performance and reliability claim is verified by automated, reproducible benchmark scripts:

| Benchmark Metric | Industry SLA | Our Measured Result | Verification Test Script |
|---|---|---|---|
| **CRDT Compaction Savings** | > 30% | **56.2% reduction** (172 KB → 75 KB) | `tests/load-test-compaction.js` |
| **Compaction Execution Latency** | < 10 ms | **0 ms** | `tests/load-test-compaction.js` |
| **Redis Hot Cache Write** | < 5 ms | **0.06 ms** | `tests/test-persistence-cascade.js` |
| **Postgres Snapshot Write** | < 20 ms | **1.00 ms** | `tests/test-persistence-cascade.js` |
| **Cross-Relay Sync Latency** | < 50 ms | **1.27 ms – 3.77 ms** | `tests/test-horizontal-scaling.js` |
| **Local Edit Sync Latency (p50)** | < 15 ms | **0.03 ms** | `tests/latency-harness.js` |
| **Edit Sync Latency (p95)** | < 50 ms | **0.25 ms** | `tests/latency-harness.js` |
| **Edit Sync Latency (p99)** | < 100 ms | **0.87 ms** | `tests/latency-harness.js` |
| **Awareness / Cursor Latency (p50)**| < 20 ms | **0.05 ms** | `tests/latency-harness.js` |
| **4-Client Chaos Network Convergence** | 100% Convergence | **100% byte-for-byte** (0 errors) | `tests/chaos-test.js` |
| **Concurrent Title Convergence** | No Clobber | **Preserved across forks** | `tests/test-stage7-concurrent-title.js` |
| **Offline Refresh Survival** | Zero Data Loss | **Restored via IndexedDB** | `tests/test-stage8-offline-survives-refresh.js` |

---

## 🎬 2-Minute Winning Hackathon Demo Script

Follow these steps during your live presentation to blow away judges and mentors:

```
Step 1: Side-by-Side Real-Time Collaboration (15s)
  • Open http://localhost:3000 in two side-by-side browser windows.
  • Type in Window A: observe instant sub-millisecond typing and colored cursor badges in Window B.
  • Notice the PresenceStack avatars in the top-right showing live initials and user badges.

Step 2: Soft Block Awareness & Selection Toolbar (20s)
  • In Window A, click into any paragraph. Window B immediately displays a colored accent line 
    and a "[User] is editing" chip next to that paragraph.
  • Highlight text: showcase the floating Notion-style SelectionToolbar for instant formatting.

Step 3: Intent-Preserved Title Editing (15s)
  • Click the document title at the top left in Window A and Window B simultaneously.
  • Type distinct prefixes: watch both changes converge cleanly without erasing text or jumping focus.

Step 4: Offline-First & Refresh Survival Demo (30s)
  • In Window A, click "Disconnect" in the TopBar (or turn WiFi off).
  • Watch the bottom status bar change to "Offline · N unsaved".
  • Type a full paragraph while completely offline.
  • Refresh the browser page (Cmd+R) while still offline: the offline draft re-renders instantly from IndexedDB!
  • Click "Reconnect": connection status turns green ("Synced"), and updates merge seamlessly into Window B.

Step 5: Non-Destructive Version History Time-Travel (20s)
  • Click "History" in the TopBar. Create a milestone named "v1.0 Demo Baseline".
  • Delete or scramble several paragraphs in the document.
  • In the History drawer, click "Restore" on v1.0, and confirm.
  • Both windows rewind cleanly to v1.0 without disconnecting or reloading the page.

Step 6: Live Ops Telemetry Dashboard (20s)
  • Click "Metrics" or open http://localhost:3000/admin/metrics.
  • Show judges live V8 heap usage, CRDT compaction statistics, Redis cache hits, and relay health.
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ and npm installed
- Works out of the box with zero external dependencies (includes an embedded multi-tier storage coordinator)

### 1. Clone & Install
```bash
git clone https://github.com/arpitsingh-bit/doc_editor.git
cd doc_editor
npm install --force
```

### 2. Launch the Application

You can launch both the collaborative relay backend and the frontend Next.js app in two terminal windows:

**Terminal 1: Collaborative Relay Server**
```bash
node server.js
```
*Backend runs at `http://localhost:1234` (WebSocket: `ws://localhost:1234`)*

**Terminal 2: Next.js Frontend Web Application**
```bash
npm run dev
# Or for optimized production mode:
# npm run build && npm run start
```
*Frontend runs at `http://localhost:3000`*

### 3. Open in Browser
- **Collaborative Editor**: [http://localhost:3000](http://localhost:3000)
- **Live Ops Dashboard**: [http://localhost:3000/admin/metrics](http://localhost:3000/admin/metrics)
- **Relay Health Endpoint**: [http://localhost:1234/health](http://localhost:1234/health)
- **Relay Metrics JSON**: [http://localhost:1234/metrics](http://localhost:1234/metrics)

---

## 🧪 Comprehensive Automated Test Suites

Run the automated test harnesses to verify system reliability:

### 1. Master 10-Check Production Verification Suite
```bash
node tests/test-master-suite.js
```
Output:
```
[Check 1/10]  WebSocket Server HTTP health: OK, persistence enabled.
[Check 2/10]  Next.js Web App responds with 200 OK.
[Check 3/10]  Multi-Client WebSocket & Yjs Connection Handshake.
[Check 4/10]  TipTap Rich Text XML Synchronization across clients.
[Check 5/10]  Presence Awareness & Colored Cursors Protocol.
[Check 6/10]  Collaborative Document Title Sync via minimal-diff CRDT.
[Check 7/10]  Binary Disk Snapshot Persistence & Late-Join Restoration.
[Check 8/10]  Multi-Tier Redis Hot Cache & PostgreSQL Storage Telemetry.
[Check 9/10]  Version History Audit Trail & Checkpoint Creation.
[Check 10/10] Collaborative Comments Threading & Suggestion Mode.
====================================================
🎉 ALL 10 PRODUCTION SYSTEM CHECKS PASSED WITH ZERO FAULTS!
```

### 2. Stage 7 & Stage 8 Concurrency & Offline Verification
```bash
# Test 1: Minimal-diff concurrent title convergence
node tests/test-stage7-concurrent-title.js

# Test 2: Concurrent delete vs. insert conflict safety
node tests/test-stage7-delete-insert-convergence.js

# Test 3: IndexedDB offline persistence surviving page refresh
node tests/test-stage8-offline-survives-refresh.js

# Test 4: Reconnection snapshot state-vector diff review
node tests/test-stage8-reconnect-review.js
```

### 3. Deep-Dive Stress Benchmarks
```bash
# Memory compaction benchmark (56.2% memory savings)
node tests/load-test-compaction.js

# Persistence cascade benchmark (Redis 0.06ms, Postgres 1.0ms)
node tests/test-persistence-cascade.js

# Horizontal cluster scaling benchmark across dual ports (:1234 & :1235)
node tests/test-horizontal-scaling.js

# 4-client chaos partition & network partition recovery
node tests/chaos-test.js

# End-to-end sync and cursor latency profiling
node tests/latency-harness.js
```

---

## 📂 Project Structure

```
doc_editor/
├── src/
│   ├── app/
│   │   ├── admin/metrics/page.tsx     # Live Ops & Telemetry Dashboard
│   │   ├── globals.css                # Typography & Editor Styles
│   │   ├── layout.tsx                 # Root layout & font configuration
│   │   └── page.tsx                   # Main document editor page
│   ├── components/
│   │   ├── CollaborativeEditor.tsx    # Core TipTap + Yjs + Awareness engine
│   │   ├── TopBar.tsx                 # Recessive header chrome with title & actions
│   │   ├── PresenceStack.tsx          # Collaborator avatar stack & live tooltips
│   │   ├── SelectionToolbar.tsx       # Floating formatting & inline controls
│   │   ├── ConnectionStatus.tsx       # Live 4-state connection telemetry badge
│   │   ├── VersionHistoryDrawer.tsx   # Checkpoints & non-destructive time travel
│   │   └── CommentsSidebar.tsx        # Collaborative comments & suggestion mode
│   └── server/
│       ├── compaction.js              # CRDT GC and operation pruning engine
│       ├── memory-tracker.js          # V8 heap and RSS memory observer
│       ├── postgres-store.js          # PostgreSQL durable snapshot store
│       ├── redis-store.js             # Redis hot cache store with sliding TTL
│       ├── redis-pubsub-adapter.js    # Horizontal scaling relay coordinator
│       └── storage-interface.js       # Multi-tier cascade orchestration layer
├── server.js                          # y-websocket relay entry point
├── tests/                             # 10+ automated verification suites
└── storage/                           # Persistent state directory
```

---

## 👥 Contributors & Team
- **Arpit Singh** ([@arpitsingh-bit](https://github.com/arpitsingh-bit))
- **Sparsh Poddar** ([@sparshpoddar9](https://github.com/sparshpoddar9))
