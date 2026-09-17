const Y = require('yjs')
const { WebsocketProvider } = require('y-websocket')
const WebSocket = require('ws')

async function testStage6PolishTitle() {
  console.log('--- Starting Stage 6 Collaborative Title Sync Verification ---')
  const room = 'title-test-room-' + Date.now()
  const serverUrl = 'ws://localhost:1234'

  // Client A
  const docA = new Y.Doc()
  const providerA = new WebsocketProvider(serverUrl, room, docA, { WebSocketPolyfill: WebSocket })
  const titleA = docA.getText('title')

  // Client B
  const docB = new Y.Doc()
  const providerB = new WebsocketProvider(serverUrl, room, docB, { WebSocketPolyfill: WebSocket })
  const titleB = docB.getText('title')

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
  console.log('✅ Both clients connected.')

  // Client A updates document title
  console.log('Client A sets document title...')
  docA.transact(() => {
    titleA.insert(0, 'Quarterly Product Strategy 2026')
  })

  // Wait for Client B to receive title
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Title sync to Client B timed out')), 4000)
    const check = () => {
      if (titleB.toString() === 'Quarterly Product Strategy 2026') {
        clearTimeout(timeout)
        titleB.unobserve(check)
        resolve()
      }
    }
    titleB.observe(check)
    check()
  })
  console.log('✅ Client B received synchronized title:', JSON.stringify(titleB.toString()))

  // Client B edits title
  console.log('Client B appends to document title...')
  docB.transact(() => {
    titleB.insert(titleB.length, ' — Finalized')
  })

  // Wait for Client A to receive update
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Title sync back to Client A timed out')), 4000)
    const check = () => {
      if (titleA.toString() === 'Quarterly Product Strategy 2026 — Finalized') {
        clearTimeout(timeout)
        titleA.unobserve(check)
        resolve()
      }
    }
    titleA.observe(check)
    check()
  })
  console.log('✅ Client A converged title:', JSON.stringify(titleA.toString()))

  if (titleA.toString() === titleB.toString()) {
    console.log('🎉 SUCCESS: Collaborative document title synchronization fully verified!')
  } else {
    throw new Error('Title sync mismatch')
  }

  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()
  process.exit(0)
}

testStage6PolishTitle().catch((err) => {
  console.error('❌ Stage 6 test failed:', err)
  process.exit(1)
})
