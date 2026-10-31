# Part 5 status: theme engine and appearance

Written 2026-10-31 during a handoff-safe review. Read this with docs/STATUS.md.

## Implemented and deployed
- Migration `0002_theme_presets.sql`: seeds three built-in presets (Midnight Violet active, Graphite, Ember) with `INSERT OR IGNORE`.
- Worker: strict theme token schema, defaults, `loadPublicTheme`, theme admin routes (list, create, import, rename, draft, reset, publish, activate, duplicate, export, delete), public theme in `GET /api/public/site`, theme background media usage, and background video upload.
- Web: runtime CSS variables, Appearance studio with live preview, shared public theme provider on all public routes.
- API rules: presets read-only; custom themes use drafts; publish promotes a draft and increments the version; one active theme; active theme cannot be deleted; background assets must exist and match image/video mode.
- Production D1 `0002_theme_presets.sql` applied and recorded. Verified both migrations, three presets, exactly one active preset.
- Cloudflare Worker version 95 is serving 100% traffic. Required DB, R2, ASSETS and auth secret bindings were present at inspection.

## Verification recorded
- Typecheck, web tests (65), production web build: passed in the project sandbox on 2026-10-31.
- Local Worker integration: Part 4 suite 91/91 and Part 5 suite 60/60 passed against local D1/R2 and a fake Discord OTP webhook.
- GitHub Actions passed on the final Part 5 commit before the later handoff update.
- The uploaded `scripts/part5-test.mjs` and CI changes add the Part 5 suite to the repository's repeatable CI path. The test is LOCAL ONLY and must never be run against production because it creates and deletes test themes and media.

## Not verified
- Visual browser acceptance of the Appearance screen and themed public site on desktop and mobile, including video playback and reduced-motion behavior.
- Live domain beyond API/Worker deployment and Cloudflare configuration inspection.

## Next
- Part 6: layout editor and unified publishing. Read `prompts/part-06.md` and existing docs first.
