const net = require('net')
const readline = require('readline')
const Redis = require('ioredis')
const Y = require('yjs')

const DEFAULT_IPC_PORT = 43210

/**
 * Horizontal Scaling Redis Pub/Sub Relay Adapter with Local IPC Broker Fallback
 * Seamlessly connects multiple y-websocket relay instances:
 * - Production Mode: Connects to Redis Pub/Sub cluster via ioredis.
 * - Zero-Daemon Mode: Automatically elects an Embedded Cluster Coordinator over
 *   TCP loopback (127.0.0.1:43210), enabling seamless cross-process synchronization.
 */
class RedisPubSubAdapter {
  constructor(options = {}) {
    this.instanceId =
      options.instanceId || process.env.INSTANCE_ID || `relay-${Math.random().toString(36).substring(2, 8)}`
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379'
    this.ipcPort = options.ipcPort || DEFAULT_IPC_PORT
    this.isLiveRedis = false
    this.pubClient = null
    this.subClient = null
    this.subscribedRooms = new Set()
    this.docsMap = null

    // Embedded IPC Fallback
    this.ipcServer = null
    this.ipcClient = null
    this.peerSockets = new Set()
    this.isCoordinator = false

    this.metrics = {
      instanceId: this.instanceId,
      messagesPublished: 0,
      messagesReceived: 0,
      messagesEchoFiltered: 0,
      latenciesMs: [],
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      lastSyncTime: null,
      activeChannels: 0,
    }
  }

  async init(docsMap) {
    this.docsMap = docsMap

    // 1. Attempt connection to live Redis
    try {
      this.pubClient = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        retryStrategy: () => null,
      })
      this.subClient = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        retryStrategy: () => null,
      })

      this.pubClient.on('error', () => {})
      this.subClient.on('error', () => {})

      await this.pubClient.connect()
      await this.subClient.connect()
      await this.pubClient.ping()

      this.isLiveRedis = true
      console.log(`[PubSub:${this.instanceId}] Connected to live Redis Pub/Sub cluster at ${this.redisUrl}`)

      this.subClient.on('message', (channel, rawMessage) => {
        this.handleIncomingMessage(channel, rawMessage)
      })
      return
    } catch (err) {
      this.isLiveRedis = false
      if (this.pubClient) {
        try {
          this.pubClient.disconnect()
        } catch (_) {}
      }
      if (this.subClient) {
        try {
          this.subClient.disconnect()
        } catch (_) {}
      }
    }

    // 2. Initialize Embedded IPC Cluster Broker
    await this.initEmbeddedIpc()
  }

  initEmbeddedIpc() {
    return new Promise((resolve) => {
      // First attempt to connect as a peer to an existing coordinator
      const client = net.createConnection({ host: '127.0.0.1', port: this.ipcPort })

      client.on('connect', () => {
        this.ipcClient = client
        this.setupIpcReader(client)
        console.log(`[PubSub:${this.instanceId}] Connected as peer to Embedded Cluster Coordinator on :${this.ipcPort}`)
        resolve()
      })

      client.on('error', (err) => {
        client.destroy()
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
          // No coordinator running. Start local broker coordinator!
          this.startCoordinator().then(resolve)
        } else {
          resolve()
        }
      })
    })
  }

  startCoordinator() {
    return new Promise((resolve) => {
      this.ipcServer = net.createServer((sock) => {
        this.peerSockets.add(sock)

        sock.on('close', () => this.peerSockets.delete(sock))
        sock.on('error', () => this.peerSockets.delete(sock))

        this.setupIpcReader(sock, (line) => {
          // Forward message to all other connected peers
          for (const peer of this.peerSockets) {
            if (peer !== sock && !peer.destroyed) {
              peer.write(line + '\n')
            }
          }
        })
      })

      this.ipcServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Another instance just started coordinator, reconnect as client
          setTimeout(() => this.initEmbeddedIpc().then(resolve), 200)
        } else {
          resolve()
        }
      })

      this.ipcServer.listen(this.ipcPort, '127.0.0.1', () => {
        this.isCoordinator = true
        console.log(
          `[PubSub:${this.instanceId}] Operating as Embedded Cluster Coordinator on 127.0.0.1:${this.ipcPort}`
        )
        resolve()
      })
    })
  }

  setupIpcReader(stream, onForward = null) {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    rl.on('line', (line) => {
      if (!line.trim()) return
      try {
        const msg = JSON.parse(line)
        const channel = this.getChannelName(msg.docName)

        // Process message locally
        this.handleIncomingMessage(channel, line)

        // If this is coordinator and peer sent it, forward to other peers
        if (onForward) {
          onForward(line)
        }
      } catch (e) {
        console.warn(`[PubSub:${this.instanceId}] IPC parse error:`, e.message)
      }
    })
  }

  getChannelName(docName) {
    return `channel:doc:${docName}`
  }

  bindDoc(docName, ydoc) {
    if (this.subscribedRooms.has(docName)) return
    this.subscribedRooms.add(docName)
    this.metrics.activeChannels = this.subscribedRooms.size

    const channel = this.getChannelName(docName)

    if (this.isLiveRedis && this.subClient) {
      this.subClient.subscribe(channel).catch((err) => {
        console.warn(`[PubSub:${this.instanceId}] Subscribe failed for ${channel}:`, err.message)
      })
    }

    ydoc.on('update', (update, origin) => {
      if (origin && origin.isPubSubRelay) {
        return
      }
      this.publishUpdate(docName, update)
    })

    console.log(`[PubSub:${this.instanceId}] Bound room "${docName}" to cross-relay channel "${channel}"`)
  }

  async publishUpdate(docName, update) {
    const channel = this.getChannelName(docName)
    const payload = {
      origin: this.instanceId,
      docName,
      type: 'update',
      updateBase64: Buffer.from(update).toString('base64'),
      timestamp: Date.now(),
    }
    const messageStr = JSON.stringify(payload)
    this.metrics.messagesPublished++

    // 1. Live Redis Pub/Sub
    if (this.isLiveRedis && this.pubClient) {
      try {
        await this.pubClient.publish(channel, messageStr)
        return
      } catch (err) {
        console.warn(`[PubSub:${this.instanceId}] Redis publish error:`, err.message)
      }
    }

    // 2. Embedded IPC Bus
    if (this.isCoordinator) {
      // Coordinator sends to all peer sockets
      for (const peer of this.peerSockets) {
        if (!peer.destroyed) {
          peer.write(messageStr + '\n')
        }
      }
    } else if (this.ipcClient && !this.ipcClient.destroyed) {
      // Peer sends to coordinator
      this.ipcClient.write(messageStr + '\n')
    }
  }

  handleIncomingMessage(channel, rawMessage) {
    try {
      const msg = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage

      // Echo Prevention: ignore updates produced by this instance
      if (msg.origin === this.instanceId) {
        this.metrics.messagesEchoFiltered++
        return
      }

      this.metrics.messagesReceived++

      if (msg.timestamp) {
        const latency = Math.max(0, Date.now() - msg.timestamp)
        this.recordLatency(latency)
      }

      if (this.docsMap && this.docsMap.has(msg.docName)) {
        const localDoc = this.docsMap.get(msg.docName)
        const update = new Uint8Array(Buffer.from(msg.updateBase64, 'base64'))

        Y.applyUpdate(localDoc, update, { isPubSubRelay: true, sourceInstance: msg.origin })
      }
    } catch (err) {
      console.error(`[PubSub:${this.instanceId}] Failed to process incoming message:`, err)
    }
  }

  recordLatency(ms) {
    this.metrics.latenciesMs.push(ms)
    if (this.metrics.latenciesMs.length > 200) {
      this.metrics.latenciesMs.shift()
    }

    const sum = this.metrics.latenciesMs.reduce((a, b) => a + b, 0)
    this.metrics.avgLatencyMs = parseFloat((sum / this.metrics.latenciesMs.length).toFixed(2))

    const sorted = [...this.metrics.latenciesMs].sort((a, b) => a - b)
    const p95Idx = Math.floor(sorted.length * 0.95)
    this.metrics.p95LatencyMs = sorted[p95Idx] || 0
    this.metrics.lastSyncTime = new Date().toISOString()
  }

  getMetrics() {
    return {
      instanceId: this.instanceId,
      mode: this.isLiveRedis ? 'redis-pubsub' : this.isCoordinator ? 'cluster-coordinator' : 'cluster-peer',
      subscribedRoomsCount: this.subscribedRooms.size,
      messagesPublished: this.metrics.messagesPublished,
      messagesReceived: this.metrics.messagesReceived,
      messagesEchoFiltered: this.metrics.messagesEchoFiltered,
      avgLatencyMs: this.metrics.avgLatencyMs,
      p95LatencyMs: this.metrics.p95LatencyMs,
      lastSyncTime: this.metrics.lastSyncTime,
      connectedPeers: this.isCoordinator ? this.peerSockets.size : this.ipcClient ? 1 : 0,
    }
  }

  destroy() {
    if (this.ipcClient) {
      this.ipcClient.destroy()
    }
    if (this.ipcServer) {
      this.ipcServer.close()
    }
    if (this.pubClient && this.isLiveRedis) {
      try {
        this.pubClient.disconnect()
      } catch (_) {}
    }
    if (this.subClient && this.isLiveRedis) {
      try {
        this.subClient.disconnect()
      } catch (_) {}
    }
  }
}

module.exports = RedisPubSubAdapter
