# PROJECT MASTER PROMPT: 3ELLWA.SPACE
## A Fully Customizable Personal Digital Headquarters

You are a senior full-stack developer, UI/UX designer, software architect, and product engineer.

Your task is to design and build a complete, production-ready personal website and content management system hosted at:

**https://3ellwa.space**

This is not a business website, SaaS product, social network, or multi-user platform.

It is a personal digital headquarters belonging to one person: 3ellwa.

The concept is inspired by Noiz.bio, but the objective is to create an independently owned, self-hosted, significantly customizable alternative with a powerful built-in administration system.

The website should combine:
- A premium personal profile.
- An advanced links manager.
- A customizable personal homepage.
- A widget ecosystem.
- A personal projects showcase.
- A collection of interactive pages.
- A comprehensive visual customization studio.
- A full-featured private administration dashboard.

The owner should be able to manage virtually everything through the website itself without manually editing source code.

---

# 1. CORE PHILOSOPHY

The entire project must follow these principles:

1. One owner, unlimited customization.
2. No unnecessary user registration or multi-user functionality.
3. Everything configurable through the admin dashboard.
4. No hardcoded personal information, links, projects, or widget settings.
5. All content and settings must persist in a database.
6. Changes made through the admin panel should immediately affect the public website without requiring redeployment.
7. The website must remain modular and extensible.
8. Avoid unnecessary paid services and subscriptions.
9. All features must be functional, not decorative placeholders.
10. Prioritize performance, security, maintainability, and mobile responsiveness.

The owner must not need to open a code editor to:
- Add or remove links.
- Change profile information.
- Upload images.
- Change the website theme.
- Rearrange homepage sections.
- Configure widgets.
- Add projects.
- Create pages.
- Change navigation.
- Modify animations.
- Manage integrations.
- Update domain configurations where supported.

---

# 2. VISUAL IDENTITY AND DESIGN LANGUAGE

Create a premium, modern, dark-first interface.

The design should feel personal, sophisticated, futuristic, minimal, and highly polished.

Suggested visual direction:
- Deep black and charcoal backgrounds.
- Dark graphite surfaces.
- Restrained purple and violet accents.
- Subtle gradients.
- Glass-like translucent cards.
- Soft shadows.
- Thin borders.
- Smooth animations.
- Carefully selected typography.
- Consistent spacing.
- Rounded but not excessively rounded components.

Avoid:
- Generic SaaS dashboard aesthetics.
- Excessive gradients.
- Excessive neon.
- Overcrowded interfaces.
- Giant unnecessary headings.
- Generic templates.
- Excessive glassmorphism.
- Unnecessary decorative elements.

The design must look intentionally crafted rather than AI-generated.

Support:
- Desktop.
- Tablet.
- Mobile.
- Different screen sizes.
- Touch interactions.
- Responsive layouts.

Provide independent mobile and desktop layout settings wherever practical.

---

# 3. PUBLIC WEBSITE

The public homepage should act as the central identity page.

## Profile section

Support:
- Profile picture/avatar.
- Custom banner.
- Display name.
- Username.
- Short biography.
- Extended biography.
- Animated subtitle.
- Typing text effects.
- Custom status.
- Online/offline indicator.
- Location text, optionally.
- Local time.
- Social media icons.
- Verified/custom badges.
- Custom profile links.

Every field must be editable through the admin dashboard.

## Homepage sections

Allow the owner to add, remove, reorder, hide, duplicate, and configure sections.

Possible sections:

- Profile.
- Social links.
- Featured links.
- Projects.
- Currently playing.
- Currently listening.
- Gaming activity.
- Recent activity.
- Favorite games.
- Favorite anime.
- Favorite music.
- Personal interests.
- PC specifications.
- Announcements.
- Featured widgets.
- Custom text.
- Custom HTML embeds.
- Visitor guestbook.
- Personal timeline.
- Changelog.
- Custom galleries.

Sections should support configurable layouts, spacing, backgrounds, visibility, and responsive behavior.

---

# 4. ADVANCED LINKS MANAGER

This is one of the project's primary features.

Build a complete link-management system.

Each link should support:

- Title.
- URL.
- Description.
- Icon.
- Custom image.
- Category.
- Custom color.
- Background.
- Display order.
- Featured status.
- Visibility.
- Open in new tab.
- Hover animation.
- Custom badge.
- Creation date.
- Optional expiration date.

Required management operations:

- Create links.
- Edit links.
- Delete links.
- Duplicate links.
- Reorder links using drag and drop.
- Group links into categories.
- Enable/disable links.
- Hide links from public view.
- Schedule links.
- Generate QR codes.
- Copy URLs.
- Track clicks.
- View click statistics.
- Bulk edit.
- Search and filter.
- Import and export links.

Optional advanced features:

- Password-protected destinations.
- Temporary links.
- Custom redirect routes.
- Link preview cards.
- Custom confirmation pages.
- Scheduled publishing.
- Custom click-tracking settings.

The link manager must be completely independent of the website's source code.

---

# 5. WIDGET ECOSYSTEM

Build a modular widget system.

Widgets must be independently configurable.

Every widget should support:
- Enable/disable.
- Configuration.
- Position.
- Display mode.
- Visibility.
- Size where applicable.
- Custom styling.
- Refresh settings.
- Error and loading states.

## Supported widget ideas

### Spotify
- Currently playing track.
- Album artwork.
- Artist.
- Track title.
- Listening status.
- Recently played tracks.
- Optional playlists.

### Discord
- Avatar.
- Username.
- Custom status.
- Online/offline status.
- Current activity.
- Connected account information.

### Steam
- Profile information.
- Recently played games.
- Playtime.
- Game achievements where available.
- Current game.
- Featured games.

### GitHub
- Profile information.
- Public repositories.
- Contributions.
- Recent activity.
- Featured projects.

### Gaming
- Minecraft server status.
- RealmFall server information.
- Online player count.
- Server uptime.
- Featured games.
- Gaming activity.

### Other integrations
- YouTube.
- Twitch.
- Last.fm.
- AniList.
- Letterboxd.
- Weather.
- Local clock.
- Countdown.
- Random quotes.
- Custom API widgets.
- Custom embeds.

Use official APIs and supported integrations wherever possible.

Do not fake live data.

All API credentials must be securely stored server-side and configurable through the administration interface.

---

# 6. PERSONAL PAGES SYSTEM

Create an editable page-management system.

Suggested routes:

- / : Homepage.
- /links : Complete links directory.
- /about : Personal information.
- /projects : Projects showcase.
- /setup : PC and gaming setup.
- /activity : Current and recent activity.
- /favorites : Personal favorites.
- /guestbook : Visitor messages.
- /now : Current activities.
- /changelog : Website updates.

The owner must be able to:

- Create pages.
- Edit pages.
- Delete pages.
- Duplicate pages.
- Change page URLs.
- Configure page metadata.
- Set page visibility.
- Reorder navigation.
- Create custom page layouts.
- Add sections to individual pages.

Support a reusable section/block editor.

Do not require the owner to write HTML to create ordinary pages.

---

# 7. CUSTOMIZATION STUDIO

This is a core feature, not an afterthought.

Build a visual customization interface with live preview.

## Appearance controls

Allow configuration of:

- Primary color.
- Secondary color.
- Accent color.
- Background color.
- Background gradients.
- Background images.
- Background videos.
- Card backgrounds.
- Card borders.
- Border radius.
- Shadows.
- Blur.
- Typography.
- Font families.
- Font sizes.
- Font weights.
- Line heights.
- Spacing.
- Container width.
- Alignment.
- Layout density.

## Animation controls

Allow configuration of:

- Page transitions.
- Card hover animations.
- Background animations.
- Floating particles.
- Typing effects.
- Cursor effects.
- Loading animations.
- Scroll animations.
- Animation duration.
- Animation intensity.

Respect reduced-motion accessibility preferences.

## Theme management

Support:
- Multiple saved themes.
- Theme presets.
- Create custom themes.
- Duplicate themes.
- Rename themes.
- Delete themes.
- Import/export themes.
- Live theme preview.
- Reset to defaults.

## Layout editor

Provide a visual layout editor with:
- Drag and drop.
- Section ordering.
- Widget positioning.
- Visibility controls.
- Desktop preview.
- Mobile preview.
- Live updates.
- Undo.
- Redo.
- Draft saving.
- Publish changes.

Optional advanced CSS editor, but ordinary customization must never depend on it.

---

# 8. ADMINISTRATION DASHBOARD

Build a dedicated, private admin interface.

Suggested route:

/admin

The dashboard should have a polished design consistent with the public website.

## Navigation

- Overview.
- Profile.
- Links.
- Pages.
- Widgets.
- Projects.
- Integrations.
- Appearance.
- Navigation.
- Media Library.
- Analytics.
- Domains.
- SEO & Privacy.
- Settings.

## Overview dashboard

Display:
- Total visitors.
- Page views.
- Link clicks.
- Most popular links.
- Recently modified content.
- Active integrations.
- Widget status.
- Website status.
- Quick actions.

## Content management

Every content-management section must support:

- Create.
- Read.
- Update.
- Delete.
- Duplicate.
- Search.
- Filter.
- Sort.
- Reorder.
- Visibility controls.

The dashboard must provide useful feedback for saving, publishing, errors, and failed operations.

Avoid fake buttons and nonfunctional interface elements.

---

# 9. MEDIA LIBRARY

Create an integrated asset manager.

Features:
- Upload images.
- Upload videos.
- Upload icons.
- Upload banners.
- Upload backgrounds.
- Organize files into folders.
- Rename files.
- Replace assets.
- Delete assets.
- Preview files.
- Search files.
- Reuse assets across pages.
- Image cropping.
- Image compression.
- File-size information.
- File-type validation.

Store assets in Cloudflare R2 or another suitable storage provider.

---

# 10. PROJECTS SHOWCASE

Create a complete project manager.

Each project should support:

- Project name.
- Description.
- Logo.
- Cover image.
- Gallery.
- Website URL.
- GitHub repository.
- Technologies.
- Project category.
- Status.
- Start date.
- Last updated.
- Featured status.
- Custom links.

Example projects may include:

- Kardivo.
- RealmFall.
- JARVIS.
- Future experiments.

These are examples, not permanent hardcoded entries.

The owner must manage all projects through the dashboard.

---

# 11. INTERACTIVE FEATURES AND EXTRAS

Implement optional features that can be enabled or disabled.

Ideas:

- Interactive terminal.
- Secret pages.
- Easter eggs.
- Konami code.
- Custom music player.
- Custom sound effects.
- Keyboard shortcuts.
- Animated loading screens.
- Custom cursor.
- Interactive timeline.
- Achievement wall.
- Visitor guestbook.
- Random greetings.
- Visitor counter.
- Custom error pages.
- Custom maintenance page.
- Countdown timers.
- Custom galleries.
- Seasonal themes.
- Custom social sharing cards.

Every feature should have its own configuration settings.

---

# 12. PRIVACY AND SEO

The website is personal and should not be optimized for search-engine discovery by default.

Implement:

- Global noindex setting enabled by default.
- Per-page indexing settings.
- Configurable robots.txt.
- Configurable sitemap behavior.
- Metadata management.
- Open Graph metadata.
- Social sharing previews.
- Custom favicon.
- Canonical URL configuration.

Important:

Noindex is not authentication.

Private content must use actual access controls.

Allow:
- Hiding pages.
- Hiding widgets.
- Hiding links.
- Password-protected sections.
- Disabling public analytics.
- Disabling guestbook.
- Disabling visitor counters.

Do not expose private API keys or administrative data to the public frontend.

---

# 13. DOMAIN AND SUBDOMAIN ECOSYSTEM

The main domain is:

3ellwa.space

The website should support a personal domain ecosystem.

Potential subdomains:

- realmfall.3ellwa.space
- api.3ellwa.space
- status.3ellwa.space
- lab.3ellwa.space
- files.3ellwa.space
- play.3ellwa.space

Build a domain-management section that can:

- Display known subdomains.
- Show configured destinations.
- Show DNS status.
- Manage supported DNS records.
- Display connection status.
- Provide setup instructions.
- Check configuration where technically possible.

Integrate with the Cloudflare API where appropriate.

Never expose Cloudflare API tokens to the frontend.

Subdomains should be independent services when necessary, not necessarily pages served by the main application.

---

# 14. ANALYTICS

Build lightweight, privacy-conscious analytics.

Track configurable metrics:

- Visitors.
- Page views.
- Link clicks.
- Popular pages.
- Popular links.
- Referral sources.
- Device categories.
- Browser categories.
- Traffic trends.

Include:
- Date filters.
- Charts.
- Top-performing content.
- Export options.
- Analytics enable/disable.
- Data retention controls.

Avoid unnecessary invasive tracking.

---

# 15. TECHNICAL ARCHITECTURE

Prefer a Cloudflare-first architecture to minimize hosting expenses.

Suggested stack:

Frontend:
- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- A consistent reusable component system.

Backend:
- Cloudflare Workers.
- TypeScript API endpoints.

Database:
- Cloudflare D1.
- Proper relational schema.
- Migrations.
- Indexed queries.
- Foreign-key constraints where appropriate.

Storage:
- Cloudflare R2.

Hosting:
- Cloudflare Pages or an equivalent supported deployment architecture.

DNS:
- Cloudflare DNS.

Use a clean, modular project structure.

Separate:
- Public frontend.
- Admin frontend.
- Backend API.
- Database operations.
- Authentication.
- Integrations.
- Widget components.
- Theme system.
- Media handling.

Do not put everything in one giant component or file.

---

# 16. DATABASE DESIGN

Design a proper database schema.

Suggested entities:

- admin_users.
- profile_settings.
- links.
- link_categories.
- pages.
- page_sections.
- widgets.
- widget_settings.
- projects.
- integrations.
- themes.
- theme_settings.
- navigation_items.
- media_assets.
- analytics_events.
- announcements.
- guestbook_entries.
- domain_records.
- site_settings.

Use appropriate relationships and constraints.

The database must support the entire admin-management workflow.

Avoid storing all website content in one unstructured JSON field.

JSON may be used for flexible widget configuration or theme settings where appropriate, but core entities should have proper schemas.

---

# 17. SECURITY

Security is mandatory.

Implement:

- Secure admin authentication.
- Password hashing.
- Session management.
- Secure cookies.
- CSRF protection where applicable.
- Input validation.
- Output escaping.
- SQL injection prevention.
- Rate limiting.
- API authorization.
- Secure secret storage.
- File-upload validation.
- Access controls.
- Safe redirects.
- Protection against unauthorized administrative operations.

There must be exactly one intended administrator.

Do not create public registration.

Do not expose administrative routes or sensitive configuration to visitors.

---

# 18. PERFORMANCE AND ACCESSIBILITY

The website must:

- Load quickly.
- Use optimized images.
- Lazy-load suitable assets.
- Avoid unnecessary API calls.
- Cache appropriate public data.
- Handle unavailable integrations gracefully.
- Support mobile devices.
- Support keyboard navigation.
- Include accessible labels.
- Respect reduced-motion settings.
- Avoid layout shifts.
- Handle empty states.
- Handle API failures.
- Provide useful loading indicators.

Do not sacrifice performance for unnecessary animations.

---

# 19. CONFIGURATION-FIRST DEVELOPMENT

THIS IS ONE OF THE MOST IMPORTANT REQUIREMENTS.

The website must be configuration-driven.

Every ordinary website feature should read its configuration from persistent storage.

Examples:

Changing the profile picture should update the homepage.

Adding a link should update the links section.

Changing the theme should update the entire website.

Disabling a widget should remove it from the public layout.

Reordering sections should change their display order.

Creating a page should make it available through navigation when configured.

Changing the homepage layout should not require redeployment.

Implement a central settings/configuration system with:

- Persistent storage.
- Validation.
- Defaults.
- Versioning where appropriate.
- Safe updates.
- Live refresh.
- Draft and published states.

Do not require code modifications for routine content or design management.

---

# 20. DEVELOPMENT WORKFLOW

Do not immediately generate a giant collection of disconnected files.

Follow a structured implementation process.

Phase 1: Architecture
- Inspect the existing repository if one exists.
- Define the architecture.
- Define database schemas.
- Define API contracts.
- Define the component system.
- Identify external dependencies.

Phase 2: Foundation
- Set up the frontend.
- Set up Cloudflare integration.
- Configure D1.
- Configure R2.
- Implement authentication.
- Implement the public/admin separation.

Phase 3: Core management
- Profile management.
- Links manager.
- Pages manager.
- Projects manager.
- Navigation manager.
- Media library.

Phase 4: Customization
- Theme engine.
- Appearance editor.
- Layout editor.
- Animation controls.
- Live preview.

Phase 5: Integrations
- Spotify.
- Discord.
- Steam.
- GitHub.
- Minecraft server information.
- Other supported widgets.

Phase 6: Advanced functionality
- Analytics.
- Guestbook.
- Interactive extras.
- Domain management.
- Privacy controls.

Phase 7: Testing and deployment
- Test every CRUD operation.
- Test database persistence.
- Test authentication.
- Test mobile layouts.
- Test all integrations.
- Test failure states.
- Test security.
- Deploy to Cloudflare.

Do not claim a feature is complete until it has actually been implemented and tested.

---

# 21. FINAL ACCEPTANCE CRITERIA

The project is not complete until all of the following are true:

1. The public website works.
2. The admin dashboard works.
3. The owner can log in securely.
4. All content can be managed without code editing.
5. All settings persist after refresh and redeployment.
6. Links can be created, edited, reordered, and deleted.
7. Pages can be created and managed.
8. Projects can be managed.
9. Themes can be customized and saved.
10. Widgets can be configured and enabled/disabled.
11. Media uploads work.
12. Mobile layouts work.
13. Privacy settings work.
14. API credentials remain secure.
15. The site can run on the intended Cloudflare infrastructure.
16. There are no fake features or nonfunctional controls.
17. There is a clear deployment and maintenance guide.
18. There is a database backup and recovery strategy.

---

# FINAL INSTRUCTION

Build this as a complete personal digital headquarters, not a simple landing page.

The most important experience is the relationship between the public website and its administration dashboard.

The public website should be beautiful, expressive, interactive, and memorable.

The admin dashboard should be powerful, intuitive, and capable of controlling practically every aspect of the public website.

The owner should be able to continuously evolve the website for years without needing to manually modify source code for ordinary changes.

Prioritize real functionality over visual mockups.

Do not silently omit requested features. If a feature is impractical, explain the limitation and propose an actual working alternative.

Do not invent completed integrations, API capabilities, or infrastructure functionality.

Deliver a working, documented, maintainable application.

**Project identity: 3ellwa.space**

**Concept: Your personal space on the internet.**

**One owner. One domain. Complete control.**