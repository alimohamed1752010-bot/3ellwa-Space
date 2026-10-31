-- Append-only audit history for DNS changes made through the admin domain manager.
CREATE TABLE dns_change_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('create','edit','delete')),
  hostname TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('A','AAAA','CNAME')),
  record_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_dns_change_audit_created ON dns_change_audit(created_at DESC);
CREATE INDEX idx_dns_change_audit_hostname ON dns_change_audit(hostname, created_at DESC);
