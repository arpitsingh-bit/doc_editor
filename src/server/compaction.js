const Y = require('yjs')
const memoryTracker = require('./memory-tracker')

class CompactionManager {
  constructor(options = {}) {
    this.updateThreshold = options.updateThreshold || 500
    this.intervalMs = options.intervalMs || 5 * 60 * 1000 // 5 minutes
    this.docMetadata = new Map() // docName -> { updateCount, rawBytes, lastCompacted, timer }
    this.stats = {
      totalCompactions: 0,
      totalBytesSaved: 0,
      lastCompactionTime: null,
      history: [],
    }
    this.docsMap = null
    this.persistenceHandler = null
    this.intervalTimer = null
  }

  /**
   * Initialize compaction manager with active docs map and persistence callback
   */
  init(docsMap, persistenceHandler) {
    this.docsMap = docsMap
    this.persistenceHandler = persistenceHandler

    // Background interval check
    this.intervalTimer = setInterval(() => {
      this.compactAllActiveDocs('interval')
    }, this.intervalMs)

    console.log(
      `[CRDT Compaction] Initialized. Trigger: every ${this.updateThreshold} updates or ${this.intervalMs / 1000}s interval.`
    )
  }

  /**
   * Register or attach update listener to a Y.Doc
   */
  trackDoc(docName, doc) {
    // Explicitly guarantee garbage collection is active
    doc.gc = true

    if (!this.docMetadata.has(docName)) {
      this.docMetadata.set(docName, {
        updateCount: 0,
        rawBytes: 0,
        created: Date.now(),
        lastCompacted: Date.now(),
      })
    }

    const meta = this.docMetadata.get(docName)

    doc.on('update', (update) => {
      meta.updateCount++
      meta.rawBytes += update.byteLength

      // Threshold-based compaction trigger
      if (meta.updateCount >= this.updateThreshold) {
        this.compactDoc(docName, doc, 'threshold')
      }
    })
  }

  /**
   * Compact a specific document
   * Replaces the accumulated update history with a single compacted snapshot
   */
  compactDoc(docName, doc, triggerReason = 'manual') {
    const startTime = Date.now()
    const meta = this.docMetadata.get(docName) || { updateCount: 0, rawBytes: 0 }

    // 1. Measure before metrics
    const beforeRawBytes = meta.rawBytes > 0 ? meta.rawBytes : Y.encodeStateAsUpdate(doc).byteLength

    // 2. Perform compaction via Y.encodeStateAsUpdate with GC
    // This merges all historical operations into a single canonical delta,
    // permanently dropping deleted character content.
    const compactedUpdate = Y.encodeStateAsUpdate(doc)
    const compactedBytes = compactedUpdate.byteLength
    const bytesSaved = Math.max(0, beforeRawBytes - compactedBytes)

    // 3. Persist compacted snapshot immediately
    if (this.persistenceHandler && typeof this.persistenceHandler.writeState === 'function') {
      try {
        this.persistenceHandler.writeState(docName, doc)
      } catch (err) {
        console.error(`[CRDT Compactor] Failed to persist compacted state for "${docName}":`, err)
      }
    }

    // 4. Reset tracker for this document
    meta.updateCount = 0
    meta.rawBytes = compactedBytes // base size is now the compacted snapshot
    meta.lastCompacted = Date.now()

    const durationMs = Date.now() - startTime
    const report = memoryTracker.measureDoc(docName, doc, beforeRawBytes)
    report.trigger = triggerReason
    report.durationMs = durationMs

    memoryTracker.logReport(report)

    // Update global compaction stats
    this.stats.totalCompactions++
    this.stats.totalBytesSaved += bytesSaved
    this.stats.lastCompactionTime = new Date().toISOString()
    this.stats.history.unshift(report)
    if (this.stats.history.length > 50) this.stats.history.pop()

    return report
  }

  /**
   * Run compaction on all active documents
   */
  compactAllActiveDocs(triggerReason = 'all') {
    if (!this.docsMap) return []
    const results = []
    this.docsMap.forEach((doc, docName) => {
      const report = this.compactDoc(docName, doc, triggerReason)
      results.push(report)
    })
    return results
  }

  /**
   * Get compaction telemetry for /metrics or admin inspection
   */
  getStats() {
    return {
      ...this.stats,
      activeTrackedDocs: this.docMetadata.size,
      updateThreshold: this.updateThreshold,
      intervalMs: this.intervalMs,
    }
  }

  destroy() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
    }
  }
}

module.exports = new CompactionManager()
