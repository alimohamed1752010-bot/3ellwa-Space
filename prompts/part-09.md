# 3ellwa.space, Part 9: Hardening, deployment guide, backup

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Security review against PROJECT.md section 17: input validation, output escaping, CSRF, rate limits, upload checks, headers (CSP, HSTS, and so on), admin route exposure.
- Accessibility and performance pass: keyboard navigation, labels, image optimization, lazy loading, layout shift.
- Write docs/DEPLOYMENT.md, docs/MAINTENANCE.md, and docs/BACKUP.md: deployment, secret rotation, D1 Time Travel restore, scheduled export, R2 backup, how to continue development with the prompt pack.
- Final test pass of every item in PROJECT.md section 21.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Every acceptance criterion in PROJECT.md section 21 is verified or an exception is listed honestly in STATUS.md.
- A backup and a restore were actually performed once.
- The deployment guide works from a clean machine.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.
