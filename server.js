const WebSocket = require('ws')
const http = require('http')
const url = require('url')
const { setupWSConnection, setPersistence, docs } = require('y-websocket/bin/utils')
const storageInterface = require('./src/server/db/storage-interface')
const compactionManager = require('./src/server/compaction')
const RedisPubSubAdapter = require('./src/server/redis-pubsub-adapter')

const host = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '1234', 10)
const instanceId = process.env.INSTANCE_ID || `relay-${port}`
const pubSubAdapter = new RedisPubSubAdapter({ instanceId, port })

async function bootstrap() {
  // Initialize multi-tier storage cascade (Redis Hot Cache + PostgreSQL Durable Snapshots)
  await storageInterface.init()

  // Initialize horizontal scaling Pub/Sub adapter
  await pubSubAdapter.init(docs)

  // Register multi-tier persistence provider with y-websocket
  const cascadePersistence = storageInterface.getYjsPersistence()
  setPersistence(cascadePersistence)
  console.log('[Persistence] Configured Multi-Tier Storage Cascade (Redis Hot Cache -> PostgreSQL)')

  // Register CRDT Compaction Manager
  compactionManager.init(docs, cascadePersistence)

  const server = http.createServer(async (req, res) => {
    // Set standard CORS & Cache headers for API calls
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const parsedUrl = url.parse(req.url, true)
    const pathname = parsedUrl.pathname

    // Health & Server Status Endpoint
    if (pathname === '/health' || pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'y-websocket-server',
          instanceId: pubSubAdapter.instanceId,
          persistence: 'enabled',
          persistenceMode: 'multi-tier-cascade',
          compaction: 'active',
          cluster: pubSubAdapter.getMetrics(),
          storage: storageInterface.getMetrics(),
          activeDocs: Array.from(docs.keys()),
          port,
        })
      )
      return
    }

    // Stage A: Compaction Stats API
    if (pathname === '/api/compaction/stats' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(compactionManager.getStats(), null, 2))
      return
    }

    // Stage A: Trigger Manual Compaction API
    if (pathname === '/api/compaction/run' && req.method === 'POST') {
      const results = compactionManager.compactAllActiveDocs('api_trigger')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, count: results.length, reports: results }))
      return
    }

    // Stage B: Flush Active Document to PostgreSQL
    if (pathname.startsWith('/api/documents/') && pathname.endsWith('/flush') && req.method === 'POST') {
      const docId = pathname.replace('/api/documents/', '').replace('/flush', '')
      const snapshotId = await storageInterface.flushToDb(docId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, docId, snapshotId }))
      return
    }

    // Stage D: Version History APIs
    // GET /api/documents/:id/versions -> list versions
    const versionsMatch = pathname.match(/^\/api\/documents\/([^/]+)\/versions$/)
    if (versionsMatch && req.method === 'GET') {
      const docId = versionsMatch[1]
      const versions = await storageInterface.listVersions(docId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ docId, versions }))
      return
    }

    // POST /api/documents/:id/versions -> create named checkpoint version
    if (versionsMatch && req.method === 'POST') {
      const docId = versionsMatch[1]
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          const versionName = payload.name || `Snapshot ${new Date().toLocaleTimeString()}`
          const authorName = payload.authorName || 'Anonymous'
          const authorColor = payload.authorColor || '#3b82f6'

          // Get active state from doc if open, or storage
          let binaryState = null
          const activeDoc = docs.get(docId)
          if (activeDoc) {
            const Y = require('yjs')
            binaryState = Y.encodeStateAsUpdate(activeDoc)
          } else {
            binaryState = await storageInterface.load(docId)
          }

          if (!binaryState) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Document has no state to checkpoint' }))
            return
          }

          const versionId = await storageInterface.saveVersion(
            docId,
            versionName,
            binaryState,
            authorName,
            authorColor
          )
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, versionId, versionName, docId }))
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // POST /api/documents/:id/restore/:versionId -> restore version non-destructively
    const restoreMatch = pathname.match(/^\/api\/documents\/([^/]+)\/restore\/([^/]+)$/)
    if (restoreMatch && req.method === 'POST') {
      const docId = restoreMatch[1]
      const versionId = restoreMatch[2]
      const version = await storageInterface.getVersion(versionId)

      if (!version) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Version not found' }))
        return
      }

      // Restores are additive: a collaborator's confirmation appends a historical
      // state after the live document rather than blanking the XML fragment. This
      // preserves edits received while the restore request was in flight.
      const Y = require('yjs')

      // Recursive helper to clone Yjs XML tree while keeping nodes attached
      function copyXmlChildren(srcParent, destParent) {
        for (let i = 0; i < srcParent.length; i++) {
          const child = srcParent.get(i)
          if (child instanceof Y.XmlText) {
            const newText = new Y.XmlText()
            destParent.push([newText])
            const delta = child.toDelta()
            if (delta && delta.length > 0) {
              newText.applyDelta(delta)
            }
          } else if (child instanceof Y.XmlElement) {
            const newEl = new Y.XmlElement(child.nodeName)
            destParent.push([newEl])
            const attrs = child.getAttributes()
            for (const [k, v] of Object.entries(attrs)) {
              newEl.setAttribute(k, v)
            }
            copyXmlChildren(child, newEl)
          }
        }
      }

      let activeDoc = docs.get(docId)
      if (activeDoc) {
        const histDoc = new Y.Doc()
        Y.applyUpdate(histDoc, version.binary_state)

        activeDoc.transact(() => {
          // Keep the live title intact and record which checkpoint was restored.
          // Title clobbering is the same failure mode as fragment replacement.
          const histTitle = histDoc.getText('title')
          activeDoc.getMap('restoreProposals').set(`restore-${versionId}-${Date.now()}`, {
            versionId, restoredAt: Date.now(), title: histTitle ? histTitle.toString() : '', confirmed: true,
          })

          // 2. Restore ProseMirror XML fragment
          const curFrag = activeDoc.getXmlFragment('default')
          const histFrag = histDoc.getXmlFragment('default')
          if (curFrag && histFrag && histFrag.length) {
            // A separator makes the inserted state explicit to readers and leaves
            // all concurrent live nodes addressable by Yjs.
            const separator = new Y.XmlElement('paragraph')
            const separatorText = new Y.XmlText()
            separatorText.insert(0, `Restored checkpoint: ${histTitle ? histTitle.toString() : versionId}`)
            separator.push([separatorText])
            curFrag.push([separator])
            copyXmlChildren(histFrag, curFrag)
          }

          // 3. Restore plain text prose if used
          const curProse = activeDoc.getText('prose')
          const histProse = histDoc.getText('prose')
          if (curProse && histProse && histProse.toString()) {
            curProse.insert(curProse.length, `\n\n[Restored checkpoint ${versionId}]\n${histProse.toString()}`)
          }
        }, { origin: 'restore', versionId })

        // Save restored state to persistent storage
        await storageInterface.save(docId, Y.encodeStateAsUpdate(activeDoc), { flushImmediate: true })
      } else {
        await storageInterface.save(docId, version.binary_state, { flushImmediate: true })
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, message: `Inserted restored checkpoint ${versionId} without overwriting live edits`, docId }))
      return
    }

    // Observable Metrics Endpoint
    if (pathname === '/metrics' && req.method === 'GET') {
      const memory = process.memoryUsage()
      const activeRooms = Array.from(docs.keys()).map((room) => {
        const doc = docs.get(room)
        return {
          room,
          connections: doc ? doc.conns.size : 0,
          subscribers: doc ? doc.awareness.getStates().size : 0,
        }
      })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            activeRoomsCount: docs.size,
            rooms: activeRooms,
            relay: pubSubAdapter.getMetrics(),
            compaction: compactionManager.getStats(),
            storage: storageInterface.getMetrics(),
            memory: {
              heapUsedMB: (memory.heapUsed / 1024 / 1024).toFixed(2),
              heapTotalMB: (memory.heapTotal / 1024 / 1024).toFixed(2),
              rssMB: (memory.rss / 1024 / 1024).toFixed(2),
            },
          },
          null,
          2
        )
      )
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  })

  const wss = new WebSocket.Server({ noServer: true })

  wss.on('connection', (ws, req) => {
    setupWSConnection(ws, req)

    // Track doc in Compaction Manager & Pub/Sub Relay Adapter
    const urlParts = req.url.slice(1).split('?')
    const docName = urlParts[0] || 'default'
    const doc = docs.get(docName)
    if (doc) {
      compactionManager.trackDoc(docName, doc)
      pubSubAdapter.bindDoc(docName, doc)
    }
  })

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  })

  server.listen(port, host, () => {
    console.log(`[y-websocket] Server running at http://${host}:${port}`)
  })
}

bootstrap().catch((err) => {
  console.error('[y-websocket] Fatal bootstrap error:', err)
  process.exit(1)
})
