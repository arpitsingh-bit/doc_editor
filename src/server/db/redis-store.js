const Redis = require('ioredis')

/**
 * Redis Hot Cache Store with Adaptive Driver
 * Caches active room binary states (key: doc:<docId>) with 24h sliding TTL.
 * Connects to live Redis when REDIS_URL or localhost is available,
 * or operates an in-memory TTL hot-cache fallback when running locally without Redis daemon.
 */
class RedisStore {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379'
    this.client = null
    this.isLiveRedis = false
    this.defaultTTL = options.defaultTTL || 86400 // 24 hours in seconds

    // Embedded in-memory fallback cache
    // Map of docId -> { data: Buffer, expiresAt: number, hits: number, lastAccessed: number }
    this.embeddedCache = new Map()

    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
    }

    // Periodic sweep for embedded cache (every 60 seconds)
    this.sweepInterval = setInterval(() => {
      this.sweepExpired()
    }, 60000)
    if (this.sweepInterval.unref) this.sweepInterval.unref()
  }

  async init() {
    try {
      this.client = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
        retryStrategy: () => null, // Do not reconnect in endless loop if offline
      })

      // Suppress unhandled error events during connection check
      this.client.on('error', (err) => {
        if (!this.isLiveRedis) {
          // Expected when daemon is not running
        } else {
          console.warn('[RedisStore] Redis error:', err.message)
        }
      })

      await this.client.connect()
      await this.client.ping()
      this.isLiveRedis = true
      console.log(`[RedisStore] Connected to live Redis instance at ${this.redisUrl}`)
    } catch (err) {
      this.isLiveRedis = false
      if (this.client) {
        try {
          this.client.disconnect()
        } catch (_) {}
      }
      console.log('[RedisStore] Operating in Adaptive Embedded In-Memory mode with 24h sliding TTL.')
    }
  }

  getKey(docId) {
    return `doc:${docId}`
  }

  /**
   * Set binary state in hot cache with sliding TTL
   */
  async setDoc(docId, binaryState, ttlSeconds = this.defaultTTL) {
    const buffer = Buffer.from(binaryState)
    this.stats.writes++

    if (this.isLiveRedis && this.client) {
      try {
        const key = this.getKey(docId)
        await this.client.set(key, buffer, 'EX', ttlSeconds)
        return true
      } catch (err) {
        console.warn(`[RedisStore] Failed to write to live Redis (${err.message}). Falling back to memory.`)
      }
    }

    // Embedded in-memory store
    const now = Date.now()
    this.embeddedCache.set(docId, {
      data: buffer,
      expiresAt: now + ttlSeconds * 1000,
      hits: 0,
      lastAccessed: now,
    })
    return true
  }

  /**
   * Get binary state from hot cache and refresh sliding TTL
   */
  async getDoc(docId, refreshTTL = true) {
    if (this.isLiveRedis && this.client) {
      try {
        const key = this.getKey(docId)
        const data = await this.client.getBuffer(key)
        if (data) {
          this.stats.hits++
          if (refreshTTL) {
            await this.client.expire(key, this.defaultTTL)
          }
          return new Uint8Array(data)
        }
        this.stats.misses++
        return null
      } catch (err) {
        console.warn(`[RedisStore] Failed to read from live Redis (${err.message}). Falling back to memory.`)
      }
    }

    // Embedded cache lookup
    const entry = this.embeddedCache.get(docId)
    if (!entry) {
      this.stats.misses++
      return null
    }

    const now = Date.now()
    if (now > entry.expiresAt) {
      this.embeddedCache.delete(docId)
      this.stats.evictions++
      this.stats.misses++
      return null
    }

    this.stats.hits++
    entry.hits++
    entry.lastAccessed = now
    if (refreshTTL) {
      entry.expiresAt = now + this.defaultTTL * 1000
    }

    return new Uint8Array(entry.data)
  }

  /**
   * Explicitly touch / refresh TTL
   */
  async touchDoc(docId, ttlSeconds = this.defaultTTL) {
    if (this.isLiveRedis && this.client) {
      try {
        await this.client.expire(this.getKey(docId), ttlSeconds)
        return true
      } catch (err) {
        // Fallback
      }
    }

    const entry = this.embeddedCache.get(docId)
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000
      return true
    }
    return false
  }

  /**
   * Evict doc from cache
   */
  async delDoc(docId) {
    if (this.isLiveRedis && this.client) {
      try {
        await this.client.del(this.getKey(docId))
      } catch (_) {}
    }
    return this.embeddedCache.delete(docId)
  }

  /**
   * Sweep expired keys from embedded in-memory cache
   */
  sweepExpired() {
    const now = Date.now()
    for (const [docId, entry] of this.embeddedCache.entries()) {
      if (now > entry.expiresAt) {
        this.embeddedCache.delete(docId)
        this.stats.evictions++
      }
    }
  }

  /**
   * Return list of currently cached docIds
   */
  async listCachedDocs() {
    if (this.isLiveRedis && this.client) {
      try {
        const keys = await this.client.keys('doc:*')
        return keys.map((k) => k.replace(/^doc:/, ''))
      } catch (_) {}
    }
    this.sweepExpired()
    return Array.from(this.embeddedCache.keys())
  }

  getStats() {
    return {
      type: this.isLiveRedis ? 'live-redis' : 'embedded-memory',
      cachedDocsCount: this.embeddedCache.size,
      stats: { ...this.stats },
      defaultTTLSeconds: this.defaultTTL,
    }
  }

  destroy() {
    if (this.sweepInterval) clearInterval(this.sweepInterval)
    if (this.client && this.isLiveRedis) {
      this.client.disconnect()
    }
  }
}

module.exports = new RedisStore()
