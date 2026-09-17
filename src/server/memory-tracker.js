const Y = require('yjs')

/**
 * Memory tracking utility for CRDT documents and Node.js process heap.
 */
class MemoryTracker {
  constructor() {
    this.history = []
  }

  /**
   * Get memory metrics for a given Y.Doc
   * @param {string} docName
   * @param {Y.Doc} doc
   * @param {number} [rawUpdatesByteSize=0] Cumulative size of raw uncompacted update packets
   */
  measureDoc(docName, doc, rawUpdatesByteSize = 0) {
    const compactedBytes = Y.encodeStateAsUpdate(doc).byteLength
    const stateVectorBytes = Y.encodeStateVector(doc).byteLength
    const heap = process.memoryUsage()

    let totalItems = 0
    let deletedItems = 0

    // Inspect internal struct store if available
    if (doc.store && doc.store.clients) {
      doc.store.clients.forEach((items) => {
        totalItems += items.length
        items.forEach((item) => {
          if (item.deleted) deletedItems++
        })
      })
    }

    const uncompactedBytes = rawUpdatesByteSize > 0 ? rawUpdatesByteSize : compactedBytes
    const reductionBytes = Math.max(0, uncompactedBytes - compactedBytes)
    const reductionPercent = uncompactedBytes > 0 ? ((reductionBytes / uncompactedBytes) * 100).toFixed(1) : '0.0'

    return {
      docName,
      timestamp: new Date().toISOString(),
      compactedBytes,
      uncompactedBytes,
      stateVectorBytes,
      reductionBytes,
      reductionPercent: `${reductionPercent}%`,
      structStats: {
        totalItems,
        deletedItems,
        gcEnabled: doc.gc === true,
      },
      processHeap: {
        heapUsedMB: (heap.heapUsed / 1024 / 1024).toFixed(2),
        rssMB: (heap.rss / 1024 / 1024).toFixed(2),
      },
    }
  }

  /**
   * Log compaction report to console
   */
  logReport(report) {
    console.log(
      `[CRDT Compactor] Doc "${report.docName}" compacted: ` +
        `Raw Log: ${report.uncompactedBytes}B -> Compacted: ${report.compactedBytes}B ` +
        `(${report.reductionPercent} reduction) | GC Enabled: ${report.structStats.gcEnabled} | Heap: ${report.processHeap.heapUsedMB}MB`
    )
  }
}

module.exports = new MemoryTracker()
