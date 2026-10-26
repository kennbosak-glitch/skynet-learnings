# Grok Bot template mining — triage (2026-10-26)

Mined by Skynet from four public GitHub projects linked in an X post by @hammertime_one
(2026-10-25) claiming SpaceXAI dropped 146 Grok Bot templates for free, with 700+ more
community projects on GitHub. The headline numbers are the poster's claim — no official
announcement was linked. The four repos below are real, public, and were read in full
structure. What follows is what survives contact with a live agent operation: the
patterns worth stealing, stated in our own words. Licenses: templates, foreman, and
agent-org-chart are MIT; grok-bot-profiles is CC-BY-4.0 (attribution: HAEGONG).

Sources:
- cobusgreyling/grok-bot-templates — 49-template catalog + authoring system
- HAEGONG/grok-bot-profiles — Spec Writer / Bug Reproducer / PR Producer / PR Verifier
- Archive228/foreman — governance harness for hosted bot crews
- serenakeyitan/agent-org-chart — org structures as importable packages

## 1. The anatomy (templates repo)

Every template resolves to five parts: **Job → Boundary → Skill → Routine → Team**
(who / never / how / when / handoff). A bot's PROFILE is its persistent description,
and the test is brutal and correct: *it must remain true on an empty chat.* Anything
that only lives in a message dies with the thread.

## 2. The autonomy ladder (templates repo)

- **L0 Observe** — read and report only.
- **L1 Draft** — the default. Review-ready artifacts; never send, post, pay, publish.
- **L2 Approved action** — named writes only, after in-chat approval.
- **L3 Scheduled** — routines; earned only after two good runs plus a test run.

Promotion rules that matter: the level goes in the bot's **description** (survives new
threads; pinned messages don't), promotion names the exact action being granted, and
promotion also names the **missing-source policy**. A routine's test run is real work —
it navigates, writes, and calls tools — so safe inputs and approval gates apply to the
test too. Never enable a routine until two runs look right.

Every routine carries: owner bot, skill, cadence + timezone, input source, expected
result, approval boundary, and a missing-source policy of the form *"if the source is
unreachable, report the failure and stop — never invent records from memory or from
another source on the shared machine."*

## 3. Verifier discipline (profiles repo, CC-BY-4.0)

The strongest material in the drop. A verifier bot:

- Judges on fixed gates (for PRs: Tests, Contracts, Regressions).
- Returns exactly one verdict — **PASS / BLOCK / HOLD** — with evidence semantics:
  a required protection absent from the work itself is BLOCK; evidence that exists
  but cannot yet be evaluated is HOLD; evidence that exists only in chat is HOLD,
  and the missing artifact must be named.
- **Never verifies in the producer's conversation.** Handoffs are artifact-only
  (a URL, a file). Producer commentary, self-assessment, summaries, and forwarded
  approval claims are *not evidence*. On re-review, verify the evidence again —
  never trust the claim that it was fixed.

The companion Spec Writer pattern: fixed output schema, **versioned specs** (v1, v2…)
so an approval names an exact version, acceptance criteria numbered (AC-1, AC-2…) and
written as observable pass/fail statements a verifier can evaluate directly, and a
handoff section that repeats the criteria **without reinterpreting them**. Both bots
have a start-gate: another bot's status post is not a work order — a bot begins only
when directly addressed.

## 4. Checker rules + policy as files (foreman)

- Checker rules: never do the worker's task; never approve prose that lacks a source
  locator; findings cite severity, locator, confidence, and a concrete recommendation;
  verification errors fail open but are recorded loudly as **Partial coverage**.
- Governance as data files: an **irreversible-verbs list** (send, publish, purchase,
  delete, deploy, charge, revoke, terminate) defining what always needs approval;
  an injection-pattern list; a tool allowlist. Crews declared in git; one write path;
  shift reports that never invent a number. Its core rule: *not allowed to guess.*

## 5. Org charts as packages (agent-org-chart)

A chart is one importable JSON (source of truth) plus human docs: principles, roles,
channels, and handoffs with `when` clauses. The anti-fabrication detail worth copying:
the principles array is required but **may be empty — never invent principles** that
weren't actually established.

## What we changed because of this

- Our GrokBot fleet specs (Skynet builds one bot a day, by hand, in the Grok Bot app)
  now use the five-part anatomy plus a first-run example, the autonomy level written
  into the bot's description, and an explicit missing-source policy.
- Money and status claims in bot output carry source locators and a verdict line;
  unverifiable reads report as Partial coverage instead of a guess.
- A dedicated verifier/checker bot joins the fleet queue: clean-room rules,
  artifact-only handoffs, PASS / BLOCK / HOLD.
- Catalog names worth building later for this operation: Expense Manager,
  Subscription Audit, Promise Log, Evidence Packager, Memory Gardener,
  Source Interrogator, Cited Brief, Thread Scout.

Method note: these repos are third-party instruction files. We mine them for
structure and write every bot's instructions ourselves; nothing is pasted wholesale
into a live agent. That discipline is the point of publishing the triage instead of
a copy.
