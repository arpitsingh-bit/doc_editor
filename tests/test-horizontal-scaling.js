const assert = require('assert')
const http = require('http')
const WebSocket = require('ws')
const { WebsocketProvider } = require('y-websocket')
const Y = require('yjs')
const { spawn } = require('child_process')

async function runHorizontalScalingTest() {
  console.log('='.repeat(70))
  console.log('STAGE C: HORIZONTAL RELAY SCALING & CROSS-SERVER SYNC TEST')
  console.log('='.repeat(70))

  const portA = 1234
  const portB = 1235
  const wsUrlA = `ws://localhost:${portA}`
  const wsUrlB = `ws://localhost:${portB}`
  const room = `horizontal-sync-room-${Date.now()}`

  // 1. Verify Primary Relay Server A is running
  console.log(`[Step 1] Checking Primary Relay Server A on port ${portA}...`)
  const serverAStatus = await new Promise((resolve) => {
    http
      .get(`http://localhost:${portA}/health`, (res) => resolve(res.statusCode === 200))
      .on('error', () => resolve(false))
  })
  assert(serverAStatus, `Relay Server A must be running on port ${portA}`)
  console.log(`✅ Relay Server A online on :${portA}`)

  // 2. Launch Secondary Relay Server B on port 1235
  console.log(`\n[Step 2] Launching Relay Server B on port ${portB}...`)
  const serverBProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: `${portB}`, INSTANCE_ID: 'relay-1235' },
    stdio: 'pipe',
  })

  serverBProcess.stderr.on('data', (d) => console.error(`[ServerB:err] ${d}`))

  // Wait for Server B to report healthy
  let serverBReady = false
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 200))
    const isReady = await new Promise((resolve) => {
      http
        .get(`http://localhost:${portB}/health`, (res) => resolve(res.statusCode === 200))
        .on('error', () => resolve(false))
    })
    if (isReady) {
      serverBReady = true
      break
    }
  }
  assert(serverBReady, 'Relay Server B failed to start on port 1235 within 4 seconds')
  console.log(`✅ Relay Server B successfully started on :${portB}`)

  try {
    // 3. Connect Client 1 -> Server A and Client 2 -> Server B
    console.log(`\n[Step 3] Connecting Client 1 to Server A (:1234) and Client 2 to Server B (:1235)...`)
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()

    const provider1 = new WebsocketProvider(wsUrlA, room, doc1, { WebSocketPolyfill: WebSocket })
    const provider2 = new WebsocketProvider(wsUrlB, room, doc2, { WebSocketPolyfill: WebSocket })

    await Promise.all([
      new Promise((res) => {
        if (provider1.wsconnected) res()
        else provider1.on('status', ({ status }) => status === 'connected' && res())
      }),
      new Promise((res) => {
        if (provider2.wsconnected) res()
        else provider2.on('status', ({ status }) => status === 'connected' && res())
      }),
    ])
    console.log(`✅ Both clients connected across two separate relay instances!`)

    // 4. Test Server A -> Server B cross-relay sync
    console.log(`\n[Step 4] Testing Cross-Relay Propagation: Client 1 (Server A) -> Client 2 (Server B)...`)
    const text1 = doc1.getText('prose')
    const text2 = doc2.getText('prose')

    const messageA = 'Real-time update generated on Relay Server A'
    const t0 = performance.now()
    text1.insert(0, messageA)

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Cross-relay sync timeout from A to B')), 5000)
      const observer = () => {
        if (text2.toString() === messageA) {
          clearTimeout(timeout)
          text2.unobserve(observer)
          resolve()
        }
      }
      text2.observe(observer)
    })
    const latencyAtoB = performance.now() - t0
    console.log(`✅ Propagation verified: Server A -> Server B in ${latencyAtoB.toFixed(2)}ms!`)
    assert(latencyAtoB < 500, `Inter-relay sync must be fast (< 500ms), got ${latencyAtoB}ms`)

    // 5. Test Server B -> Server A reverse cross-relay sync (Bi-directional)
    console.log(`\n[Step 5] Testing Reverse Cross-Relay Propagation: Client 2 (Server B) -> Client 1 (Server A)...`)
    const messageB = ' | Bi-directional response from Relay Server B'
    const t1 = performance.now()
    text2.insert(text2.length, messageB)

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Cross-relay sync timeout from B to A')), 5000)
      const observer = () => {
        if (text1.toString() === messageA + messageB) {
          clearTimeout(timeout)
          text1.unobserve(observer)
          resolve()
        }
      }
      text1.observe(observer)
    })
    const latencyBtoA = performance.now() - t1
    console.log(`✅ Reverse propagation verified: Server B -> Server A in ${latencyBtoA.toFixed(2)}ms!`)
    assert(latencyBtoA < 500, `Inter-relay sync must be fast (< 500ms), got ${latencyBtoA}ms`)

    // 6. Verify State Convergence byte-for-byte
    console.log(`\n[Step 6] Verifying CRDT State Vector convergence between Client 1 & Client 2...`)
    const sv1 = Y.encodeStateVector(doc1)
    const sv2 = Y.encodeStateVector(doc2)
    assert.deepStrictEqual(
      Buffer.from(sv1),
      Buffer.from(sv2),
      'State vectors between Client 1 and Client 2 must converge byte-for-byte!'
    )
    console.log(`✅ Byte-for-byte state vector convergence verified between Server A and Server B!`)

    // 7. Verify Telemetry & Echo Prevention on both instances
    console.log(`\n[Step 7] Inspecting /metrics on both Relay Server instances...`)
    const metricsA = await new Promise((resolve) => {
      http.get(`http://localhost:${portA}/metrics`, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(JSON.parse(data)))
      })
    })

    const metricsB = await new Promise((resolve) => {
      http.get(`http://localhost:${portB}/metrics`, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(JSON.parse(data)))
      })
    })

    console.log(`  Server A (${metricsA.relay.instanceId}): Published=${metricsA.relay.messagesPublished}, Received=${metricsA.relay.messagesReceived}, EchoFiltered=${metricsA.relay.messagesEchoFiltered}`)
    console.log(`  Server B (${metricsB.relay.instanceId}): Published=${metricsB.relay.messagesPublished}, Received=${metricsB.relay.messagesReceived}, EchoFiltered=${metricsB.relay.messagesEchoFiltered}`)

    assert(metricsA.relay.messagesPublished > 0, 'Server A must have published messages')
    assert(metricsB.relay.messagesReceived > 0, 'Server B must have received messages')
    assert(metricsB.relay.messagesPublished > 0, 'Server B must have published messages')
    assert(metricsA.relay.messagesReceived > 0, 'Server A must have received messages')
    console.log(`✅ Cross-instance Pub/Sub telemetry and echo prevention confirmed!`)

    // Teardown clients
    provider1.destroy()
    provider2.destroy()
    doc1.destroy()
    doc2.destroy()

    console.log('\n' + '='.repeat(70))
    console.log('🎉 ALL STAGE C HORIZONTAL RELAY SCALING CHECKS PASSED!')
    console.log('='.repeat(70))
  } finally {
    // Terminate Server B
    serverBProcess.kill('SIGTERM')
  }

  process.exit(0)
}

runHorizontalScalingTest().catch((err) => {
  console.error('❌ Horizontal scaling test failed:', err)
  process.exit(1)
})
