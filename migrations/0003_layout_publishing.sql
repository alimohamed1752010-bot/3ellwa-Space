-- Part 6 checkpoint 1: persistent homepage layout drafts and global publish history.
INSERT OR IGNORE INTO site_settings (key,draft_json,published_json,version)
VALUES ('homepage_layout','{"sections":[{"id":"profile","type":"profile","title":"","body":"","assetId":null,"widgetId":null,"enabled":true,"visibleDesktop":true,"visibleMobile":true},{"id":"links","type":"links","title":"","body":"","assetId":null,"widgetId":null,"enabled":true,"visibleDesktop":true,"visibleMobile":true}]}','{"sections":[{"id":"profile","type":"profile","title":"","body":"","assetId":null,"widgetId":null,"enabled":true,"visibleDesktop":true,"visibleMobile":true},{"id":"links","type":"links","title":"","body":"","assetId":null,"widgetId":null,"enabled":true,"visibleDesktop":true,"visibleMobile":true}]}',0);
CREATE TABLE IF NOT EXISTS publish_history (
 id TEXT PRIMARY KEY, version INTEGER NOT NULL UNIQUE, summary_json TEXT NOT NULL,
 snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_publish_history_created ON publish_history(created_at DESC);
