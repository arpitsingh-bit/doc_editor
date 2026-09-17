const assert = require('assert')
const WebSocket = require('ws')
const { WebsocketProvider } = require('y-websocket')
const Y = require('yjs')

function calculatePercentiles(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const sum = sorted.reduce((a, b) => a + b, 0)
  const avg = sum / sorted.length

  const p50 = sorted[Math.floor(sorted.length * 0.5)]
  const p90 = sorted[Math.floor(sorted.length * 0.9)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]

  return { min, max, avg, p50, p90, p95, p99 }
}

async function runLatencyHarness() {
  console.log('='.repeat(70))
  console.log('STAGE F: SYNC & AWARENESS LATENCY PROFILING HARNESS')
  console.log('='.repeat(70))

  const wsUrl = 'ws://localhost:1234'
  const room = `latency-harness-${Date.now()}`

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
  console.log('✅ Latency test clients connected.')

  // 1. Edit Sync Latency (100 operations)
  console.log('\n[Phase 1] Benchmarking 100 character edit propagation cycles...')
  const textA = docA.getText('text')
  const textB = docB.getText('text')
  const editLatencies = []

  for (let i = 0; i < 100; i++) {
    const char = String.fromCharCode(65 + (i % 26))
    const t0 = performance.now()

    textA.insert(textA.length, char)

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for char ${i}`)), 2000)
      const observer = () => {
        if (textB.length === i + 1) {
          clearTimeout(timeout)
          textB.unobserve(observer)
          const latency = performance.now() - t0
          editLatencies.push(latency)
          resolve()
        }
      }
      if (textB.length === i + 1) {
        clearTimeout(timeout)
        editLatencies.push(performance.now() - t0)
        resolve()
      } else {
        textB.observe(observer)
      }
    })
  }

  const editStats = calculatePercentiles(editLatencies)
  console.log('  --------------------------------------------------')
  console.log(`  Samples:      ${editLatencies.length}`)
  console.log(`  Min Latency:  ${editStats.min.toFixed(2)} ms`)
  console.log(`  Avg Latency:  ${editStats.avg.toFixed(2)} ms`)
  console.log(`  p50 (Median): ${editStats.p50.toFixed(2)} ms`)
  console.log(`  p90:          ${editStats.p90.toFixed(2)} ms`)
  console.log(`  p95:          ${editStats.p95.toFixed(2)} ms`)
  console.log(`  p99:          ${editStats.p99.toFixed(2)} ms`)
  console.log(`  Max Latency:  ${editStats.max.toFixed(2)} ms`)
  console.log('  --------------------------------------------------')

  // 2. Presence & Cursor Awareness Latency (50 operations)
  console.log('\n[Phase 2] Benchmarking 50 presence awareness & cursor cycles...')
  providerA.awareness.setLocalStateField('user', { name: 'Alice' })
  providerB.awareness.setLocalStateField('user', { name: 'Bob' })
  await new Promise((r) => setTimeout(r, 200))

  const awarenessLatencies = []

  for (let i = 0; i < 50; i++) {
    const cursor = { x: 100 + i * 2, y: 200 + i * 3, seq: i }
    const t0 = performance.now()

    providerA.awareness.setLocalStateField('cursor', cursor)

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Awareness timeout on seq ${i}`)), 3000)
      const changeHandler = () => {
        const states = Array.from(providerB.awareness.getStates().values())
        if (states.some((s) => s.cursor && s.cursor.seq === i)) {
          clearTimeout(timeout)
          providerB.awareness.off('change', changeHandler)
          const latency = performance.now() - t0
          awarenessLatencies.push(latency)
          resolve()
        }
      }

      const statesNow = Array.from(providerB.awareness.getStates().values())
      if (statesNow.some((s) => s.cursor && s.cursor.seq === i)) {
        clearTimeout(timeout)
        awarenessLatencies.push(performance.now() - t0)
        resolve()
      } else {
        providerB.awareness.on('change', changeHandler)
      }
    })
  }

  const awarenessStats = calculatePercentiles(awarenessLatencies)
  console.log('  --------------------------------------------------')
  console.log(`  Samples:      ${awarenessLatencies.length}`)
  console.log(`  Min Latency:  ${awarenessStats.min.toFixed(2)} ms`)
  console.log(`  Avg Latency:  ${awarenessStats.avg.toFixed(2)} ms`)
  console.log(`  p50 (Median): ${awarenessStats.p50.toFixed(2)} ms`)
  console.log(`  p95:          ${awarenessStats.p95.toFixed(2)} ms`)
  console.log(`  p99:          ${awarenessStats.p99.toFixed(2)} ms`)
  console.log('  --------------------------------------------------')

  // Assertions against production SLAs
  assert(editStats.p50 < 30, `Edit p50 latency must be < 30ms, got ${editStats.p50}ms`)
  assert(editStats.p95 < 75, `Edit p95 latency must be < 75ms, got ${editStats.p95}ms`)
  assert(awarenessStats.p50 < 30, `Awareness p50 latency must be < 30ms, got ${awarenessStats.p50}ms`)

  console.log('\n✅ ALL LATENCY PERCENTILES SATISFY PRODUCTION SLA THRESHOLDS (< 30ms p50)!')

  // Teardown
  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()

  console.log('='.repeat(70))
  console.log('🎉 STAGE F LATENCY HARNESS COMPLETED SUCCESSFULLY!')
  console.log('='.repeat(70))
  process.exit(0)
}

runLatencyHarness().catch((err) => {
  console.error('❌ Latency harness failed:', err)
  process.exit(1)
})
