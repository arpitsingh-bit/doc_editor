const Y = require('yjs')
const { WebsocketProvider } = require('y-websocket')
const WebSocket = require('ws')

async function testStage2TipTapSync() {
  console.log('--- Starting Stage 2 TipTap Y.XmlFragment Sync Verification ---')
  const room = 'tiptap-test-room-' + Date.now()
  const serverUrl = 'ws://localhost:1234'

  // Client A
  const docA = new Y.Doc()
  const providerA = new WebsocketProvider(serverUrl, room, docA, { WebSocketPolyfill: WebSocket })
  const fragmentA = docA.getXmlFragment('default')

  // Client B
  const docB = new Y.Doc()
  const providerB = new WebsocketProvider(serverUrl, room, docB, { WebSocketPolyfill: WebSocket })
  const fragmentB = docB.getXmlFragment('default')

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

  console.log('✅ Both TipTap clients connected to y-websocket relay!')

  // Simulate TipTap rich-text node creation on Client A
  docA.transact(() => {
    const p1 = new Y.XmlElement('paragraph')
    const textNode = new Y.XmlText('Hello from TipTap Rich Editor!')
    p1.insert(0, [textNode])
    fragmentA.insert(0, [p1])
  })

  // Wait for Client B to receive the rich text structure
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('TipTap sync timed out')), 4000)
    const check = () => {
      if (fragmentB.length > 0 && fragmentB.toString().includes('Hello from TipTap Rich Editor!')) {
        clearTimeout(timeout)
        fragmentB.unobserve(check)
        resolve()
      }
    }
    fragmentB.observe(check)
    check()
  })

  console.log('✅ Client B received rich text structure:', fragmentB.toString())

  // Simulate Client B adding a Heading node
  docB.transact(() => {
    const h1 = new Y.XmlElement('heading')
    h1.setAttribute('level', '1')
    const h1Text = new Y.XmlText('Concurrent Heading by Client B')
    h1.insert(0, [h1Text])
    fragmentB.insert(0, [h1])
  })

  // Wait for Client A to receive the heading
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('TipTap heading sync timed out')), 4000)
    const check = () => {
      if (fragmentA.toString().includes('Concurrent Heading by Client B')) {
        clearTimeout(timeout)
        fragmentA.unobserve(check)
        resolve()
      }
    }
    fragmentA.observe(check)
    check()
  })

  console.log('✅ Client A converged state:', fragmentA.toString())
  console.log('✅ Client B converged state:', fragmentB.toString())

  if (fragmentA.toString() === fragmentB.toString()) {
    console.log('🎉 SUCCESS: TipTap XML structure converged 100% between both clients!')
  } else {
    throw new Error('Convergence mismatch between fragmentA and fragmentB')
  }

  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()
  process.exit(0)
}

testStage2TipTapSync().catch((err) => {
  console.error('❌ Stage 2 test failed:', err)
  process.exit(1)
})
