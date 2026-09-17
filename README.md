# Real-Time Collaborative Document Editor

> **A Google-Docs-style rich text editor supporting simultaneous multi-user editing without data loss or race conditions, powered by Conflict-free Replicated Data Types (CRDTs).**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3-blue?style=flat&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![TipTap](https://img.shields.io/badge/TipTap-2.8-2563eb?style=flat)](https://tiptap.dev/)
[![Yjs](https://img.shields.io/badge/CRDT-Yjs-orange?style=flat)](https://yjs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)

---

## 📌 Overview

Collaborative editing over distributed networks is traditionally vulnerable to race conditions, out-of-order network packets, and merge collisions. When two users type simultaneously, naive systems either freeze user input (locking) or rely on fragile coordinate recalculations (Operational Transformation).

This project solves multi-user concurrent editing using **Conflict-free Replicated Data Types (CRDTs)**. Every character and formatted node has an immutable logical timestamp and client ID, guaranteeing that all documents converge to the exact same state across all clients—**conflict-free by construction, not by luck.**

---

## 🏗️ System Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Browser A     │       │   Browser B     │       │   Browser C     │
│   (Next.js)     │       │   (Next.js)     │       │   (Next.js)     │
│  TipTap + Yjs   │       │  TipTap + Yjs   │       │  TipTap + Yjs   │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         └─────────────┬───────────┴───────────┬─────────────┘
                       │ WebSocket (ws://localhost:1234)
            ┌──────────▼───────────────────────▼──────────┐
            │             y-websocket server              │
            │    (relays binary Yjs updates & awareness)  │
            └──────────────────────┬──────────────────────┘
                                   │ periodic snapshot / persistence
            ┌──────────────────────▼──────────────────────┐
            │           Persistence Layer                 │
            │        (Atomic Binary File Store)           │
            └─────────────────────────────────────────────┘
```

### Component Roles
* **Frontend (Next.js 14 + React)**: Google Docs-inspired paper canvas, document title input, active collaborators sidebar, and live metrics.
* **Editing Surface (TipTap + ProseMirror)**: Renders the rich-text surface (headings, lists, blockquotes, bold/italic, code).
* **CRDT Engine (Yjs)**: Maintains the shared mathematical document state (`Y.Doc` holding `Y.XmlFragment`) and resolves concurrent operations deterministically.
* **Transport Layer (`y-websocket`)**: Duplex WebSocket relay broadcasting compact binary diffs between peers with minimal overhead.
* **Awareness Protocol**: Broadcasts ephemeral state—cursor carets, selection highlights, and user name/color flags—independently from document content.
* **Persistence Layer**: Server-side binary snapshotting via `Y.encodeStateAsUpdate`, guaranteeing full recovery across server restarts and page refreshes.

---

## ⚡ Key Engineering Innovations & Pitfalls Avoided

1. **Conflict-Free Convergence**: Replaces fragile Operational Transformation (OT) with decentralized CRDT mathematics. Edits can arrive in any order and still merge identically.
2. **Sub-millisecond Optimistic UI**: Keystrokes render locally in 0ms without waiting for a server round-trip.
3. **Multi-User Safe Undo/Redo**: Disabled TipTap's native history extension (`history: false`) and routed through `y-prosemirror`'s `UndoManager`. Pressing `Cmd+Z` only undoes operations originating from the local user, leaving teammates' text intact.
4. **Offline Resilience & Delta Sync**: Users can keep typing through network drops. Upon reconnect, clients exchange compact state vectors and sync only missing deltas.
5. **Anti-Race Persistence**: The server merges stored binary snapshots into the `Y.Doc` *before* upgrading client WebSocket connections, preventing live edits from ever being overwritten.
6. **Host Mismatch Prevention**: Dynamically resolves WebSocket URLs matching `window.location.hostname`, preventing `localhost` vs `127.0.0.1` origin blocking.

---

## 🛠️ Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | **Next.js 14 (App Router)** | Fast SSR scaffolding, optimized bundles, modular routing |
| **Language** | **TypeScript 5.6** | End-to-end type safety across UI, CRDT events, and state |
| **Rich Text UI** | **TipTap 2.8 (ProseMirror)** | Headless, accessible editor with official Yjs bindings |
| **CRDT Engine** | **Yjs 13.6** | High-performance open-source CRDT engine with binary encoding |
| **Relay Protocol** | **y-websocket 2.0** | Duplex WebSocket streaming of binary diffs |
| **Styling** | **Tailwind CSS 3.4** | Clean, responsive Google Docs aesthetic and custom cursor CSS |
| **Storage** | **Atomic Binary Store** | Crash-resilient file snapshots with zero database overhead |

---

## 🚀 Getting Started Locally

### Prerequisites
* **Node.js**: v18.0 or higher
* **npm**: v9.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/arpitsingh-bit/doc_editor.git
cd doc_editor
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Services

Open two terminal tabs:

**Tab 1: WebSocket Relay & Persistence Server**
```bash
node server.js
```
*(Runs at `http://localhost:1234` / `ws://localhost:1234`)*

**Tab 2: Next.js Web Application**
```bash
npm run start
# Or for development mode:
npm run dev
```
*(Runs at `http://localhost:3000`)*

---

## 🧪 Automated Master Test Suite

The project includes an end-to-end automated verification test suite checking all layers:

```bash
node tests/test-master-suite.js
```

### Test Results:
* [x] **Check 1/7**: WebSocket Server Health Endpoint (`/health` → 200 OK)
* [x] **Check 2/7**: Next.js Production Web App (HTTP 200 OK)
* [x] **Check 3/7**: Multi-Client WebSocket & Yjs Connection Handshake
* [x] **Check 4/7**: TipTap Rich Text XML Node Synchronization
* [x] **Check 5/7**: Presence Awareness & Colored Cursors Protocol
* [x] **Check 6/7**: Collaborative Document Title Synchronization
* [x] **Check 7/7**: Binary Disk Snapshotting & Late-Join State Restoration

---

## 🎬 60-Second Judge Demo Script

1. **Side-by-Side Windows**: Open [http://localhost:3000](http://localhost:3000) in two browser windows side by side.
2. **Instant Sync**: Type headings and formatted text in Window A — watch it appear in Window B in real time with zero lag.
3. **Live Colored Cursors**: Highlight text in Window A — Window B displays the colored cursor flag and name tag moving live.
4. **Persistence**: Refresh Window B (`Cmd+R`) — full text, formatting, and title are restored immediately from disk storage.
5. **Resilience & Delta Sync**:
   * In Window A, click **"Simulate Disconnect"** (turns amber/offline).
   * Type in Window A while offline, and make edits in Window B online.
   * In Window A, click **"Reconnect Wifi"** — watch both windows exchange state vectors and delta-sync automatically with zero data loss!

---

## 📜 Strict Layered Git History

Every stage was built and committed sequentially following strict layer-by-layer verification:

```
* 912a7cb - Add nutlope/hallmark design skill to project
* f798a55 - Polish: dynamic hostname resolution, room keys, and master test suite
* 6f06ed7 - Stage 6: polish with collaborative doc title, user list sidebar, and styled UI
* 757a57a - Stage 5: network reconnect handling and state-vector delta sync
* 8297793 - Stage 4: document persistence layer saving and loading Y.Doc binary snapshots
* 547ce17 - Stage 3: presence awareness with live colored cursors and collaborator avatars
* f5b2002 - Stage 2: rich editor with TipTap bound to Y.Doc and disabled history
* cb15cd8 - Stage 1: plain sync with Y.Doc and y-websocket bound to textarea
* eb1604e - Stage 0: scaffold Next.js app
```

---

## 💡 The Pitch

> *"Built on the same CRDT approach real products like Google Docs and Figma use, so it's conflict-free by construction, not by luck."*
