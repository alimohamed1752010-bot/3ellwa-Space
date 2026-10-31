// Admin navigation. "part" says which build part delivers the real screen (see prompts/README.md).
export interface NavItem { to: string; label: string; part: number; blurb: string }

export const NAV: NavItem[] = [
  { to: "", label: "Overview", part: 8, blurb: "Visitors, clicks, status, and quick actions." },
  { to: "profile", label: "Profile", part: 2.5, blurb: "Avatar, banner, name, bio, status, and social links." },
  { to: "links", label: "Links", part: 3, blurb: "Create, order, schedule, and track your links." },
  { to: "pages", label: "Pages", part: 4, blurb: "Create pages and edit them with the block editor." },
  { to: "layout", label: "Layout", part: 6, blurb: "Arrange homepage sections, preview devices, and publish drafts." },
  { to: "widgets", label: "Widgets", part: 7, blurb: "Create and configure reusable homepage widgets." },
  { to: "projects", label: "Projects", part: 4, blurb: "Manage the projects shown on your site." },
  { to: "integrations", label: "Integrations", part: 7, blurb: "Connect Spotify, Discord, Steam, GitHub, and more." },
  { to: "appearance", label: "Appearance", part: 5, blurb: "Themes, colors, typography, and animation." },
  { to: "navigation", label: "Navigation", part: 2.5, blurb: "Choose and order the menu of your public site." },
  { to: "media", label: "Media Library", part: 4, blurb: "Upload and organize images, video, and icons." },
  { to: "analytics", label: "Analytics", part: 8, blurb: "Privacy-friendly traffic and link statistics." },
  { to: "guestbook", label: "Guestbook", part: 8, blurb: "Review and moderate visitor messages." },
  { to: "announcements", label: "Announcements", part: 8, blurb: "Publish timed notices across the public site." },
  { to: "domains", label: "Domains", part: 10, blurb: "Subdomains and DNS status." },
  { to: "seo-privacy", label: "SEO & Privacy", part: 8, blurb: "Indexing, metadata, robots, and privacy controls." },
  { to: "settings", label: "Settings", part: 8, blurb: "Site-wide settings and maintenance mode." },
];
