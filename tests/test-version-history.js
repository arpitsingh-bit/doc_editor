const assert = require('assert')
const http = require('http')
const WebSocket = require('ws')
const { WebsocketProvider } = require('y-websocket')
const Y = require('yjs')

async function runVersionHistoryTest() {
  console.log('='.repeat(70))
  console.log('STAGE D: VERSION HISTORY & TIME-TRAVEL RESTORE VERIFICATION')
  console.log('='.repeat(70))

  const wsUrl = 'ws://localhost:1234'
  const httpUrl = 'http://localhost:1234'
  const docId = `version-doc-${Date.now()}`

  // 1. Connect Client 1 & set initial content
  console.log(`[Step 1] Connecting Client 1 to room "${docId}"...`)
  const doc1 = new Y.Doc()
  const provider1 = new WebsocketProvider(wsUrl, docId, doc1, { WebSocketPolyfill: WebSocket })
  await new Promise((res) => {
    if (provider1.wsconnected) res()
    else provider1.on('status', ({ status }) => status === 'connected' && res())
  })

  const title1 = doc1.getText('title')
  const frag1 = doc1.getXmlFragment('default')

  // Set V1 content
  const p1 = new Y.XmlElement('paragraph')
  p1.insert(0, [new Y.XmlText('Version 1: The Foundations of the Project')])
  title1.insert(0, 'Architecture v1.0')
  frag1.push([p1])

  await new Promise((r) => setTimeout(r, 600))
  console.log(`✅ Initial V1 state established: "${frag1.toString()}" | Title: "${title1.toString()}"`)

  // 2. Create Named Checkpoint Version via POST API
  console.log(`\n[Step 2] Creating named checkpoint version "v1.0 - Initial Baseline"...`)
  const checkpointRes = await new Promise((resolve, reject) => {
    const req = http.request(
      `${httpUrl}/api/documents/${docId}/versions`,
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
        name: 'v1.0 - Initial Baseline',
        authorName: 'Lead Architect',
        authorColor: '#10b981',
      })
    )
    req.end()
  })

  assert(checkpointRes.success, 'Checkpoint creation must return success: true')
  const versionId = checkpointRes.versionId
  console.log(`✅ Checkpoint created successfully with Version ID: ${versionId}`)

  // 3. Connect Client 2 and perform breaking edits to establish V2
  console.log(`\n[Step 3] Connecting Client 2 and modifying document to Version 2...`)
  const doc2 = new Y.Doc()
  const provider2 = new WebsocketProvider(wsUrl, docId, doc2, { WebSocketPolyfill: WebSocket })
  await new Promise((res) => {
    if (provider2.wsconnected) res()
    else provider2.on('status', ({ status }) => status === 'connected' && res())
  })

  const title2 = doc2.getText('title')
  const frag2 = doc2.getXmlFragment('default')

  await new Promise((r) => setTimeout(r, 600))
  assert.strictEqual(frag2.toString(), frag1.toString())

  // Mutate to V2
  frag2.delete(0, frag2.length)
  const p2 = new Y.XmlElement('paragraph')
  p2.insert(0, [new Y.XmlText('Version 2: Breaking changes made by team member!')])
  frag2.push([p2])

  title2.delete(0, title2.length)
  title2.insert(0, 'Architecture v2.0 - Broken State')

  await new Promise((r) => setTimeout(r, 600))
  console.log(`✅ V2 State applied: "${frag1.toString()}" | Title: "${title1.toString()}"`)

  // 4. Query GET /api/documents/:id/versions to verify audit trail
  console.log(`\n[Step 4] Querying Version History audit trail via GET API...`)
  const listRes = await new Promise((resolve) => {
    http.get(`${httpUrl}/api/documents/${docId}/versions`, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(JSON.parse(data)))
    })
  })

  assert.strictEqual(listRes.docId, docId)
  assert(listRes.versions.length >= 1, 'Version history must contain at least 1 record')
  const savedVersion = listRes.versions.find((v) => v.id === versionId)
  assert(savedVersion, 'Saved checkpoint must be present in audit trail')
  console.log(`✅ Audit trail verified: Version "${savedVersion.version_name}" by ${savedVersion.author_name} (${savedVersion.bytes} bytes)`)

  // 5. Perform Non-Destructive Restore to V1
  console.log(`\n[Step 5] Triggering Non-Destructive Restore to Version ID ${versionId}...`)
  const restoreRes = await new Promise((resolve, reject) => {
    const req = http.request(
      `${httpUrl}/api/documents/${docId}/restore/${versionId}`,
      {
        method: 'POST',
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(JSON.parse(data)))
      }
    )
    req.on('error', reject)
    req.end()
  })

  assert(restoreRes.success, 'Restore API must return success')
  console.log(`✅ Restore API responded: ${restoreRes.message}`)

  // 6. Verify BOTH clients observe the restored state in real time
  console.log(`\n[Step 6] Verifying real-time non-destructive convergence on Client 1 and Client 2...`)
  await new Promise((r) => setTimeout(r, 800))

  console.log(`  Client 1 frag: ${frag1.toString()} | title: ${title1.toString()}`)
  console.log(`  Client 2 frag: ${frag2.toString()} | title: ${title2.toString()}`)

  assert(
    frag1.toString().includes('Version 1: The Foundations of the Project'),
    'Client 1 must reflect restored V1 text'
  )
  assert(
    frag2.toString().includes('Version 1: The Foundations of the Project'),
    'Client 2 must reflect restored V1 text'
  )
  assert.strictEqual(title1.toString(), 'Architecture v1.0', 'Client 1 title must restore to v1.0')
  assert.strictEqual(title2.toString(), 'Architecture v1.0', 'Client 2 title must restore to v1.0')
  console.log(`✅ Real-time multi-client restore verified across all connected collaborators!`)

  // 7. Verify subsequent edits work (state vector monotonicity)
  console.log(`\n[Step 7] Testing post-restore collaborative edits...`)
  const postRestoreP = new Y.XmlElement('paragraph')
  postRestoreP.insert(0, [new Y.XmlText(' — Continued collaboration after time-travel restore.')])
  frag1.push([postRestoreP])

  await new Promise((r) => setTimeout(r, 600))
  assert(
    frag2.toString().includes('Continued collaboration after time-travel restore'),
    'Client 2 must receive edits made after restore'
  )
  console.log(`✅ Post-restore edit confirmed: collaborative sync and state vector fully intact!`)

  // Teardown
  provider1.destroy()
  provider2.destroy()
  doc1.destroy()
  doc2.destroy()

  console.log('\n' + '='.repeat(70))
  console.log('🎉 ALL STAGE D VERSION HISTORY & RESTORE CHECKS PASSED!')
  console.log('='.repeat(70))
  process.exit(0)
}

runVersionHistoryTest().catch((err) => {
  console.error('❌ Version history test failed:', err)
  process.exit(1)
})
