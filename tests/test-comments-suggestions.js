const assert = require('assert')
const WebSocket = require('ws')
const { WebsocketProvider } = require('y-websocket')
const Y = require('yjs')

async function runCommentsAndSuggestionsTest() {
  console.log('='.repeat(70))
  console.log('STAGE E: COLLABORATIVE COMMENTS & SUGGESTION MODE TEST')
  console.log('='.repeat(70))

  const wsUrl = 'ws://localhost:1234'
  const room = `collab-comments-test-${Date.now()}`

  // 1. Connect Client A and Client B
  console.log(`[Step 1] Connecting Client A and Client B to room "${room}"...`)
  const docA = new Y.Doc()
  const docB = new Y.Doc()

  const providerA = new WebsocketProvider(wsUrl, room, docA, { WebSocketPolyfill: WebSocket })
  const providerB = new WebsocketProvider(wsUrl, room, docB, { WebSocketPolyfill: WebSocket })

  await Promise.all([
    new Promise((res) => {
      if (providerA.wsconnected) res()
      else providerA.on('status', ({ status }) => status === 'connected' && res())
    }),
    new Promise((res) => {
      if (providerB.wsconnected) res()
      else providerB.on('status', ({ status }) => status === 'connected' && res())
    }),
  ])
  console.log(`✅ Both clients connected!`)

  // 2. Test Collaborative Comments Thread
  console.log(`\n[Step 2] Testing Collaborative Comments Threading...`)
  const commentsA = docA.getMap('comments')
  const commentsB = docB.getMap('comments')

  const commentId = 'c-thread-101'
  const initialComment = {
    id: commentId,
    authorName: 'Alice Reviewer',
    authorColor: '#3b82f6',
    text: 'Please clarify whether Redis Pub/Sub handles echo prevention.',
    createdAt: Date.now(),
    resolved: false,
    replies: [],
  }

  // Client A posts root comment
  commentsA.set(commentId, initialComment)

  // Wait for Client B to receive comment
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Comment sync timeout')), 4000)
    const observer = () => {
      if (commentsB.has(commentId)) {
        clearTimeout(timeout)
        commentsB.unobserve(observer)
        resolve()
      }
    }
    if (commentsB.has(commentId)) {
      clearTimeout(timeout)
      resolve()
    } else {
      commentsB.observe(observer)
    }
  })
  console.log(`✅ Client B received Client A's root comment!`)

  // Client B replies to comment
  console.log(`\n[Step 3] Client B replies to comment thread...`)
  const commentOnB = commentsB.get(commentId)
  const updatedCommentWithReply = {
    ...commentOnB,
    replies: [
      {
        id: 'reply-201',
        authorName: 'Bob Author',
        authorColor: '#ef4444',
        text: 'Confirmed. Echo prevention is enforced via unique instanceId tags.',
        createdAt: Date.now(),
      },
    ],
  }
  commentsB.set(commentId, updatedCommentWithReply)

  // Wait for Client A to observe reply
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Reply sync timeout')), 4000)
    const observer = () => {
      const c = commentsA.get(commentId)
      if (c && c.replies && c.replies.length > 0) {
        clearTimeout(timeout)
        commentsA.unobserve(observer)
        resolve()
      }
    }
    const cur = commentsA.get(commentId)
    if (cur && cur.replies && cur.replies.length > 0) {
      clearTimeout(timeout)
      resolve()
    } else {
      commentsA.observe(observer)
    }
  })
  console.log(`✅ Client A observed Bob's reply in real time!`)

  // Client A marks comment as resolved
  console.log(`\n[Step 4] Client A marks comment thread as resolved...`)
  const commentOnA = commentsA.get(commentId)
  commentsA.set(commentId, { ...commentOnA, resolved: true })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Resolution sync timeout')), 4000)
    const observer = () => {
      const c = commentsB.get(commentId)
      if (c && c.resolved) {
        clearTimeout(timeout)
        commentsB.unobserve(observer)
        resolve()
      }
    }
    const cur = commentsB.get(commentId)
    if (cur && cur.resolved) {
      clearTimeout(timeout)
      resolve()
    } else {
      commentsB.observe(observer)
    }
  })
  console.log(`✅ Client B verified thread resolution!`)

  // 3. Test Suggestion Mode (Track Changes)
  console.log(`\n[Step 5] Testing Suggestion Mode (Track Changes)...`)
  const suggestionsA = docA.getMap('suggestions')
  const suggestionsB = docB.getMap('suggestions')

  const suggestionId = 'sugg-301'
  const proposedChange = {
    id: suggestionId,
    type: 'insert',
    authorName: 'Alice Reviewer',
    authorColor: '#3b82f6',
    text: 'Multi-region disaster recovery standby',
    createdAt: Date.now(),
    status: 'pending',
  }

  suggestionsA.set(suggestionId, proposedChange)

  // Wait for Client B to observe suggestion
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Suggestion sync timeout')), 4000)
    const observer = () => {
      if (suggestionsB.has(suggestionId)) {
        clearTimeout(timeout)
        suggestionsB.unobserve(observer)
        resolve()
      }
    }
    if (suggestionsB.has(suggestionId)) {
      clearTimeout(timeout)
      resolve()
    } else {
      suggestionsB.observe(observer)
    }
  })
  console.log(`✅ Client B received proposed insertion suggestion!`)

  // Client B accepts the suggestion
  console.log(`\n[Step 6] Client B accepts the suggestion...`)
  const suggOnB = suggestionsB.get(suggestionId)
  suggestionsB.set(suggestionId, { ...suggOnB, status: 'accepted' })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Suggestion accept sync timeout')), 4000)
    const observer = () => {
      const s = suggestionsA.get(suggestionId)
      if (s && s.status === 'accepted') {
        clearTimeout(timeout)
        suggestionsA.unobserve(observer)
        resolve()
      }
    }
    const cur = suggestionsA.get(suggestionId)
    if (cur && cur.status === 'accepted') {
      clearTimeout(timeout)
      resolve()
    } else {
      suggestionsA.observe(observer)
    }
  })
  console.log(`✅ Suggestion status converged to "accepted" across both clients!`)

  // 4. Test Multi-User Undo Isolation
  console.log(`\n[Step 7] Testing Multi-User Undo Isolation...`)
  const fragA = docA.getXmlFragment('default')
  const fragB = docB.getXmlFragment('default')

  // Create UndoManager scoped strictly to the text fragment on Client A
  const undoManagerA = new Y.UndoManager(fragA)

  // Client A inserts text
  const pA = new Y.XmlElement('paragraph')
  pA.insert(0, [new Y.XmlText('Text typed by Client A before undo')])
  fragA.push([pA])

  await new Promise((r) => setTimeout(r, 400))
  assert(fragB.toString().includes('Text typed by Client A before undo'))

  // Meanwhile Client B adds a separate comment
  const comment2Id = 'c-isolated-2'
  commentsB.set(comment2Id, {
    id: comment2Id,
    authorName: 'Bob',
    authorColor: '#ef4444',
    text: 'Comment made while Alice is typing',
    createdAt: Date.now(),
    resolved: false,
    replies: [],
  })

  await new Promise((r) => setTimeout(r, 400))
  assert(commentsA.has(comment2Id))

  // Client A executes UNDO
  console.log('Client A performs undo()...')
  undoManagerA.undo()

  await new Promise((r) => setTimeout(r, 400))

  // Assert: Client A text is undone from BOTH clients
  assert(!fragA.toString().includes('Text typed by Client A before undo'), 'A text should be undone')
  assert(!fragB.toString().includes('Text typed by Client A before undo'), 'B should see A text undone')

  // Assert: Client B's comment remains completely intact on BOTH clients!
  assert(commentsA.has(comment2Id), 'Bob comment must NOT be undone on A')
  assert(commentsB.has(comment2Id), 'Bob comment must NOT be undone on B')
  console.log(`✅ Multi-User Undo Isolation verified: Client A undo did not revert Client B's comment!`)

  // Teardown
  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()

  console.log('\n' + '='.repeat(70))
  console.log('🎉 ALL STAGE E COMMENTS & SUGGESTIONS CHECKS PASSED!')
  console.log('='.repeat(70))
  process.exit(0)
}

runCommentsAndSuggestionsTest().catch((err) => {
  console.error('❌ Comments & suggestions test failed:', err)
  process.exit(1)
})
