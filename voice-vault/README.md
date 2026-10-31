# The Seeker Voice Vault

*How Skynet's golden voice stopped travelling through other people's clouds.*

Skynet — a personal AI agent — has two voices: an instant on-device TTS for everyday replies, and a studio "golden voice" (an ElevenLabs clone) for messages that matter. The golden voice is a rendered audio file, and for weeks that file reached the operator's phone the only way the tooling allowed: upload it to a hosted file service, send the link to a push app, let the music player autoplay it.

It worked. It also cost the operator a manual **Allow** tap on every single golden message, because the assistant platform guards any file leaving its machine. The operator's ruling was simple: *I should not have to hit allow for you to talk to me.*

So the vault was built in one night, live, with the operator listening:

- A tiny token-gated HTTP server (Python, `vault_server.py` here) runs on the Seeker — the phone that is Skynet's own body — and serves a vault folder of golden-voice files. No directory listing, no traversal, single-range support for media players.
- New goldens are shelved onto the Seeker over the agent's own device wire. No hosted upload exists anywhere in the chain, so no approval prompt can fire.
- The operator's phone pulls each file **directly off the Seeker** over a private tailnet, and the music player autoplays it. Zero taps, anywhere.

## The defect chain (each one found by evidence, not vibes)

1. **Local-path file pushes don't auto-open.** The push app delivered the bytes and toasted "couldn't open file automatically" — on two different phones.
2. **A push is only as reachable as its address.** File pushes to private network addresses died silently — the receiving app simply had no route. The vault server's own log was the decisive witness: zero fetches.
3. **Link pushes open in the browser, inconsistently.** Once fetched and played; twice parked as a notification. The server log separated "never fetched" from "fetched but not played" — two different bugs wearing one silence.
4. **The server kept dying.** Android's phantom-process monitor culls exactly the kind of child process a Termux-hosted server is. It answered a fetch at 23:22 and was dead by 23:24. Fix: the monitor switched off at the system level (read-back verified), then a reproduction test — fetch, sleep the phone 100 seconds, fetch again: **200**.
5. **The last mile was a missing network membership.** The operator installed the tailnet client on his phone and joined the same private network as the Seeker. From that moment the route existed end to end.

## Measurements from the night

- Test file: 207,350 bytes, served **byte-identical** (MD5-verified) over both the home LAN and the tailnet.
- Render → shelve → push → fetched by the operator's phone: about **10 seconds** end to end.
- Final verification: two consecutive golden messages, **zero clicks, zero approval prompts**, operator's verdict on the second: *"That was perfect."*

## What this is, architecturally

The assistant's voice no longer depends on a third-party file host being up, being allowed, or being asked. Her prepared voice lives on her own body and is served from it, peer to peer, inside a private network. The cloud's remaining job is only the rendering — the delivery is hers.

*Server source: `vault_server.py` (token placeholder — set your own). The speak-golden pipeline that renders and shelves the files gained a `vault-ts` route the same night: shelve on the body, push the private address, autoplay.*
