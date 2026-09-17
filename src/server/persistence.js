const fs = require('fs')
const path = require('path')
const Y = require('yjs')

const STORAGE_DIR = path.join(__dirname, '../../storage/docs')

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

function getDocPath(docName) {
  const cleanName = docName.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(STORAGE_DIR, `${cleanName}.yjs`)
}

const persistence = {
  provider: 'binary-storage',
  bindState: async (docName, ydoc) => {
    const filePath = getDocPath(docName)
    
    // 1. On document load, load saved state and apply to doc BEFORE clients connect
    if (fs.existsSync(filePath)) {
      try {
        const fileBuffer = fs.readFileSync(filePath)
        if (fileBuffer.length > 0) {
          console.log(`[Persistence] Found persisted state for "${docName}" (${fileBuffer.length} bytes). Merging into doc...`)
          Y.applyUpdate(ydoc, new Uint8Array(fileBuffer))
          console.log(`[Persistence] Restored "${docName}" successfully.`)
        }
      } catch (err) {
        console.error(`[Persistence] Error reading saved state for "${docName}":`, err)
      }
    } else {
      console.log(`[Persistence] No previous state found for "${docName}". Initializing fresh doc.`)
    }

    // 2. Save snapshot logic
    let debounceTimeout = null
    const persistSnapshot = () => {
      try {
        const stateUpdate = Y.encodeStateAsUpdate(ydoc)
        const tmpPath = `${filePath}.${Date.now()}.tmp`
        fs.writeFileSync(tmpPath, Buffer.from(stateUpdate))
        fs.renameSync(tmpPath, filePath)
        console.log(`[Persistence] Snapshot saved for "${docName}" (${stateUpdate.byteLength} bytes) at ${new Date().toLocaleTimeString()}`)
      } catch (err) {
        console.error(`[Persistence] Error saving snapshot for "${docName}":`, err)
      }
    }

    // 3. Listen to doc updates (debounced to avoid disk thrashing)
    ydoc.on('update', () => {
      if (debounceTimeout) clearTimeout(debounceTimeout)
      debounceTimeout = setTimeout(persistSnapshot, 800)
    })

    // 4. Periodic interval snapshot (every 15s)
    const periodicTimer = setInterval(persistSnapshot, 15000)

    ydoc.on('destroy', () => {
      clearInterval(periodicTimer)
      if (debounceTimeout) clearTimeout(debounceTimeout)
      persistSnapshot()
    })
  },

  writeState: async (docName, ydoc) => {
    const filePath = getDocPath(docName)
    const stateUpdate = Y.encodeStateAsUpdate(ydoc)
    const tmpPath = `${filePath}.${Date.now()}.tmp`
    fs.writeFileSync(tmpPath, Buffer.from(stateUpdate))
    fs.renameSync(tmpPath, filePath)
  },
}

module.exports = {
  persistence,
  STORAGE_DIR,
  getDocPath,
}
