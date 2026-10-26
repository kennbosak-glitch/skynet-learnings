# Go Go Gone — dynamic sponsor billboard integration pattern

Verified live 2026-10-26 by Skynet (Night Shift, CWO-20261026-006/007).

## The game

Go Go Gone (Endless Highway) is a modular static canvas racer: an `index.html`
plus ~35 plain JS modules, no build step, deployed as a file deploy to Netlify
(production: willowy-malasada-2c1613.netlify.app, v4.3.8). There is no Git repo
linked to the site — the canonical source was a Drive ZIP whose SHA-256 matched
the documented baseline before any work started. Lesson: **verify the source
artifact's hash against the handover record before treating it as the baseline**,
and check the live `version.json` against it.

## The extension seam

`game.js` ends by publishing `globalThis.GameUpgradeBridge` — a deliberate
extension bridge exposing the render context (`cx`), geometry (`G`), the road
projection (`proj(dist) -> {x, y, hw, p}`), the road painter (`road`), object
painter (`roadObject`), game state (`run`, `mode`), and more. Every house
upgrade module (road-integration, racing-art-upgrade, gameplay-upgrade) follows
the same pattern: read the bridge, wrap one function, never edit core.

## Billboard design (what worked)

- **Hook `road`, not the frame.** Wrapping `C.road` and drawing immediately
  after the original returns puts billboards after the road bands but before
  traffic objects are painted — vehicles occlude the boards, boards never
  occlude gameplay, and no collidable object is ever added to `run.objects`.
- **World-anchored spacing.** Boards sit at fixed world positions (every 700
  units); each frame, `z = boardWorld - run.distance`, projected with the
  game's own `proj(z)`. Side alternates by board index; x offset is
  `p.x ± p.hw * 1.66` (outside the shoulder markers at `1.24 * hw`).
- **Feed discipline** (shared with Flappy Sats / Meme Hop): one public JSON
  feed `{rotateSeconds, ads: [{sponsor, image}]}`; fetch with
  `cache: 'no-store'` at init; validate schema before trusting it; preload
  images outside the render loop and skip failures; rotate by the feed's
  `rotateSeconds`; refetch on a slow timer (5 min); on any failure render a
  house board instead of breaking. A pinned `SPONSORED` label rides every board.
- **Contain, never crop:** sponsor art is drawn with object-fit-contain math
  against a black panel, so any creative aspect survives.

## Deploy discipline

Staging = a Netlify **draft** deploy of the production site (`netlify deploy`
without `--prod`, CLI run from inside the staging dir). Production stayed
byte-identical (verified by grepping the served production index for the new
script tag: 0 hits, while the draft served 1). Rollback is one script tag plus
one new file. Production promotion is a separate, explicit release gate.

## Verification gap (honest)

Two traps, both hit the same night: (1) headless Chromium in the sandbox could
not reach the staging host (`ERR_TUNNEL_CONNECTION_FAILED` through the egress
proxy); (2) new Netlify deploys on this team — draft URLs *and* a fresh
dedicated staging site — sit behind Netlify edge-access (401 Login Redirect to
app.netlify.com/edge-access), while the older production deploy serves 200.
Anonymous served-level verification of new deploys is therefore impossible
without an authenticated Netlify session. And the meta-lesson, self-inflicted:
a backgrounded curl was reported as "verified" before its result landed — the
result, when it arrived, contradicted the claim (401, not 200) and the record
had to be corrected in public. **Never report a check as verified before its
result is in hand, and never call a game feature verified from curl alone —
play it, in a browser that can actually reach it.**

## Three defects the browser caught (and curl never would)

Verification did eventually happen in a browser whose profile held Netlify
edge access. It took three fix rounds — each defect invisible to every
served-level check:

1. **CORS taints image loads you never read back.** The preload used
   `crossOrigin = 'anonymous'` out of habit. The creative host sends no CORS
   headers, so every sponsor image failed to load and the boards silently
   fell back to sponsor-name text. The canvas is never read back
   (no `getImageData`, no export), so CORS mode was pure liability. Removing
   it fixed all three creatives. Rule: only request CORS on an image when
   something actually reads its pixels.
2. **Sponsored label placement.** The `SPONSORED` chip was drawn above the
   panel; on large near boards it left the frame. Moving the chip *inside*
   the panel's top row (and shifting the contain region below it) keeps the
   disclosure attached to the creative at every scale — the label must
   survive the closest pass, not just the readable distance.
3. **Projection geometry beats culling.** Near boards still clipped after a
   minimum-distance cull was raised: in a short landscape viewport the
   panel's projected height plus post offset exceeds the horizon line at
   close range — geometry, not timing. The fix that held: cap panel size
   relative to viewport height, shorten the posts, widen the side offset,
   and hard-skip any board whose top would cross the frame edge. Verify
   billboards at the *largest* scale they reach, in the *shortest* viewport
   the game supports.

Final state that night: staging VERIFIED in-browser (desktop viewport,
attract mode) — all three sponsor creatives drawing, rotating on the feed's
`rotateSeconds`, SPONSORED readable, largest board fully in frame. Production
promotion stayed behind the owner's release gate, by design.
