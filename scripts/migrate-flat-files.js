const fs = require('fs')
const path = require('path')
const Y = require('yjs')
const postgresStore = require('../src/server/db/postgres-store')
const redisStore = require('../src/server/db/redis-store')

const STORAGE_DIR = path.join(__dirname, '../storage/docs')

async function migrate() {
  console.log('='.repeat(70))
  console.log('STAGE B: FLAT-FILE TO POSTGRESQL & REDIS MIGRATION SCRIPT')
  console.log('='.repeat(70))

  const startTime = Date.now()

  // 1. Initialize databases
  await postgresStore.init()
  await redisStore.init()

  if (!fs.existsSync(STORAGE_DIR)) {
    console.log(`[Migration] Storage directory ${STORAGE_DIR} does not exist. Nothing to migrate.`)
    process.exit(0)
  }

  const files = fs.readdirSync(STORAGE_DIR).filter((f) => f.endsWith('.yjs'))
  console.log(`[Migration] Located ${files.length} flat-file documents in ${STORAGE_DIR}`)

  let migratedCount = 0
  let totalBytes = 0
  const records = []

  for (const file of files) {
    const docId = path.basename(file, '.yjs')
    const filePath = path.join(STORAGE_DIR, file)
    const fileBuffer = fs.readFileSync(filePath)
    const byteLength = fileBuffer.byteLength

    if (byteLength === 0) {
      console.log(`[Migration] Skipping empty file: ${file}`)
      continue
    }

    // Inspect document content to extract title
    const tempDoc = new Y.Doc()
    let extractedTitle = docId
    try {
      Y.applyUpdate(tempDoc, new Uint8Array(fileBuffer))
      const titleText = tempDoc.getText('title')
      if (titleText && titleText.toString().trim()) {
        extractedTitle = titleText.toString().trim()
      } else {
        // Fallback: check prosemirror default fragment for first heading/text
        const fragment = tempDoc.getXmlFragment('default')
        const plain = fragment.toString().replace(/<[^>]+>/g, ' ').trim()
        if (plain.length > 0) {
          extractedTitle = plain.slice(0, 40)
        }
      }
    } catch (parseErr) {
      console.warn(`[Migration] Warning: could not parse Yjs doc for ${file}: ${parseErr.message}`)
    }

    // Save to PostgreSQL
    const snapshotId = await postgresStore.saveSnapshot(docId, fileBuffer, extractedTitle)

    // Warm Redis Hot Cache
    await redisStore.setDoc(docId, fileBuffer)

    migratedCount++
    totalBytes += byteLength

    records.push({
      docId,
      title: extractedTitle,
      bytes: byteLength,
      snapshotId,
    })

    console.log(
      `  [OK] Migrated "${docId}" (${byteLength} bytes) -> Title: "${extractedTitle}" [Snapshot #${snapshotId}]`
    )
  }

  const durationMs = Date.now() - startTime

  console.log('-'.repeat(70))
  console.log('MIGRATION SUMMARY:')
  console.log(`  Total files scanned:   ${files.length}`)
  console.log(`  Documents migrated:    ${migratedCount}`)
  console.log(`  Total data volume:     ${(totalBytes / 1024).toFixed(2)} KB (${totalBytes} bytes)`)
  console.log(`  Postgres engine:       ${postgresStore.isLivePostgres ? 'Live PostgreSQL' : 'Adaptive Embedded Engine'}`)
  console.log(`  Redis hot cache:       ${redisStore.isLiveRedis ? 'Live Redis' : 'Adaptive Embedded Cache'}`)
  console.log(`  Execution time:        ${durationMs} ms`)
  console.log('='.repeat(70))

  // Clean exit
  redisStore.destroy()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('[Migration] Fatal error during migration:', err)
  process.exit(1)
})
