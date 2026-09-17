const assert = require('assert')
const WebSocket = require('ws')
const { WebsocketProvider } = require('y-websocket')
const Y = require('yjs')

/**
 * Stage F: Headless 4-Client Chaos Partition & Convergence Test
 * Spawns 4 clients (Alice, Bob, Charlie, Dana) on the same document room.
 * Executes chaotic concurrent operations:
 *   - Random insertions & deletions
 *   - Random disconnections & offline editing
 *   - Random reconnections & delta merges
 * Asserts 100% byte-for-byte CRDT state vector convergence across all 4 clients!
 */
async function runChaosTest() {
  console.log('='.repeat(70))
  console.log('STAGE F: HEADLESS 4-CLIENT CHAOS PARTITION & CONVERGENCE TEST')
  console.log('='.repeat(70))

  const wsUrl = 'ws://localhost:1234'
  const room = `chaos-room-${Date.now()}`
  const clientNames = ['Alice', 'Bob', 'Charlie', 'Dana']
  const clientColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']

  console.log(`[Setup] Initializing 4 headless clients in room: "${room}"...`)

  const clients = clientNames.map((name, i) => {
    const doc = new Y.Doc()
    const provider = new WebsocketProvider(wsUrl, room, doc, { WebSocketPolyfill: WebSocket })
    provider.awareness.setLocalStateField('user', { name, color: clientColors[i] })
    return {
      name,
      doc,
      provider,
      text: doc.getText('chaosText'),
      isConnected: true,
      pendingEdits: 0,
    }
  })

  // Wait for all 4 clients to connect
  await Promise.all(
    clients.map(
      (c) =>
        new Promise((res) => {
          if (c.provider.wsconnected) res()
          else c.provider.on('status', ({ status }) => status === 'connected' && res())
        })
    )
  )
  console.log('✅ All 4 clients connected to relay server.')

  const CHAOS_ROUNDS = 25
  console.log(`\n[Chaos Phase] Executing ${CHAOS_ROUNDS} chaotic rounds of concurrent operations & network drops...`)

  for (let round = 1; round <= CHAOS_ROUNDS; round++) {
    const activeClient = clients[Math.floor(Math.random() * clients.length)]
    const action = Math.random()

    if (action < 0.25) {
      // Action A: Toggle network connection (simulate disconnect/reconnect)
      if (activeClient.isConnected) {
        activeClient.provider.disconnect()
        activeClient.isConnected = false
        // console.log(`  [Round ${round}] ⚡ Disconnected ${activeClient.name} (simulating network partition)`)
      } else {
        activeClient.provider.connect()
        activeClient.isConnected = true
        // console.log(`  [Round ${round}] 🔌 Reconnected ${activeClient.name}`)
      }
    } else if (action < 0.65) {
      // Action B: Random Insertion
      const textToInsert = `[${activeClient.name}-r${round}] `
      const insertPos = Math.min(
        activeClient.text.length,
        Math.floor(Math.random() * (activeClient.text.length + 1))
      )
      activeClient.text.insert(insertPos, textToInsert)
      activeClient.pendingEdits++
    } else {
      // Action C: Random Deletion (if text exists)
      if (activeClient.text.length > 5) {
        const deletePos = Math.floor(Math.random() * (activeClient.text.length - 4))
        const deleteLen = Math.min(4, activeClient.text.length - deletePos)
        activeClient.text.delete(deletePos, deleteLen)
        activeClient.pendingEdits++
      }
    }

    // Small jitter between operations (10-30ms)
    await new Promise((r) => setTimeout(r, 15))
  }

  console.log(`✅ Chaos rounds completed. Healing network partitions and reconnecting all clients...`)

  // Ensure all clients are reconnected
  for (const c of clients) {
    if (!c.isConnected) {
      c.provider.connect()
      c.isConnected = true
    }
  }

  // Wait for all clients to report connected
  await Promise.all(
    clients.map(
      (c) =>
        new Promise((res) => {
          if (c.provider.wsconnected) res()
          else c.provider.on('status', ({ status }) => status === 'connected' && res())
        })
    )
  )

  // Allow CRDT sync state exchange to settle
  console.log(`[Settling] Allowing CRDT state vectors to synchronize across the network...`)
  await new Promise((r) => setTimeout(r, 2000))

  // 4. Assert Final Convergence
  console.log(`\n[Verification] Comparing CRDT state vectors and document contents...`)
  const contents = clients.map((c) => c.text.toString())
  const stateVectors = clients.map((c) => Buffer.from(Y.encodeStateVector(c.doc)).toString('hex'))

  console.log(`  Alice   length: ${contents[0].length} chars | SV hash: ${stateVectors[0].slice(0, 16)}...`)
  console.log(`  Bob     length: ${contents[1].length} chars | SV hash: ${stateVectors[1].slice(0, 16)}...`)
  console.log(`  Charlie length: ${contents[2].length} chars | SV hash: ${stateVectors[2].slice(0, 16)}...`)
  console.log(`  Dana    length: ${contents[3].length} chars | SV hash: ${stateVectors[3].slice(0, 16)}...`)

  // Assert all state vectors are byte-for-byte identical
  for (let i = 1; i < clients.length; i++) {
    assert.strictEqual(
      stateVectors[i],
      stateVectors[0],
      `Client ${clients[i].name} state vector does not match Alice!`
    )
    assert.strictEqual(
      contents[i],
      contents[0],
      `Client ${clients[i].name} document content does not match Alice!`
    )
  }

  console.log(`\n✅ 100% BYTE-FOR-BYTE CRDT CONVERGENCE PROVEN ACROSS ALL 4 CLIENTS!`)

  // Teardown
  clients.forEach((c) => {
    c.provider.destroy()
    c.doc.destroy()
  })

  console.log('='.repeat(70))
  console.log('🎉 ALL STAGE F CHAOS TEST ASSERTIONS PASSED!')
  console.log('='.repeat(70))
  process.exit(0)
}

runChaosTest().catch((err) => {
  console.error('❌ Chaos test failed:', err)
  process.exit(1)
})
