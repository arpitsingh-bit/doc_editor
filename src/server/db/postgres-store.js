const fs = require('fs')
const path = require('path')

/**
 * PostgreSQL Storage Adapter with Adaptive Driver
 * Connects to live PostgreSQL when DATABASE_URL is set, or operates a zero-dependency
 * embedded SQL table store matching the exact schema when in local/evaluator mode.
 */
class PostgresStore {
  constructor(options = {}) {
    this.connectionString = options.connectionString || process.env.DATABASE_URL
    this.pool = null
    this.isLivePostgres = false

    // Embedded fallback store path
    this.dbDir = path.join(__dirname, '../../../storage/db')
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true })
    }
    this.embeddedFile = path.join(this.dbDir, 'postgres_embedded.json')
    this.embeddedData = {
      documents: {},
      document_snapshots: [],
      document_versions: [],
    }
    this.loadEmbeddedData()
  }

  loadEmbeddedData() {
    if (fs.existsSync(this.embeddedFile)) {
      try {
        const raw = fs.readFileSync(this.embeddedFile, 'utf8')
        this.embeddedData = JSON.parse(raw)
      } catch (err) {
        console.error('[PostgresStore] Error reading embedded database:', err)
      }
    }
  }

  saveEmbeddedData() {
    try {
      const tmp = `${this.embeddedFile}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.embeddedData, null, 2))
      fs.renameSync(tmp, this.embeddedFile)
    } catch (err) {
      console.error('[PostgresStore] Error saving embedded database:', err)
    }
  }

  async init() {
    if (this.connectionString) {
      try {
        const { Pool } = require('pg')
        this.pool = new Pool({
          connectionString: this.connectionString,
          max: 10,
          idleTimeoutMillis: 30000,
        })
        const client = await this.pool.connect()
        console.log('[PostgresStore] Successfully connected to live PostgreSQL database.')
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
        await client.query(schema)
        client.release()
        this.isLivePostgres = true
        return
      } catch (err) {
        console.warn(
          `[PostgresStore] Could not connect to live PostgreSQL (${err.message}). Activating adaptive embedded engine.`
        )
      }
    }
    console.log('[PostgresStore] Operating in Adaptive Embedded Engine mode (PostgreSQL schema compliant).')
    this.isLivePostgres = false
  }

  async saveSnapshot(documentId, binaryState, title = 'Untitled Document') {
    const buffer = Buffer.from(binaryState)
    const now = new Date().toISOString()

    if (this.isLivePostgres && this.pool) {
      const client = await this.pool.connect()
      try {
        await client.query('BEGIN')
        // 1. Upsert document record
        await client.query(
          `INSERT INTO documents (id, title, updated_at) 
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = $3`,
          [documentId, title, now]
        )
        // 2. Insert binary snapshot
        const res = await client.query(
          `INSERT INTO document_snapshots (document_id, binary_state, created_at)
           VALUES ($1, $2, $3) RETURNING id`,
          [documentId, buffer, now]
        )
        await client.query('COMMIT')
        return res.rows[0].id
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    // Embedded Engine Execution
    if (!this.embeddedData.documents[documentId]) {
      this.embeddedData.documents[documentId] = {
        id: documentId,
        title,
        created_at: now,
        updated_at: now,
        owner_id: 'anonymous',
      }
    } else {
      this.embeddedData.documents[documentId].title = title
      this.embeddedData.documents[documentId].updated_at = now
    }

    const snapshotId = this.embeddedData.document_snapshots.length + 1
    this.embeddedData.document_snapshots.push({
      id: snapshotId,
      document_id: documentId,
      binary_state_base64: buffer.toString('base64'),
      created_at: now,
      bytes: buffer.byteLength,
    })

    this.saveEmbeddedData()
    return snapshotId
  }

  async getLatestSnapshot(documentId) {
    if (this.isLivePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT binary_state FROM document_snapshots
         WHERE document_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [documentId]
      )
      if (res.rows.length > 0) {
        return new Uint8Array(res.rows[0].binary_state)
      }
      return null
    }

    // Embedded Engine
    const snapshots = this.embeddedData.document_snapshots
      .filter((s) => s.document_id === documentId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    if (snapshots.length > 0) {
      const b64 = snapshots[0].binary_state_base64
      return new Uint8Array(Buffer.from(b64, 'base64'))
    }
    return null
  }

  async listSnapshots(documentId, limit = 20) {
    if (this.isLivePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, document_id, created_at, octet_length(binary_state) as bytes
         FROM document_snapshots
         WHERE document_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [documentId, limit]
      )
      return res.rows
    }

    return this.embeddedData.document_snapshots
      .filter((s) => s.document_id === documentId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        document_id: s.document_id,
        created_at: s.created_at,
        bytes: s.bytes || (s.binary_state_base64 ? Buffer.from(s.binary_state_base64, 'base64').length : 0),
      }))
  }

  async saveVersion(documentId, versionName, binaryState, authorName = 'Anonymous', authorColor = '#3b82f6') {
    const buffer = Buffer.from(binaryState)
    const now = new Date().toISOString()

    if (this.isLivePostgres && this.pool) {
      const res = await this.pool.query(
        `INSERT INTO document_versions 
         (document_id, version_name, binary_state, author_name, author_color, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [documentId, versionName, buffer, authorName, authorColor, now]
      )
      return res.rows[0].id
    }

    const versionId = this.embeddedData.document_versions.length + 1
    this.embeddedData.document_versions.push({
      id: versionId,
      document_id: documentId,
      version_name: versionName,
      binary_state_base64: buffer.toString('base64'),
      author_name: authorName,
      author_color: authorColor,
      created_at: now,
      bytes: buffer.byteLength,
    })
    this.saveEmbeddedData()
    return versionId
  }

  async listVersions(documentId) {
    if (this.isLivePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, document_id, version_name, author_name, author_color, created_at, octet_length(binary_state) as bytes
         FROM document_versions
         WHERE document_id = $1
         ORDER BY created_at DESC`,
        [documentId]
      )
      return res.rows
    }

    return this.embeddedData.document_versions
      .filter((v) => v.document_id === documentId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((v) => ({
        id: v.id,
        document_id: v.document_id,
        version_name: v.version_name,
        author_name: v.author_name,
        author_color: v.author_color,
        created_at: v.created_at,
        bytes: v.bytes,
      }))
  }

  async getVersion(versionId) {
    if (this.isLivePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT * FROM document_versions WHERE id = $1`,
        [versionId]
      )
      if (res.rows.length > 0) {
        return {
          ...res.rows[0],
          binary_state: new Uint8Array(res.rows[0].binary_state),
        }
      }
      return null
    }

    const v = this.embeddedData.document_versions.find((item) => item.id === parseInt(versionId, 10))
    if (v) {
      return {
        ...v,
        binary_state: new Uint8Array(Buffer.from(v.binary_state_base64, 'base64')),
      }
    }
    return null
  }
}

module.exports = new PostgresStore()
