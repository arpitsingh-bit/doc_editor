const assert = require('assert')
const Y = require('yjs')
const { indexedDB, IDBKeyRange } = require('fake-indexeddb')
global.indexedDB = indexedDB; global.IDBKeyRange = IDBKeyRange
const { IndexeddbPersistence } = require('y-indexeddb')

const waitForSync = (p) => new Promise((resolve) => p.whenSynced ? p.whenSynced.then(resolve) : p.on('synced', resolve))
;(async () => {
  const first = new Y.Doc(); const storeA = new IndexeddbPersistence('stage8-offline-refresh', first)
  await waitForSync(storeA); first.getText('body').insert(0, 'offline draft'); await new Promise((r) => setTimeout(r, 25)); storeA.destroy()
  const refreshed = new Y.Doc(); const storeB = new IndexeddbPersistence('stage8-offline-refresh', refreshed)
  await waitForSync(storeB)
  assert.strictEqual(refreshed.getText('body').toString(), 'offline draft')
  storeB.destroy(); console.log('PASS: IndexedDB restores offline edits after refresh')
})().catch((error) => { console.error(error); process.exitCode = 1 })
