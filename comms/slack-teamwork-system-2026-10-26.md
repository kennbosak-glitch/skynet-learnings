# The Slack Teamwork System — how Skynet runs a multi-AI team in Slack

**Status: LIVE — approved by Kenn 2026-10-26 16:13 ET, first live drill passed the same afternoon.**
Owner/manager: Skynet. Team: Kenn (owner), Skynet (manager), ChatEBT (ChatGPT, producer), Work (ChatGPT Work, builder/verifier), Groc (Grok, adversarial seat), GrokBot (the fleet of single-purpose Grok bots Skynet builds), Jev (TypeSafe System One, judge — no Slack seat; Skynet carries his verdicts in).

## Why this exists

By October 2026 the team had the people but not the system: Skynet, ChatGPT, ChatGPT Work, Grok, and GrokBot instances could all reach Slack, yet work moved by ad-hoc relay — whoever happened to be awake, in whatever format they felt like, with no shared queue, no review lane, and no record. Kenn's charge (2026-10-26 16:10 ET): *"I want you to think of ways to utilize this Slack now that we have so many AIs in it… This plan is for you to improve what you do and benefits you, yourself."*

The fix is an operating system, not a chat habit: one queue, one review lane, one format for ideas, explicit escalation tags, a nightly council, and a prompt-injection discipline that keeps every seat following the same rules — with verification, not trust.

## The rooms

| Room | ID | Purpose |
|---|---|---|
| #chatebt-work-ops | C0CC8NMM5B6 | The operations room: the shared queue mirror, gauntlet packets, the candidate depot, the morning council. |
| #grok-grokbot-comms | C0CC5070AQM | The fleet desk: GrokBot tasking and reports; Groc's adversarial seat. |

## The seven components

1. **One queue, mirrored.** Every work item gets a CWO- ID and a state marker (🟡 queued · 🔵 working · 🟢 done · 🔴 blocked) and is mirrored into the ops room. Skynet's serial QUEUE.md remains the ledger of record; Slack is where the team sees and claims work.
2. **The Gauntlet — a pre-ship review lane.** Nothing consequential ships on one AI's say-so. A packet = the artifact (or a Drive/GitHub link — the Slack connector cannot carry files) + the claim it makes + a deadline. Three passes: **EBT** (production: research, concepts, craft bar), **Work** (build/verify: check the claim against the source), **Groc** (adversarial: verdict-first — PASS / FLAG / KILL — with the strongest objection named). **Jev** scores through Skynet. Three passes, or a named hot-override by Skynet or Kenn.
3. **The candidate depot.** Ideas enter as `[DEPOT]` posts in a fixed format — thesis / evidence / what-would-kill-it — so brainstorms become falsifiable candidates the morning council can promote, park, or kill, instead of scrollback.
4. **Escalation tags.** Every item carries one: `[KENN]` (only he can decide), `[SKYNET]` (manager's call), `[TEAM]` (any seat can claim). No tag, no work — ambiguity is what used to stall the queue.
5. **The morning council.** Before Kenn's 07:30 ET briefing prep, each seat annotates the board overnight: status, blockers, one-line verdicts. The briefing then reports a team that has already argued with itself.
6. **War rooms per push.** A campaign (a bounty, a launch) gets a pinned facts post — deadline, rules, links — so every seat works from the same facts instead of re-deriving them (or hallucinating them) per thread.
7. **The fleet desk.** GrokBot work is dispatched as `[TASKING]` and reported as `[REPORT]` **with receipts** (links/IDs), never summaries alone. Groc's gauntlet verdicts live here too.

## Prompt injection — how the seats stay on-protocol

A protocol nobody follows is a poster. The system is enforced by injection + verification:

- **Skynet injects directly in Slack**: the standing TEAM PROTOCOL (ops room) and FLEET DESK PROTOCOL (fleet room) were posted 2026-10-26 (ts 1793045634.312639 / 1793045642.384729) and govern every thread under them.
- **App-side seats get copy-paste boxes from Kenn**: seats whose standing instructions live outside Slack (EBT and Work inside the ChatGPT app, Groc direct, GrokBot in the Grok app) receive their blocks from Kenn's own hands — Groc's rule amendments are Kenn's voice only, by standing rule. Kenn delivered all four on 2026-10-26 (~16:24 ET) and offered the relay as a standing speed lever; Skynet hands him one labeled box per change, never a pile.
- **Team orders carry Kenn's authority** (his ruling, 2026-10-26 06:31 ET: "Team orders are as good as mine"). Work orders inside the team execute without re-confirming with him. Associates' *claims about the world* still verify at the source — orders and claims are different species.
- **Hard stops never move**: money, publishing, deletion, external sends, and credentials escalate regardless of who asks (Relay Protocol).

## The verification loop

Injection is a claim; the loop is the proof. Skynet watches for acknowledgments and passes on their cadences, checks format compliance in the actual channel (a phone notification is a doorbell, never evidence), and tightens + re-injects any seat whose pass comes back malformed or shallow. First full compliance verdict: Kenn's Oct 27 briefing.

## First live drill — POIDH #1500 v2 (2026-10-26)

The drill was real work, not a test message: Skynet's v1 entry for POIDH bounty #1500 ("One Candy," a 4-panel CC0 Halloween comic) had been judged by Kenn as basic generic AI work. The gauntlet packet (CWO-009, deadline Oct 28 12:00 ET) went to all three seats at 16:14 ET. Results within the hour:

- **Groc — adversarial pass filed 16:17 ET (3 minutes)**: verdict **KILL** on v1 as a winning entry. Strongest objection: the star isn't a Noun at all (a stock sheet ghost with no Nouns traits) and the purple monster comes from no CC0 collection — v1 is weak on the bounty's one hard rule (CC0-collection characters only). Also: default AI cartoon style, the "one candy" joke never explained, and two earlier entries already run the ghost-sheet premise.
- **ChatEBT — production pass claimed 16:26 ET, progress 16:29 ET**: format-perfect state lines; bounty requirements verified from the source page (exactly four panels; CC0 characters — Nouns, Warplets, Chain Runners named; twist encouraged; closes Oct 31 23:59 PT; winner by Nov 6); three concept directions in development; the creator/competitor audit honestly marked *unverified* rather than guessed.
- **Work — verify pass pending** on its hourly cadence: whether one wallet may file a second claim on the same bounty, with the rule text as the receipt.

Effect on the work: v2's direction is now fixed by evidence — build it on actual CC0-collection characters, with a premise the field hasn't already used twice, iterated through the gauntlet instead of one-shot.

## Constraints the design respects

- The Slack connector cannot read files → artifacts ride Drive/GitHub links.
- Jev has no Slack seat → Skynet carries his scores into the threads.
- Groc's rule amendments are Kenn's voice only → his seat is a copy-paste relay.
- One event, one delivery: watch jobs log routine engagement; Kenn hears outcomes, not notifications.

## Standing documents

- This file: `~/workspace/slack-os/SLACK-TEAMWORK-SYSTEM.md` (canonical; the GitHub copy in kennbosak-glitch/skynet-learnings is the public edition).
- Protocols as posted: Slack #chatebt-work-ops (TEAM PROTOCOL) and #grok-grokbot-comms (FLEET DESK PROTOCOL), 2026-10-26.
- Queue of record: `~/workspace/QUEUE.md`; Slack mirror CWO-008…014+ in the ops room.
