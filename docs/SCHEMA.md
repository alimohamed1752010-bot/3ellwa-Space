# SCHEMA
The source of truth is migrations/0001_init.sql. This is the map.

- Auth: sessions, auth_challenges, auth_attempts
- Config: site_settings (key, draft_json, published_json, version), profile_settings (one row), social_links
- Content: link_categories, links, pages, page_sections, projects, project_links, project_gallery, announcements, guestbook_entries
- Customization: themes, theme_settings, navigation_items
- Widgets: widgets, widget_settings, integrations
- Files: media_folders, media_assets
- Analytics: analytics_events
- Domains: domain_records, dns_change_audit

Conventions: TEXT primary keys (random ids), timestamps as ISO text via datetime('now'), booleans as INTEGER 0 or 1, foreign keys on, an index on every foreign key and common sort or filter column. Changes go in new numbered migration files; never edit an applied one.

Part 3 added no tables or migrations. Clicks are analytics_events rows (type link_click, link_id, referrer_host, device, browser, visitor_hash). links.slug and links.password_hash are present but unused until the optional features are built.

Part 4 checkpoint 1 added no tables or migrations. media_folders (flat, parent_id unused), media_assets.width/height/alt_text/folder_id are now filled by the library.


Migration 0004 adds `dns_change_audit`, an append-only record of DNS create/edit/delete operations performed through the admin domain manager. It stores hostname, record type and id, before/after snapshots, and timestamp. It does not include Cloudflare credentials or external changes made outside this dashboard.
