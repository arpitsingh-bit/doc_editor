const Y = require('yjs')
const { WebsocketProvider } = require('y-websocket')
const WebSocket = require('ws')

async function testStage1() {
  console.log('--- Starting Stage 1 Automated Sync Verification ---')
  const room = 'test-room-' + Date.now()
  const serverUrl = 'ws://localhost:1234'

  // Client A
  const docA = new Y.Doc()
  const providerA = new WebsocketProvider(serverUrl, room, docA, { WebSocketPolyfill: WebSocket })
  const textA = docA.getText('plain-sync')

  // Client B
  const docB = new Y.Doc()
  const providerB = new WebsocketProvider(serverUrl, room, docB, { WebSocketPolyfill: WebSocket })
  const textB = docB.getText('plain-sync')

  // Wait for both to connect
  await Promise.all([
    new Promise((resolve) => {
      if (providerA.wsconnected) resolve()
      else providerA.on('status', ({ status }) => { if (status === 'connected') resolve() })
    }),
    new Promise((resolve) => {
      if (providerB.wsconnected) resolve()
      else providerB.on('status', ({ status }) => { if (status === 'connected') resolve() })
    })
  ])

  console.log('✅ Both Client A and Client B connected to y-websocket server!')

  // 1. Test Client A typing -> Client B receives
  console.log('Testing edit from Client A...')
  textA.insert(0, 'Hello from Client A! ')

  // Wait for sync to Client B
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Sync timed out')), 4000)
    const check = () => {
      if (textB.toString().includes('Hello from Client A! ')) {
        clearTimeout(timeout)
        textB.unobserve(check)
        resolve()
      }
    }
    textB.observe(check)
    check()
  })
  console.log('✅ Client B successfully received Client A edit:', JSON.stringify(textB.toString()))

  // 2. Test concurrent edit from Client B
  console.log('Testing concurrent edit from Client B...')
  textB.insert(textB.length, 'Added concurrently by Client B.')

  // Wait for sync back to Client A
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Sync back timed out')), 4000)
    const check = () => {
      if (textA.toString().includes('Added concurrently by Client B.')) {
        clearTimeout(timeout)
        textA.unobserve(check)
        resolve()
      }
    }
    textA.observe(check)
    check()
  })

  console.log('✅ Final text in Client A:', JSON.stringify(textA.toString()))
  console.log('✅ Final text in Client B:', JSON.stringify(textB.toString()))

  if (textA.toString() === textB.toString()) {
    console.log('🎉 SUCCESS: CRDT plain sync verified with 100% convergence!')
  } else {
    throw new Error('Convergence failed: Doc A != Doc B')
  }

  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()
  process.exit(0)
}

testStage1().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
