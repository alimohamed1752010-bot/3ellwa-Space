-- Short-lived, one-use pairing codes for the separate 3ellwa.space MCP bridge.
CREATE TABLE mcp_pairings (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX idx_mcp_pairings_expiry ON mcp_pairings(expires_at);
