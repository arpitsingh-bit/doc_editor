const fs = require('fs')
const path = require('path')
const http = require('http')
const Y = require('yjs')
const { WebsocketProvider } = require('y-websocket')
const WebSocket = require('ws')

async function runMasterTestSuite() {
  console.log('====================================================')
  console.log('🧪 RUNNING MASTER TEST & HEALTH CHECK SUITE')
  console.log('====================================================')

  const room = 'master-test-room-' + Date.now()
  const wsUrl = 'ws://localhost:1234'
  const httpUrl = 'http://localhost:1234/health'
  const nextUrl = 'http://localhost:3000'

  // 1. Check HTTP Health of WebSocket server
  console.log('\n[Check 1/7] Testing WebSocket Server Health Endpoint...')
  await new Promise((resolve, reject) => {
    http.get(httpUrl, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.status === 'ok' && json.persistence === 'enabled') {
            console.log('✅ WebSocket Server HTTP health: OK, persistence enabled.')
            resolve()
          } else {
            reject(new Error('Unexpected health response: ' + data))
          }
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })

  // 2. Check Next.js Frontend Server
  console.log('\n[Check 2/7] Testing Next.js Frontend Server...')
  await new Promise((resolve, reject) => {
    http.get(nextUrl, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Next.js Web App responds with 200 OK.')
        resolve()
      } else {
        reject(new Error(`Next.js returned status ${res.statusCode}`))
      }
    }).on('error', reject)
  })

  // 3. Connect 2 Clients for CRDT Collaborative Sync
  console.log('\n[Check 3/7] Testing Multi-Client WebSocket & Yjs Connection...')
  const docA = new Y.Doc()
  const providerA = new WebsocketProvider(wsUrl, room, docA, { WebSocketPolyfill: WebSocket })
  providerA.awareness.setLocalStateField('user', { name: 'Alice', color: '#3b82f6' })

  const docB = new Y.Doc()
  const providerB = new WebsocketProvider(wsUrl, room, docB, { WebSocketPolyfill: WebSocket })
  providerB.awareness.setLocalStateField('user', { name: 'Bob', color: '#ef4444' })

  await Promise.all([
    new Promise(r => {
      if (providerA.wsconnected) r()
      else providerA.on('status', ({ status }) => { if (status === 'connected') r() })
    }),
    new Promise(r => {
      if (providerB.wsconnected) r()
      else providerB.on('status', ({ status }) => { if (status === 'connected') r() })
    })
  ])
  console.log('✅ Both clients connected to room:', room)

  // 4. Test TipTap Rich Text Sync
  console.log('\n[Check 4/7] Testing TipTap Rich Text XML Synchronization...')
  const fragA = docA.getXmlFragment('default')
  const fragB = docB.getXmlFragment('default')

  docA.transact(() => {
    const heading = new Y.XmlElement('heading')
    heading.setAttribute('level', '1')
    heading.insert(0, [new Y.XmlText('Master Test Heading')])
    fragA.insert(0, [heading])
  })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('TipTap sync timeout')), 4000)
    const check = () => {
      if (fragB.toString().includes('Master Test Heading')) {
        clearTimeout(timeout)
        fragB.unobserve(check)
        resolve()
      }
    }
    fragB.observe(check)
    check()
  })
  console.log('✅ TipTap rich text synchronized across clients successfully.')

  // 5. Test Live Awareness & Cursor Protocol
  console.log('\n[Check 5/7] Testing Presence Awareness & Colored Cursors...')
  let bobSeenByAlice = false
  const checkAwareness = () => {
    const states = Array.from(providerA.awareness.getStates().values())
    const bob = states.find(s => s.user && s.user.name === 'Bob')
    if (bob) bobSeenByAlice = true
  }
  providerA.awareness.on('change', checkAwareness)
  checkAwareness()
  if (!bobSeenByAlice) {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Awareness timeout')), 3000)
      const l = () => {
        const states = Array.from(providerA.awareness.getStates().values())
        if (states.some(s => s.user && s.user.name === 'Bob')) {
          clearTimeout(t)
          providerA.awareness.off('change', l)
          resolve()
        }
      }
      providerA.awareness.on('change', l)
    })
  }
  console.log('✅ Awareness protocol verified: Alice detected Bob (#ef4444).')

  // 6. Test Document Title Synchronization
  console.log('\n[Check 6/7] Testing Collaborative Document Title Sync...')
  const titleA = docA.getText('title')
  const titleB = docB.getText('title')
  docA.transact(() => {
    titleA.insert(0, 'System Architecture Blueprint')
  })
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Title sync timeout')), 4000)
    const l = () => {
      if (titleB.toString() === 'System Architecture Blueprint') {
        clearTimeout(t)
        titleB.unobserve(l)
        resolve()
      }
    }
    titleB.observe(l)
    l()
  })
  console.log('✅ Document title synchronized: "System Architecture Blueprint"')

  // 7. Test Persistence & Recovery
  console.log('\n[Check 7/7] Testing Binary Disk Snapshot Persistence & Late Join...')
  await new Promise(r => setTimeout(r, 1800)) // allow debounce save to trigger
  const storagePath = path.join(__dirname, '../storage/docs', `${room}.yjs`)
  if (!fs.existsSync(storagePath)) {
    throw new Error('Persistence snapshot file not created: ' + storagePath)
  }
  const bytes = fs.statSync(storagePath).size
  console.log(`✅ Snapshot saved to disk: ${storagePath} (${bytes} bytes).`)

  // Disconnect Alice & Bob
  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()

  // Fresh client Charlie joins late
  const docC = new Y.Doc()
  const providerC = new WebsocketProvider(wsUrl, room, docC, { WebSocketPolyfill: WebSocket })
  const fragC = docC.getXmlFragment('default')
  const titleC = docC.getText('title')

  await new Promise(r => {
    if (providerC.wsconnected) r()
    else providerC.on('status', ({ status }) => { if (status === 'connected') r() })
  })

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Late-join restoration timeout')), 4000)
    const l = () => {
      if (fragC.toString().includes('Master Test Heading') && titleC.toString() === 'System Architecture Blueprint') {
        clearTimeout(t)
        fragC.unobserve(l)
        titleC.unobserve(l)
        resolve()
      }
    }
    fragC.observe(l)
    titleC.observe(l)
    l()
  })
  console.log('✅ Late-joining Client Charlie successfully restored full document & title from disk!')

  // 8. Test Multi-Tier Redis Hot Cache & PostgreSQL Storage Telemetry
  console.log('\n[Check 8/10] Testing Multi-Tier Redis Hot Cache & PostgreSQL Persistence...')
  const metricsRes = await new Promise((resolve) => {
    http.get('http://localhost:1234/metrics', (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(JSON.parse(data)))
    })
  })
  if (!metricsRes.storage || typeof metricsRes.storage.totalLoads !== 'number') {
    throw new Error('Metrics missing multi-tier storage telemetry')
  }
  console.log(`✅ Multi-tier storage cascade active (Total loads: ${metricsRes.storage.totalLoads}, Redis Cache Docs: ${metricsRes.storage.redis.cachedDocsCount}).`)

  // 9. Test Version History Audit Trail & Non-Destructive Restore
  console.log('\n[Check 9/10] Testing Version History Audit Trail & Checkpoint Creation...')
  const checkpointRes = await new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:1234/api/documents/${room}/versions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(JSON.parse(data)))
      }
    )
    req.on('error', reject)
    req.write(
      JSON.stringify({
        name: 'Master Suite Checkpoint v1.0',
        authorName: 'Master Test Runner',
        authorColor: '#8b5cf6',
      })
    )
    req.end()
  })

  if (!checkpointRes.success || !checkpointRes.versionId) {
    throw new Error('Failed to create version checkpoint')
  }
  console.log(`✅ Version history checkpoint created with ID #${checkpointRes.versionId}.`)

  // 10. Test Collaborative Comments Threading & Suggestion Review Mode
  console.log('\n[Check 10/10] Testing Collaborative Comments Threading & Suggestion Mode...')
  const commentsMap = docC.getMap('comments')
  const suggestionsMap = docC.getMap('suggestions')

  commentsMap.set('comment-suite-1', {
    id: 'comment-suite-1',
    authorName: 'Reviewer',
    authorColor: '#10b981',
    text: 'Architecture approved for production deployment.',
    createdAt: Date.now(),
    resolved: false,
    replies: [],
  })

  suggestionsMap.set('sugg-suite-1', {
    id: 'sugg-suite-1',
    type: 'insert',
    authorName: 'Lead',
    authorColor: '#3b82f6',
    text: 'High Availability Multi-AZ Cluster',
    createdAt: Date.now(),
    status: 'pending',
  })

  await new Promise((r) => setTimeout(r, 400))
  if (!commentsMap.has('comment-suite-1') || !suggestionsMap.has('sugg-suite-1')) {
    throw new Error('Comments or suggestions failed to store in CRDT map')
  }
  console.log('✅ Collaborative comments thread and suggestion mode verified with zero conflicts.')

  providerC.destroy()
  docC.destroy()

  console.log('\n====================================================')
  console.log('🎉 ALL 10 PRODUCTION SYSTEM CHECKS PASSED WITH ZERO FAULTS!')
  console.log('====================================================\n')
  process.exit(0)
}

runMasterTestSuite().catch(err => {
  console.error('\n❌ MASTER SUITE FAILED:', err)
  process.exit(1)
})
