const fs = require('fs')
const path = require('path')
const Y = require('yjs')
const postgresStore = require('./postgres-store')
const redisStore = require('./redis-store')

const LEGACY_STORAGE_DIR = path.join(__dirname, '../../../storage/docs')

/**
 * Unified Storage Interface for Real-Time Collaborative Documents
 * Implements a multi-tier fallback cascade:
 *   Tier 1: Redis Hot Cache (sub-millisecond retrieval, 24h sliding TTL)
 *   Tier 2: PostgreSQL Durable Store (binary snapshots + document metadata + version history)
 *   Tier 3: Legacy Flat-File Binary Store (automatic lazy migration on read)
 */
class StorageInterface {
  constructor() {
    this.postgresStore = postgresStore
    this.redisStore = redisStore
    this.initialized = false

    this.metrics = {
      redisHits: 0,
      postgresHits: 0,
      legacyHits: 0,
      totalLoads: 0,
      flushes: 0,
    }
  }

  async init() {
    if (this.initialized) return
    await this.postgresStore.init()
    await this.redisStore.init()
    this.initialized = true
    console.log('[StorageInterface] Multi-tier storage cascade initialized.')
  }

  /**
   * Multi-tier Load Cascade
   */
  async load(docId) {
    this.metrics.totalLoads++

    // 1. Tier 1: Redis Hot Cache
    try {
      const cached = await this.redisStore.getDoc(docId, true)
      if (cached && cached.byteLength > 0) {
        this.metrics.redisHits++
        return cached
      }
    } catch (err) {
      console.warn(`[StorageInterface] Redis cache check failed for "${docId}":`, err.message)
    }

    // 2. Tier 2: PostgreSQL Durable Snapshot Store
    try {
      const dbSnapshot = await this.postgresStore.getLatestSnapshot(docId)
      if (dbSnapshot && dbSnapshot.byteLength > 0) {
        this.metrics.postgresHits++
        // Warm the Redis hot cache
        await this.redisStore.setDoc(docId, dbSnapshot)
        return dbSnapshot
      }
    } catch (err) {
      console.warn(`[StorageInterface] Postgres snapshot check failed for "${docId}":`, err.message)
    }

    // 3. Tier 3: Legacy Flat-File Binary Store
    const legacyPath = path.join(LEGACY_STORAGE_DIR, `${docId.replace(/[^a-zA-Z0-9_-]/g, '_')}.yjs`)
    if (fs.existsSync(legacyPath)) {
      try {
        const fileBuffer = fs.readFileSync(legacyPath)
        if (fileBuffer.length > 0) {
          this.metrics.legacyHits++
          const uint8 = new Uint8Array(fileBuffer)
          console.log(`[StorageInterface] Lazy migrating legacy flat-file for "${docId}" into Postgres and Redis...`)
          // Warm Redis
          await this.redisStore.setDoc(docId, uint8)
          // Persist snapshot in PostgreSQL
          await this.postgresStore.saveSnapshot(docId, uint8, docId)
          return uint8
        }
      } catch (err) {
        console.error(`[StorageInterface] Error reading legacy flat file for "${docId}":`, err)
      }
    }

    // Document is fresh / uncreated
    return null
  }

  /**
   * Save document binary state
   */
  async save(docId, binaryState, options = {}) {
    const { flushImmediate = false, title = 'Untitled Document' } = options

    // Always update Redis hot cache immediately
    await this.redisStore.setDoc(docId, binaryState)

    // Flush to PostgreSQL if requested
    if (flushImmediate) {
      await this.flushToDb(docId, binaryState, title)
    }
  }

  /**
   * Flush active state to PostgreSQL snapshot and archival mirror
   */
  async flushToDb(docId, stateOverride = null, title = 'Untitled Document') {
    try {
      const state = stateOverride || (await this.redisStore.getDoc(docId, false))
      if (!state || state.byteLength === 0) return null

      // 1. PostgreSQL durable snapshot
      const snapshotId = await this.postgresStore.saveSnapshot(docId, state, title)
      this.metrics.flushes++

      // 2. Archival flat-file mirror (for legacy tool compatibility and cold backup)
      try {
        const cleanName = docId.replace(/[^a-zA-Z0-9_-]/g, '_')
        const mirrorPath = path.join(LEGACY_STORAGE_DIR, `${cleanName}.yjs`)
        const tmpPath = `${mirrorPath}.${Date.now()}.tmp`
        fs.writeFileSync(tmpPath, Buffer.from(state))
        fs.renameSync(tmpPath, mirrorPath)
      } catch (mirrorErr) {
        // Non-fatal archival mirror error
        console.warn(`[StorageInterface] Archival mirror write warning for "${docId}":`, mirrorErr.message)
      }

      return snapshotId
    } catch (err) {
      console.error(`[StorageInterface] Failed to flush snapshot to DB for "${docId}":`, err)
      return null
    }
  }

  /**
   * Version History APIs (Stage D)
   */
  async saveVersion(docId, versionName, binaryState, authorName = 'Anonymous', authorColor = '#3b82f6') {
    return this.postgresStore.saveVersion(docId, versionName, binaryState, authorName, authorColor)
  }

  async listVersions(docId) {
    return this.postgresStore.listVersions(docId)
  }

  async getVersion(versionId) {
    return this.postgresStore.getVersion(versionId)
  }

  /**
   * Returns a y-websocket compatible persistence provider object
   */
  getYjsPersistence() {
    return {
      provider: 'postgres-redis-cascade',
      bindState: async (docName, ydoc) => {
        // 1. Load initial state
        const savedState = await this.load(docName)
        if (savedState) {
          console.log(`[Persistence:Cascade] Found persisted state for "${docName}" (${savedState.byteLength} bytes). Merging...`)
          Y.applyUpdate(ydoc, savedState)
        } else {
          console.log(`[Persistence:Cascade] Fresh document initialized for "${docName}".`)
        }

        // 2. Continuous Hot Cache Update & Debounced PostgreSQL Snapshotting
        let debounceFlushTimer = null

        const persistToCache = () => {
          try {
            const stateUpdate = Y.encodeStateAsUpdate(ydoc)
            this.redisStore.setDoc(docName, stateUpdate)
          } catch (err) {
            console.error(`[Persistence:Cascade] Redis cache write error for "${docName}":`, err)
          }
        }

        const flushDurableSnapshot = async () => {
          try {
            const stateUpdate = Y.encodeStateAsUpdate(ydoc)
            await this.flushToDb(docName, stateUpdate, docName)
          } catch (err) {
            console.error(`[Persistence:Cascade] Postgres durable flush error for "${docName}":`, err)
          }
        }

        // On document mutation: write hot cache immediately, debounce durable DB flush
        ydoc.on('update', () => {
          persistToCache()
          if (debounceFlushTimer) clearTimeout(debounceFlushTimer)
          debounceFlushTimer = setTimeout(flushDurableSnapshot, 800)
        })

        // Periodic durable snapshot every 15 seconds
        const periodicTimer = setInterval(flushDurableSnapshot, 15000)

        // On room cleanup/unmount: flush state to durable PostgreSQL
        ydoc.on('destroy', async () => {
          clearInterval(periodicTimer)
          if (debounceFlushTimer) clearTimeout(debounceFlushTimer)
          await flushDurableSnapshot()
          console.log(`[Persistence:Cascade] Room "${docName}" destroyed. Final state flushed to durable DB.`)
        })
      },

      writeState: async (docName, ydoc) => {
        const stateUpdate = Y.encodeStateAsUpdate(ydoc)
        await this.redisStore.setDoc(docName, stateUpdate)
        await this.flushToDb(docName, stateUpdate, docName)
      },
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      redis: this.redisStore.getStats(),
      isLivePostgres: this.postgresStore.isLivePostgres,
    }
  }
}

module.exports = new StorageInterface()
