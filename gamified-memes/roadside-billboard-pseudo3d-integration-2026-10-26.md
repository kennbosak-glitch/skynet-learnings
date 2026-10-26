# Roadside billboards in a pseudo-3D racer, from a shared sponsor feed (2026-10-26)

Pattern proven in staging on Go Go Gone v4.3.8 (CWO-20261026-007): a dynamic
sponsor feed rendered as in-world roadside billboards, verified in-browser
through three fix iterations. Production promotion stayed behind the owner's
release gate — staging-verified is the honest claim.

## The pattern
- Hook, don't edit: wrap the renderer's road pass via the game's existing
  upgrade bridge (draw boards after road bands, before traffic) so vehicles
  occlude boards correctly and boards are pure decor — never collidable,
  never added to the object list.
- Feed client: fetch `no-store` at init, schema-validate, preload images
  OUTSIDE the render loop, rotate on the feed's `rotateSeconds`, refetch on
  a slow timer (~5 min). Any failure (fetch, empty, bad image) falls back to
  a house board. SPONSORED chip pinned INSIDE the panel top; images
  contain-fit so portrait and landscape creatives both survive.

## Three defects, three lessons
1. **CORS preload trap.** Preloading with `crossOrigin='anonymous'` against a
   creative host that sends no CORS headers fails every load — panels fell
   back to text. If the canvas is never read back, taint is acceptable:
   drop the attribute. Lesson: match the preload mode to whether you ever
   read pixels.
2. **Near-board geometry blowout.** Boards drawn to contact distance scale
   past the viewport (panel + posts exceed projected y at close range in a
   short landscape frame). A min-distance cull alone (130→330) was NOT
   enough. Fix that held: cap panel width by both road half-width and
   viewport width, shorten posts, widen side offset, and hard-skip any
   board whose top would cross the frame edge.
3. **Staging that isn't public.** Fresh Netlify deploys on this team sat
   behind edge-access (401 → login redirect) for anonymous fetches while
   the older production site served 200. Curl said "blocked"; an
   authenticated browser profile rendered fine. Lesson: a 401 from a
   draft/staging URL is an access state, not a build verdict — verify
   through a session that actually holds access, and never report a
   backgrounded check as verified before its result lands.

## Verification shape
Baseline first (source ZIP hash matched the documented release hash
byte-for-byte before any edit), syntax check, then in-browser visual
verification per iteration: all sponsors rotating, creatives drawing,
chip readable at distance, largest board fully in frame with margins.
Attract mode only — in-play and mobile-viewport checks stayed open items,
named as such, not silently upgraded to "verified."
