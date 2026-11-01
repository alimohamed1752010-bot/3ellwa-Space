# REDESIGN

Goal: restyle the public site after noiz.bio (dark chrome base, animated background, centered profile card) and add Discord-Nitro-style profile colors. The existing theme system (drafts, presets, publish, import/export) is extended, not replaced.

## Done
- Profile card colors: `themes.tokens_json` gains an optional `profile` block `{ mode: off | solid | gradient, primary, accent, angle }`. It defaults to `off`, so every stored theme keeps working unchanged. Schema: `worker/lib/theme.ts`.
- `apps/web/src/shared/profileColors.ts` builds the card style. It picks white or dark text automatically and adds a light scrim when the colors alone would not give a contrast ratio of at least 6. Tested in `apps/web/src/profileColors.test.ts`.
- Admin: Appearance screen has a "Profile card colors" card (style, primary, accent, angle, 12 presets, live preview). It follows the existing draft and publish flow.
- Public: the profile card in `apps/web/src/public/PublicApp.tsx` uses the colors; children follow through overridden `--color-*` custom properties.

- Effects (`fx` token block, optional, defaults to everything off): animated background (aurora or starfield, canvas), card glow (soft or pulse), 3D card tilt, cursor glow, avatar shape and glow, name effect (decrypt or glitch), and an optional enter screen. Schema in `worker/lib/theme.ts`, types and the one-click bundle in `apps/web/src/shared/fx.ts`, components in `apps/web/src/public/fx/`, admin card in `apps/web/src/admin/FxCard.tsx`.
- Every effect respects prefers-reduced-motion and the theme's animation switch. The background draws one still frame on weak devices. Tilt and cursor glow only run for a mouse pointer.
- Admin "Apply Noiz look" button sets a ready bundle on the draft (aurora, soft glow, tilt, cursor glow, avatar glow, decrypt name, rounder and blurrier cards). It leaves the enter screen off.

## Next, in order
1. Live Discord status card. The CSP only allows same-origin requests, so this needs a small Worker route that fetches and caches the status.
2. Link sections, pinned links, click counts on the admin list.
3. Background music with a play button (the enter screen already gives the click that browsers require for audio).
4. Admin restructure (Overview, Customize, Links, Analytics) with a live preview of the public page.
5. A "Noiz" preset theme seeded by migration, so it shows up as a built-in choice.