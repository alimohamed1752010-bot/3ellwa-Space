// Where an uploaded file is used, so the library can warn before deleting it.
// Page and section content store asset ids inside JSON, so those are found by searching the JSON text for the id (ids are random 24-char strings).
export interface Usage { type: "profile" | "link" | "page" | "project" | "gallery" | "section"; label: string; id?: string }

/** SQL fragment: number of places an asset (alias a) is used. */
export const USED_COUNT_SQL = `(
  (SELECT COUNT(*) FROM profile_settings WHERE avatar_asset_id = a.id OR banner_asset_id = a.id)
  + (SELECT COUNT(*) FROM links WHERE image_asset_id = a.id)
  + (SELECT COUNT(*) FROM pages WHERE og_asset_id = a.id)
  + (SELECT COUNT(*) FROM projects WHERE logo_asset_id = a.id OR cover_asset_id = a.id)
  + (SELECT COUNT(*) FROM project_gallery WHERE asset_id = a.id)
  + (SELECT COUNT(*) FROM page_sections WHERE INSTR(COALESCE(draft_json, '') || COALESCE(published_json, ''), a.id) > 0)
)`;

export async function assetUsage(db: D1Database, id: string): Promise<Usage[]> {
  const out: Usage[] = [];
  const [prof, links, pages, projects, gallery, sections] = await db.batch([
    db.prepare("SELECT avatar_asset_id, banner_asset_id FROM profile_settings WHERE avatar_asset_id = ?1 OR banner_asset_id = ?1"),
    db.prepare("SELECT id, title FROM links WHERE image_asset_id = ?1"),
    db.prepare("SELECT id, title FROM pages WHERE og_asset_id = ?1"),
    db.prepare("SELECT id, name, logo_asset_id FROM projects WHERE logo_asset_id = ?1 OR cover_asset_id = ?1"),
    db.prepare("SELECT g.id, p.id AS pid, p.name FROM project_gallery g JOIN projects p ON p.id = g.project_id WHERE g.asset_id = ?1"),
    db.prepare("SELECT s.id, s.type, p.id AS pid, p.title FROM page_sections s JOIN pages p ON p.id = s.page_id WHERE INSTR(COALESCE(s.draft_json, '') || COALESCE(s.published_json, ''), ?1) > 0"),
  ].map((st) => st.bind(id)));
  for (const r of prof.results as { avatar_asset_id: string | null; banner_asset_id: string | null }[]) {
    if (r.avatar_asset_id === id) out.push({ type: "profile", label: "Profile avatar" });
    if (r.banner_asset_id === id) out.push({ type: "profile", label: "Profile banner" });
  }
  for (const r of links.results as { id: string; title: string }[]) out.push({ type: "link", label: `Link: ${r.title}`, id: r.id });
  for (const r of pages.results as { id: string; title: string }[]) out.push({ type: "page", label: `Page image: ${r.title}`, id: r.id });
  for (const r of projects.results as { id: string; name: string }[]) out.push({ type: "project", label: `Project: ${r.name}`, id: r.id });
  for (const r of gallery.results as { pid: string; name: string }[]) out.push({ type: "gallery", label: `Project gallery: ${r.name}`, id: r.pid });
  for (const r of sections.results as { pid: string; type: string; title: string }[]) out.push({ type: "section", label: `Page "${r.title}" (${r.type} block)`, id: r.pid });
  return out;
}
