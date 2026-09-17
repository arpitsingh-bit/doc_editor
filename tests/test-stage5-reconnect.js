const Y = require('yjs')
const { WebsocketProvider } = require('y-websocket')
const WebSocket = require('ws')

async function testStage5Reconnect() {
  console.log('--- Starting Stage 5 Reconnect & Delta Sync Verification ---')
  const room = 'reconnect-test-' + Date.now()
  const serverUrl = 'ws://localhost:1234'

  // Client A
  const docA = new Y.Doc()
  const providerA = new WebsocketProvider(serverUrl, room, docA, { WebSocketPolyfill: WebSocket })
  const textA = docA.getText('sync-channel')

  // Client B
  const docB = new Y.Doc()
  const providerB = new WebsocketProvider(serverUrl, room, docB, { WebSocketPolyfill: WebSocket })
  const textB = docB.getText('sync-channel')

  // Wait for initial connection
  await Promise.all([
    new Promise((res) => {
      if (providerA.wsconnected) res()
      else providerA.on('status', ({ status }) => { if (status === 'connected') res() })
    }),
    new Promise((res) => {
      if (providerB.wsconnected) res()
      else providerB.on('status', ({ status }) => { if (status === 'connected') res() })
    })
  ])
  console.log('✅ Both clients connected and ready.')

  // Step 1: Initial shared text
  docA.transact(() => {
    textA.insert(0, '[Initial shared sentence] ')
  })

  await new Promise((resolve) => {
    const check = () => {
      if (textB.toString().includes('[Initial shared sentence]')) {
        textB.unobserve(check)
        resolve()
      }
    }
    textB.observe(check)
    check()
  })
  console.log('✅ Baseline sync established.')

  // Step 2: Simulate network drop on Client A
  console.log('Simulating network drop on Client A (disconnecting)...')
  providerA.disconnect()
  console.log('Client A is now OFFLINE.')

  // Step 3: Client B types online
  console.log('Client B makes an edit while Client A is offline...')
  docB.transact(() => {
    textB.insert(textB.length, '[Edit made by B during outage] ')
  })

  // Step 4: Client A makes edits locally while offline
  console.log('Client A makes an edit locally while offline...')
  docA.transact(() => {
    textA.insert(textA.length, '[Edit made by A while offline] ')
  })

  console.log('Client A offline text:', JSON.stringify(textA.toString()))
  console.log('Client B online text: ', JSON.stringify(textB.toString()))

  // Step 5: Reconnect Client A
  console.log('Reconnecting Client A (triggering state vector delta sync)...')
  providerA.connect()

  // Step 6: Wait for delta sync to complete on both sides
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Delta sync timed out on reconnect')), 5000)
    const check = () => {
      const a = textA.toString()
      const b = textB.toString()
      if (a === b && a.includes('[Edit made by B during outage]') && a.includes('[Edit made by A while offline]')) {
        clearTimeout(timeout)
        textA.unobserve(check)
        textB.unobserve(check)
        resolve()
      }
    }
    textA.observe(check)
    textB.observe(check)
    check()
  })

  console.log('✅ Client A text after delta sync:', JSON.stringify(textA.toString()))
  console.log('✅ Client B text after delta sync:', JSON.stringify(textB.toString()))

  if (textA.toString() === textB.toString()) {
    console.log('🎉 SUCCESS: Stage 5 Reconnect resilience and delta sync verified with zero data loss!')
  } else {
    throw new Error('Convergence failed after reconnect')
  }

  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()
  process.exit(0)
}

testStage5Reconnect().catch((err) => {
  console.error('❌ Stage 5 Reconnect test failed:', err)
  process.exit(1)
})
