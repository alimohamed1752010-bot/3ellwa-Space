-- 3ellwa.space initial schema. D1 (SQLite). Never edit after applying; add 0002_*.sql instead.
PRAGMA foreign_keys = ON;

-- AUTH (single owner; credential lives in secrets)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  trusted_device INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE auth_attempts (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('password','code')),
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auth_attempts_ip_time ON auth_attempts(ip_hash, created_at);

-- SETTINGS (draft/published, versioned)
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  draft_json TEXT,
  published_json TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MEDIA
CREATE TABLE media_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES media_folders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_media_folders_parent ON media_folders(parent_id);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES media_folders(id) ON DELETE SET NULL,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  kind TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video','icon','other')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_media_assets_folder ON media_assets(folder_id);
CREATE INDEX idx_media_assets_kind ON media_assets(kind);

-- PROFILE (exactly one row, id = 1)
CREATE TABLE profile_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  short_bio TEXT NOT NULL DEFAULT '',
  extended_bio TEXT NOT NULL DEFAULT '',
  subtitle_json TEXT NOT NULL DEFAULT '[]',
  typing_enabled INTEGER NOT NULL DEFAULT 0,
  status_text TEXT NOT NULL DEFAULT '',
  online_mode TEXT NOT NULL DEFAULT 'hidden' CHECK (online_mode IN ('hidden','online','offline','auto')),
  location_text TEXT NOT NULL DEFAULT '',
  show_location INTEGER NOT NULL DEFAULT 0,
  timezone TEXT,
  show_local_time INTEGER NOT NULL DEFAULT 0,
  avatar_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  banner_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  badges_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO profile_settings (id) VALUES (1);

CREATE TABLE social_links (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_social_links_order ON social_links(sort_order);

-- LINKS
CREATE TABLE link_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES link_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  icon TEXT,
  image_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  color TEXT,
  background TEXT,
  badge TEXT,
  hover_animation TEXT,
  open_new_tab INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT,
  publish_at TEXT,
  expires_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_links_category ON links(category_id, sort_order);
CREATE INDEX idx_links_visible ON links(visible, enabled);

-- PAGES AND SECTIONS (homepage is the page with is_home = 1)
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  is_home INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hidden','password')),
  password_hash TEXT,
  meta_title TEXT,
  meta_description TEXT,
  og_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  canonical_url TEXT,
  indexable INTEGER NOT NULL DEFAULT 0,
  layout_json TEXT NOT NULL DEFAULT '{}',
  draft_layout_json TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX idx_pages_status ON pages(status, visibility);

CREATE TABLE page_sections (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible_desktop INTEGER NOT NULL DEFAULT 1,
  visible_mobile INTEGER NOT NULL DEFAULT 1,
  draft_json TEXT,
  published_json TEXT,
  deleted_in_draft INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_page_sections_page ON page_sections(page_id, sort_order);

CREATE TABLE navigation_items (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES navigation_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('page','url')),
  page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  url TEXT,
  open_new_tab INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_nav_order ON navigation_items(parent_id, sort_order);
CREATE INDEX idx_nav_page ON navigation_items(page_id);

-- PROJECTS
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  cover_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  website_url TEXT,
  github_url TEXT,
  technologies_json TEXT NOT NULL DEFAULT '[]',
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('idea','active','paused','finished','archived')),
  started_on TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_visible ON projects(visible, sort_order);

CREATE TABLE project_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_project_links_project ON project_links(project_id, sort_order);

CREATE TABLE project_gallery (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_project_gallery_project ON project_gallery(project_id, sort_order);

-- THEMES
CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_preset INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 0,
  tokens_json TEXT NOT NULL DEFAULT '{}',
  draft_tokens_json TEXT,
  custom_css TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_themes_one_active ON themes(is_active) WHERE is_active = 1;

CREATE TABLE theme_settings (
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (theme_id, key)
);

-- WIDGETS AND INTEGRATIONS
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  credentials_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('unconfigured','ok','error')),
  last_checked_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE widgets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  integration_id TEXT REFERENCES integrations(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  display_mode TEXT NOT NULL DEFAULT 'card',
  visible_desktop INTEGER NOT NULL DEFAULT 1,
  visible_mobile INTEGER NOT NULL DEFAULT 1,
  style_json TEXT NOT NULL DEFAULT '{}',
  refresh_seconds INTEGER NOT NULL DEFAULT 300,
  cache_json TEXT,
  cache_updated_at TEXT,
  last_error TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_widgets_integration ON widgets(integration_id);
CREATE INDEX idx_widgets_enabled ON widgets(enabled, sort_order);

CREATE TABLE widget_settings (
  widget_id TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (widget_id, key)
);

-- CONTENT EXTRAS
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  style TEXT NOT NULL DEFAULT 'info',
  visible INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE guestbook_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_guestbook_status ON guestbook_entries(status, created_at);

-- ANALYTICS
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('pageview','link_click')),
  path TEXT,
  link_id TEXT REFERENCES links(id) ON DELETE SET NULL,
  referrer_host TEXT,
  device TEXT,
  browser TEXT,
  visitor_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_time ON analytics_events(created_at);
CREATE INDEX idx_events_type_time ON analytics_events(type, created_at);
CREATE INDEX idx_events_link ON analytics_events(link_id);

-- DOMAINS (used in Part 10)
CREATE TABLE domain_records (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  record_type TEXT,
  destination TEXT,
  cloudflare_record_id TEXT,
  status TEXT,
  notes TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
