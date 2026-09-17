-- =============================================================================
-- PostgreSQL Schema for Collaborative Document Editor
-- Tier: Production Persistence
-- =============================================================================

-- 1. Documents Metadata Table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id TEXT DEFAULT 'anonymous'
);

-- 2. Document Snapshots Table (Durable Binary Snapshots)
CREATE TABLE IF NOT EXISTS document_snapshots (
  id SERIAL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  binary_state BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for sub-millisecond retrieval of the latest document snapshot
CREATE INDEX IF NOT EXISTS idx_snapshots_doc_created 
  ON document_snapshots(document_id, created_at DESC);

-- 3. Document Versions Table (Stage D Time-Travel Audit Trail)
CREATE TABLE IF NOT EXISTS document_versions (
  id SERIAL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  binary_state BYTEA NOT NULL,
  author_name TEXT DEFAULT 'Anonymous',
  author_color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versions_doc_created 
  ON document_versions(document_id, created_at DESC);
