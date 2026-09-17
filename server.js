const WebSocket = require('ws')
const http = require('http')
const url = require('url')
const { setupWSConnection, setPersistence, docs } = require('y-websocket/bin/utils')
const storageInterface = require('./src/server/db/storage-interface')
const compactionManager = require('./src/server/compaction')

const host = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '1234', 10)

async function bootstrap() {
  // Initialize multi-tier storage cascade (Redis Hot Cache + PostgreSQL Durable Snapshots)
  await storageInterface.init()

  // Register multi-tier persistence provider with y-websocket
  const cascadePersistence = storageInterface.getYjsPersistence()
  setPersistence(cascadePersistence)
  console.log('[Persistence] Configured Multi-Tier Storage Cascade (Redis Hot Cache -> PostgreSQL)')

  // Register CRDT Compaction Manager
  compactionManager.init(docs, cascadePersistence)

  const server = http.createServer(async (req, res) => {
    // Set standard CORS headers for API calls
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

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
          persistence: 'enabled',
          persistenceMode: 'multi-tier-cascade',
          compaction: 'active',
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

      // Non-destructive restore: apply version state as an update to active Y.Doc
      const Y = require('yjs')
      let activeDoc = docs.get(docId)
      if (activeDoc) {
        Y.applyUpdate(activeDoc, version.binary_state)
      } else {
        await storageInterface.save(docId, version.binary_state, { flushImmediate: true })
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, message: `Restored version ${versionId}`, docId }))
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

    // Track doc in Compaction Manager
    const urlParts = req.url.slice(1).split('?')
    const docName = urlParts[0] || 'default'
    const doc = docs.get(docName)
    if (doc) {
      compactionManager.trackDoc(docName, doc)
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
