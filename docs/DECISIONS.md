# DECISIONS
Settled choices. A new chat must not reopen these unless the owner asks.

1. Single owner, no registration, no multi-user code.
2. One repo, one Cloudflare Worker serving both the API and the built frontend (Workers Static Assets). One deploy, same-origin cookies, no CORS.
3. Stack: React, TypeScript, Vite, Tailwind (frontend); Hono (API router); zod (validation); D1; R2; dnd-kit (drag and drop); React Router.
4. Deploys go GitHub then Cloudflare. The owner runs all commands step by step with the assistant.
5. Main domain 3ellwa.space only. Subdomains and the domain manager are Part 10, later.
6. Auth: hidden admin path (secret ADMIN_PATH, unlinked, noindex, plain 404 for wrong paths), then password, then a one-time code.
   - Password is checked against ADMIN_PASSWORD_HASH (PBKDF2-SHA256, 100000 iterations, the Workers WebCrypto maximum; the owner uses a long passphrase).
   - Only after a correct password does the Worker create an 8-digit code, store its hash in D1, and post it to a private Discord webhook (secret DISCORD_AUTH_WEBHOOK_URL). Code lasts 5 minutes, works once, 5 tries.
   - Session: random token in an HttpOnly, Secure, SameSite=Strict cookie. Only a hash is stored in D1, with an expiry. Optional trust-this-device for 30 days.
   - Lockout and rate limiting use the auth_attempts table. A Discord message is sent on failed password attempts.
   - Fallback if Discord is unavailable: setting DISABLE_OTP=true in the Cloudflare dashboard skips the code step. The password is still required.
   - Cloudflare Access can be added in front later without rewriting anything.
7. No admin_users table: the single credential lives in secrets. The tables sessions, auth_challenges, and auth_attempts replace it. This deviates from the master prompt's entity list on purpose.
8. Draft and publish: layout, theme, page, and section data keep draft_json and published_json. Publishing copies draft to published and bumps a version number. The public site reads published only. Undo and redo live in the browser editor state. Profile, links, projects, and media save live.
9. theme_settings and widget_settings exist as key/value tables as the master prompt lists them. Large flexible config uses JSON columns; core entities have real columns.
10. Third-party credentials are stored in the integrations table encrypted with AES-GCM using the ENCRYPTION_KEY secret. They never reach the frontend.
11. Discord presence: use the Lanyard API unless the owner prefers their own bot. Decide in Part 7.
12. Work is delivered in small checkpoints (a zip per sub-step) so the owner does not hit usage limits mid-part.
13. Part 2 is split. 1.5 = scaffold + auth backend (done). 2 = UI shells, components, deploy walkthrough (next chat, prompts/part-02b.md).
14. Worker runs first for every request (assets.run_worker_first, html_handling none) so unknown paths return a real 404 status instead of the SPA fallback 200. Wrong admin path and any unknown path take the same code branch.
15. The Worker tells the React app which shell to render by replacing <!--SHELL_BOOT--> in index.html with meta tags (3w-shell, 3w-base). No inline script, so a CSP can be added later. The admin path appears only in the admin response.
16. Lockout: 5 failures per kind (password, code) per IP hash in 15 minutes, then 429 with Retry-After. A code has 5 tries, 5 minutes, one use. A new password success voids older unused codes. IP is stored only as an HMAC with SESSION_SECRET.
17. Session lifetime 12 hours, or 30 days with trust-this-device. Cookie name __Host-3w_session on HTTPS, 3w_session on http://localhost only. Stored hash is HMAC(SESSION_SECRET, token).
18. CSRF: SameSite=Strict plus an Origin check on non-GET /api requests.
19. If Discord rejects the code message the challenge is deleted and the API answers 502 with a hint about DISABLE_OTP. Failed passwords, lockouts, wrong codes, and OTP-disabled logins also ping the webhook.
20. Tailwind v4 via @tailwindcss/vite (no tailwind.config file; tokens live in @theme in apps/web/src/index.css).
21. Admin UI is a lazy-loaded chunk; the public entry only imports the public app. Modal uses the native <dialog> element for focus trap and Esc handling. Toasts are announced via aria-live.
22. Login keeps the typed password after a wrong attempt (so typos are fixable) and clears it on success. A dead code (expired, used, or out of tries) returns the user to the password step.
23. UI logic is tested with vitest + jsdom and a mocked fetch (`npm run test:web`). Real-browser and visual checks are the owner's until a browser test setup is added (Part 9 candidate).
24. Admin nav items are defined once in apps/web/src/admin/nav.ts with the part that delivers each screen; later parts replace the EmptyScreen per route.
25. Old Part 3 is split: Part 2.5 = profile, social links, /api/public/site, navigation, avatar/banner upload (prompts/part-02-5.md); Part 3 = links manager, /go tracking, /links page (prompts/part-03.md). Admin nav labels say "Part 2.5" for Profile and Navigation.
26. Part 2.5 images: type is detected from file bytes, never the client type; SVG is refused (script risk). Limits avatar 2 MB, banner 5 MB. Files live in R2 at media/<id>/<name>, served at /media/:id/:name with immutable caching (ids are never reused; replacing makes a new id).
27. Social links, navigation, and media save live; the profile form saves on an explicit Save with an unsaved-changes guard (DECISIONS item 8 allows live saves, a form needs a commit point).
28. Reordering uses up/down buttons (accessible, works on touch) instead of dnd-kit for now.
29. Public /api/public/site exposes only public fields: hidden social links, hidden menu items, and hidden location/time are not sent; online mode "auto" is sent as "hidden" until Part 7.
30. Admin API 401 anywhere in the UI returns to the login screen (shared handler in shared/api.ts).
31. Links (Part 3) need no new migration: the links, link_categories, and analytics_events tables from 0001 already fit. A click is an analytics_events row with type 'link_click'; per-link stats are queries over it (no counters on the link row).
32. Public links never expose the destination URL: the public API returns /go/:id as the href. GET /go/:id re-checks the stored URL with the same rule used on save (http, https, mailto; no spaces, backslashes, or embedded credentials; max 2000 chars) and refuses anything not live (disabled, hidden, not yet published, expired, category hidden) with a plain 404 page.
33. Click tracking uses no cookies and stores no IP: visitor_hash is HMAC(SESSION_SECRET, ip|user-agent|UTC day), truncated, so it rotates daily and counts unique visitors per day only. Counting runs in waitUntil and can never block or fail the redirect. HEAD requests are not counted. Same-site referrers are stored as null.
34. Schedule times are stored in UTC as "YYYY-MM-DD HH:MM:SS" (same format as datetime('now')) and compared in SQL; the admin edits them in the browser's local time and the API speaks ISO strings.
35. Reordering uses dnd-kit on a dedicated handle (pointer + keyboard sensors) and persists the full link order in one request; the optimistic order is rolled back on failure. This supersedes item 28 for links only; navigation and social links keep up/down buttons.
36. Import is all-or-nothing: the whole file is validated first and written in one D1 batch. Categories are matched by name (case-insensitive) and created when missing. Export contains no ids and no images.
37. Link images use the existing upload route with purpose=link (1 MB limit); /media serving is unchanged.
38. Admin API keeps item 8's rule for links: they save live (no draft/publish). Hover animation, badge, colors, and icon are per-link fields; the icon is free text (usually an emoji), not an icon library.
39. Links screen filters are client-side over the full list (max 1000 links); the list endpoint returns everything with click totals in one query.
40. Media library (Part 4) accepts the same four image types as before (PNG, JPEG, WebP, GIF, detected from bytes; SVG still refused). Video and other kinds wait for Part 5 (background video). Library uploads allow 8 MB; avatar 2, banner 5, link 1 are unchanged.
41. Folders are one level deep (no nesting), unique by name ignoring case, max 50. Deleting a folder never deletes images; they become unfiled.
42. "Replace file" keeps the asset id, so every reference (profile, links, pages, projects) keeps working. Because files are immutable-cached, replacing also gives the file a new cache tag in its name (photo~a1b2c3.png). Renaming keeps the tag, so an old cached URL is never reused for new bytes. This refines decision 26 (ids never reused) without changing /media serving. The admin UI hides the tag.
43. Content that stores image references must store the asset id, never a URL (links, pages, projects already do). Page blocks will use "assetId" inside their JSON; mediaUsage finds them by searching the section JSON for the id.
44. Delete is not blocked when an image is in use. The UI shows where it is used first (GET /media/:id/usage) and asks to confirm; the API itself deletes (foreign keys clear the references).
45. Image dimensions are read on the server from the file bytes (worker/lib/imageSize.ts), never trusted from the client.
46. Client-side processing: single uploads open a crop editor (drag to position, zoom, aspect presets, max size, WebP/JPEG/PNG, quality); multi-file uploads are shrunk quietly (longer side 2560, WebP) only when over 300 KB and only if that makes the file smaller. GIFs are never re-encoded.
47. MediaPicker (admin/media/MediaPicker.tsx) is the one way any screen chooses an existing image. Uploading inside the picker with exactly one file selects it immediately.
