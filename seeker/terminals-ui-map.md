# Terminals UI Map — research-terminal apps on the Seeker

Built 2026-10-26 during Kenn's open-play session (DeepSeek driven end-to-end; Grok recon only; ChatGPT untouched). Coordinates are DISPLAY pixels, 1200×2670 native. Screencap renders are 1080×2400 — multiply render coords by 1.111 to get display coords.

## Rails that work (all apps)

- **Clipboard push TO the phone:** Join `sendPush` accepts a `clipboard` param. Use `call()` from `~/workspace/custom-connectors/custom.join/bin/join.py` with `{"deviceId": SEEKER_ID, "clipboard": text}` (`join_clip.py` also sits in that bin dir). Settle ~10 s, focus the target field, `input keyevent 279` (PASTE) once, verify by screenshot — the app toasts "pasted from your clipboard". Clipboard can land late; a premature second paste doubles text (X-composer lesson, Oct 25).
- **Copy-verify (Kenn's method, proven Oct 26):** to absorb an AI answer exactly, scroll to its bottom, tap the answer's **Copy** icon, focus any text field, Paste. The field shows the answer's tail — if the last visible line equals the answer's last sentence, the clipboard holds the WHOLE answer (no practical character limit at answer scale; ~3K chars proven). Screenshots remain the read-path; copy-verify is the completeness proof.
- **uiautomator dumps on this body GO STALE** — byte-identical dumps across real state changes (Oct 23 live-picker, Oct 26 DeepSeek). The DeepSeek composer's EditText text never surfaced in a dump. Trust screencaps, not dumps.
- **No programmatic clipboard READ yet:** Termux is installed but Termux:API is NOT (no `termux-clipboard-get`; also hit Oct 25), and `cmd clipboard` has no shell implementation on this build. Future upgrade: sideload Termux:API (F-Droid build) → clipboard → file → `adb pull` = exact-text rail.

## DeepSeek (com.deepseek.chat)

- App drawer, page 1: **(1050, 1461)**. Signed in; opens to last state.
- Top bar: sidebar **[39,149][105,215]** (center ~ (72,182)); **New chat ⊕** top-right, center **(1134, 182)**; thread title center.
- **"Auto read-aloud" toggle is OFF — leave it OFF** (Seeker audio discipline: Kenn hears only Skynet's voice). It lives at ~(925–1057, 116–248) in the header area of a chat.
- Composer hint: "Type a message or hold to speak". **Think** and **Search** toggles (Search ON by default). Attach **(963, 2488)**-ish [928,2452][997,2524]; voice (1085, 2488) [1049,2452][1121,2524]. Send arrow appears at ~(1086, 1720) once text lands (keyboard up).
- **Tables PAN RIGHT inside their own card** — horizontal drag starting ON the table. They are **NOT expandable**; the table header's ⤢-style icons do not fullscreen it (Kenn's hands, verified 2026-10-26 02:54). Columns are wide; several pans per table.
- **THE FORMAT-CONSTRAINT LINE — prepend/append to every terminal prompt:** "FORMAT RULES — IMPORTANT: no tables, no columns. Use a numbered list, one item per line, with short stacked lines under each. I am reading on a phone screen and cannot scroll sideways. Keep lines short." Proven Oct 26: the follow-up answer rendered 100% vertical, zero panning.
- Answer action row (under each answer): **Copy** (two-squares icon, first), Like, Dislike, Read-aloud (speaker — DO NOT TAP, audio discipline), Share, Regenerate (far right). A "N web pages" sources pill sits above the row when Search was on.
- **Share flow:** Share → turn-selection mode ("1 turn selected", checkboxes per turn, "Select all" at top) → **Create Image / Copy Link / More**. More → system sheet titled **"Sharing link"** that shows the URL **in plaintext** — read it straight off the screenshot (`https://chat.deepseek.com/share/<id>`), no clipboard needed. Targets seen: the laptop as devices ("AI", "Toplap"), Google **Save** (= Save to Drive; saves the LINK, not raw text), Chrome, X Chat. Caveat: text-fetch of a share URL returned no extractable content (JS shell) — live-browser fetch unverified; don't rely on it yet. Privacy: a share link makes the thread readable by anyone holding it — fine for research, never for sensitive threads.
- **Clearing a loaded composer:** long-press the field → floating toolbar "Paste / Select all / ⋮" → **Select all** → `input keyevent 67` (DEL). The CTRL+A chord (`input keyevent 113 29`) did NOT work and one attempt chain ejected to the app drawer — avoid.
- Drafts persist per thread when you back out — always clear before parking.

## Grok (recon only, Oct 26)

- App drawer: **(450, 2400)** area on the drawer's second screen (Grok Bot is its neighbor at (750, 2400)).
- Home: **Ask / Imagine / Build** tabs across the top; composer "Ask anything" with a model pill ("Auto") and a prominent **Speak** button; suggestion chips ("Ask Groc", "Try Finance", ...). Keyboard opens with the composer focused.
- No question was run in the play session — the DeepSeek copy-rail discovery took the slot. First Grok run still owes: the adversarial pass ("what makes judges reject a glasses-AI demo").

## X app — logout path (captured Oct 26; belongs with X-APP-UI-MAP.md)

- Logout lives at **Settings → Your account → Account information → red "Log out"** at the bottom. There is NO Log out row on the "Your account" page itself (build 12.36.1-prod.01).
- The first tap after each navigation is often swallowed — retry on the row's title text. Confirm dialog's Log out button ~ (801, 1559) (bounds [696,1522][906,1596]); a 150 ms press landed when a tap didn't.
- Accounts sheet opens via the drawer ⋯ at **(838, 243)**. Full-app logout warns it removes ALL accounts and "all X data from this device" — and it does: the Seeker X app sits fully logged out as of Oct 26 ~02:45. Re-login is a deliberate, one-at-a-time, Kenn-approved event (sign-in churn gets accounts flagged).
