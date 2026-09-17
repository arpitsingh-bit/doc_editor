const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection, setPersistence, docs } = require('y-websocket/bin/utils')
const { persistence, STORAGE_DIR } = require('./src/server/persistence')
const compactionManager = require('./src/server/compaction')

const host = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '1234', 10)

// Register Stage 4 Persistence provider
setPersistence(persistence)
console.log(`[Persistence] Configured binary storage at: ${STORAGE_DIR}`)

// Register Stage A CRDT Compaction Manager
compactionManager.init(docs, persistence)

const server = http.createServer((req, res) => {
  // Health & Server Status Endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'y-websocket-server',
        persistence: 'enabled',
        compaction: 'active',
        storageDir: STORAGE_DIR,
        activeDocs: Array.from(docs.keys()),
        port,
      })
    )
    return
  }

  // Stage A: Compaction Stats API
  if (req.url === '/api/compaction/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(compactionManager.getStats(), null, 2))
    return
  }

  // Stage A: Trigger Manual Compaction API
  if (req.url === '/api/compaction/run' && req.method === 'POST') {
    const results = compactionManager.compactAllActiveDocs('api_trigger')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, count: results.length, reports: results }))
    return
  }

  // Observable Metrics Endpoint
  if (req.url === '/metrics' && req.method === 'GET') {
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
