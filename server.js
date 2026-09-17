const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection, setPersistence, docs } = require('y-websocket/bin/utils')
const { persistence, STORAGE_DIR } = require('./src/server/persistence')

const host = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '1234', 10)

// Register Stage 4 Persistence provider
setPersistence(persistence)
console.log(`[Persistence] Configured binary storage at: ${STORAGE_DIR}`)

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'y-websocket-server',
        persistence: 'enabled',
        storageDir: STORAGE_DIR,
        activeDocs: Array.from(docs.keys()),
        port,
      })
    )
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
})

const wss = new WebSocket.Server({ noServer: true })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port, host, () => {
  console.log(`[y-websocket] Server running at http://${host}:${port}`)
})
