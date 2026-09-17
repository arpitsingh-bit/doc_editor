const fs = require('fs')
const path = require('path')
const Y = require('yjs')
const { WebsocketProvider } = require('y-websocket')
const WebSocket = require('ws')

async function testStage4Persistence() {
  console.log('--- Starting Stage 4 Persistence Verification ---')
  const room = 'persist-room-' + Date.now()
  const serverUrl = 'ws://localhost:1234'
  const storageFile = path.join(__dirname, '../storage/docs', `${room}.yjs`)

  console.log('1. Connecting Client A to create initial document...')
  const docA = new Y.Doc()
  const providerA = new WebsocketProvider(serverUrl, room, docA, { WebSocketPolyfill: WebSocket })
  const fragmentA = docA.getXmlFragment('default')

  await new Promise((res) => {
    if (providerA.wsconnected) res()
    else providerA.on('status', ({ status }) => { if (status === 'connected') res() })
  })

  // Write content
  docA.transact(() => {
    const heading = new Y.XmlElement('heading')
    heading.setAttribute('level', '1')
    heading.insert(0, [new Y.XmlText('Durable Persistent Document')])

    const p = new Y.XmlElement('paragraph')
    p.insert(0, [new Y.XmlText('This text must survive refreshes and server restarts.')])

    fragmentA.insert(0, [heading, p])
  })

  console.log('Content created on Client A. Waiting for debounce persistence to disk...')
  await new Promise((r) => setTimeout(r, 2000))

  if (!fs.existsSync(storageFile)) {
    throw new Error(`Persisted file was not found at ${storageFile}`)
  }

  const fileSize = fs.statSync(storageFile).size
  console.log(`✅ Snapshot successfully written to disk: ${storageFile} (${fileSize} bytes)`)

  // Disconnect Client A completely
  providerA.destroy()
  docA.destroy()
  console.log('Client A disconnected and destroyed.')

  // Connect fresh Client B to verify restore
  console.log('2. Connecting fresh Client B to verify late-join restoration...')
  const docB = new Y.Doc()
  const providerB = new WebsocketProvider(serverUrl, room, docB, { WebSocketPolyfill: WebSocket })
  const fragmentB = docB.getXmlFragment('default')

  await new Promise((res) => {
    if (providerB.wsconnected) res()
    else providerB.on('status', ({ status }) => { if (status === 'connected') res() })
  })

  // Wait for sync
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Client B sync timed out')), 4000)
    const check = () => {
      if (fragmentB.toString().includes('Durable Persistent Document')) {
        clearTimeout(timeout)
        fragmentB.unobserve(check)
        resolve()
      }
    }
    fragmentB.observe(check)
    check()
  })

  console.log('✅ Client B successfully restored persisted content:', fragmentB.toString())

  if (fragmentB.toString().includes('This text must survive refreshes and server restarts.')) {
    console.log('🎉 SUCCESS: Stage 4 Document Persistence verified! Refreshing or late joining completely restores state.')
  } else {
    throw new Error('Content restored on Client B does not match expected state!')
  }

  providerB.destroy()
  docB.destroy()
  process.exit(0)
}

testStage4Persistence().catch((err) => {
  console.error('❌ Stage 4 Persistence test failed:', err)
  process.exit(1)
})
