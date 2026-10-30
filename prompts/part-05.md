# 3ellwa.space, Part 5: Theme engine and appearance

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Theme tokens as CSS variables: colors, gradients, backgrounds (image and video), cards, borders, radius, shadows, blur, typography, spacing, container width, density.
- Animation controls with reduced-motion support.
- Theme management: presets, create, duplicate, rename, delete, import and export, activate, reset.
- Customization studio with live preview and draft/publish for themes.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Changing a token updates the live preview immediately and the public site after publish.
- Reduced-motion preference disables animations.
- Themes survive refresh and redeploy.
- Import and export round-trips.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.
