const assert = require('assert')
const Y = require('yjs')
const postgresStore = require('../src/server/db/postgres-store')
const redisStore = require('../src/server/db/redis-store')
const storageInterface = require('../src/server/db/storage-interface')

async function runPersistenceCascadeTest() {
  console.log('='.repeat(70))
  console.log('STAGE B VERIFICATION: MULTI-TIER PERSISTENCE CASCADE TEST')
  console.log('='.repeat(70))

  await storageInterface.init()

  const testDocId = `test-cascade-doc-${Date.now()}`
  const docOriginal = new Y.Doc()
  const textOriginal = docOriginal.getText('prose')
  textOriginal.insert(0, 'Hello Production Persistence: Redis Hot Cache + PostgreSQL Snapshots!')

  const originalBinary = Y.encodeStateAsUpdate(docOriginal)
  console.log(`[Test 1] Generated test document binary: ${originalBinary.byteLength} bytes`)

  // 1. Test Redis hot cache write & sub-millisecond retrieval
  console.log('\n[Test 2] Testing Redis Hot Cache write & retrieval...')
  const t0 = performance.now()
  await redisStore.setDoc(testDocId, originalBinary)
  const writeLatency = performance.now() - t0

  const t1 = performance.now()
  const cachedBinary = await redisStore.getDoc(testDocId)
  const readLatency = performance.now() - t1

  assert(cachedBinary !== null, 'Hot cache should return stored document')
  assert.strictEqual(cachedBinary.byteLength, originalBinary.byteLength)
  console.log(`✅ Redis Hot Cache verified. Write: ${writeLatency.toFixed(2)}ms | Read: ${readLatency.toFixed(2)}ms`)

  // 2. Test PostgreSQL durable snapshot persistence
  console.log('\n[Test 3] Testing PostgreSQL snapshot persistence & retrieval...')
  const t2 = performance.now()
  const snapshotId = await postgresStore.saveSnapshot(testDocId, originalBinary, 'Cascade Test Doc')
  const pgWriteLatency = performance.now() - t2
  assert(snapshotId > 0, 'PostgreSQL should return valid snapshot ID')

  const t3 = performance.now()
  const dbBinary = await postgresStore.getLatestSnapshot(testDocId)
  const pgReadLatency = performance.now() - t3
  assert(dbBinary !== null, 'Postgres should return latest snapshot')
  assert.strictEqual(dbBinary.byteLength, originalBinary.byteLength)
  console.log(`✅ PostgreSQL Snapshot verified (ID #${snapshotId}). Write: ${pgWriteLatency.toFixed(2)}ms | Read: ${pgReadLatency.toFixed(2)}ms`)

  // 3. Test Cascade Fallback on Redis Cache Miss
  console.log('\n[Test 4] Testing Cache Miss Cascade Fallback (Evicting from Redis)...')
  await redisStore.delDoc(testDocId)
  const shouldBeNull = await redisStore.getDoc(testDocId)
  assert.strictEqual(shouldBeNull, null, 'Cache must be empty after deletion')

  // Calling storageInterface.load should fall through to PostgreSQL and re-warm Redis
  const cascadedBinary = await storageInterface.load(testDocId)
  assert(cascadedBinary !== null, 'Storage cascade should recover state from PostgreSQL')
  assert.strictEqual(cascadedBinary.byteLength, originalBinary.byteLength)

  // Verify Redis was automatically re-warmed by the cascade
  const rewarmedCache = await redisStore.getDoc(testDocId)
  assert(rewarmedCache !== null, 'Storage cascade must automatically re-warm Redis cache')
  console.log('✅ Cascade Fallback verified: PostgreSQL retrieved state & automatically re-warmed Redis cache!')

  // 4. Verify Document State Convergence
  console.log('\n[Test 5] Verifying CRDT Convergence from recovered binary...')
  const docRestored = new Y.Doc()
  Y.applyUpdate(docRestored, cascadedBinary)
  const textRestored = docRestored.getText('prose')
  assert.strictEqual(textRestored.toString(), textOriginal.toString())
  console.log(`✅ Content perfectly restored: "${textRestored.toString()}"`)

  console.log('\n' + '='.repeat(70))
  console.log('🎉 ALL STAGE B PERSISTENCE CASCADE CHECKS PASSED PERFECTLY!')
  console.log('='.repeat(70))

  redisStore.destroy()
  process.exit(0)
}

runPersistenceCascadeTest().catch((err) => {
  console.error('❌ Persistence cascade test failed:', err)
  process.exit(1)
})
