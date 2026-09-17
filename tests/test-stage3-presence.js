const Y = require('yjs')
const { WebsocketProvider } = require('y-websocket')
const WebSocket = require('ws')

async function testStage3Presence() {
  console.log('--- Starting Stage 3 Awareness & Presence Verification ---')
  const room = 'presence-test-room-' + Date.now()
  const serverUrl = 'ws://localhost:1234'

  // Client A (Alice)
  const docA = new Y.Doc()
  const providerA = new WebsocketProvider(serverUrl, room, docA, { WebSocketPolyfill: WebSocket })
  providerA.awareness.setLocalStateField('user', { name: 'Alice', color: '#3b82f6' })

  // Client B (Bob)
  const docB = new Y.Doc()
  const providerB = new WebsocketProvider(serverUrl, room, docB, { WebSocketPolyfill: WebSocket })
  providerB.awareness.setLocalStateField('user', { name: 'Bob', color: '#ef4444' })

  // Wait for both to connect
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

  console.log('✅ Both Alice and Bob connected to awareness protocol!')

  // Verify Alice sees Bob
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Alice timed out waiting for Bob presence')), 4000)
    const check = () => {
      const states = Array.from(providerA.awareness.getStates().values())
      const bob = states.find((s) => s.user && s.user.name === 'Bob')
      if (bob) {
        clearTimeout(timeout)
        providerA.awareness.off('change', check)
        console.log('✅ Alice received Bob presence:', JSON.stringify(bob.user))
        resolve()
      }
    }
    providerA.awareness.on('change', check)
    check()
  })

  // Verify Bob sees Alice
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Bob timed out waiting for Alice presence')), 4000)
    const check = () => {
      const states = Array.from(providerB.awareness.getStates().values())
      const alice = states.find((s) => s.user && s.user.name === 'Alice')
      if (alice) {
        clearTimeout(timeout)
        providerB.awareness.off('change', check)
        console.log('✅ Bob received Alice presence:', JSON.stringify(alice.user))
        resolve()
      }
    }
    providerB.awareness.on('change', check)
    check()
  })

  // Test dynamic presence update: Bob updates his name to "Bob The Builder"
  console.log('Testing dynamic user update...')
  providerB.awareness.setLocalStateField('user', { name: 'Bob The Builder', color: '#10b981' })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Alice timed out waiting for Bob update')), 4000)
    const check = () => {
      const states = Array.from(providerA.awareness.getStates().values())
      const updatedBob = states.find((s) => s.user && s.user.name === 'Bob The Builder')
      if (updatedBob) {
        clearTimeout(timeout)
        providerA.awareness.off('change', check)
        console.log('✅ Alice received updated presence:', JSON.stringify(updatedBob.user))
        resolve()
      }
    }
    providerA.awareness.on('change', check)
    check()
  })

  console.log('🎉 SUCCESS: Full bidirectional presence and live user awareness verified!')

  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()
  process.exit(0)
}

testStage3Presence().catch((err) => {
  console.error('❌ Stage 3 presence test failed:', err)
  process.exit(1)
})
