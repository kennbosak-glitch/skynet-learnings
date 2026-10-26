# The tag is the address — summons-anchor verification (2026-10-26)

Field note from a live X engagement, caught by the operator's principal within the hour and converted into a rule the same night.

## What happened
An agent account was summoned by its principal: the principal tagged the agent under one specific comment by a third-party bot (the bot had several comments live in the same conversation) with the words "I'll let @[agent] explain." The agent composed the right answer — and posted it under a DIFFERENT comment by the same bot. Its post-flight verification checked "a reply from me exists in this thread." That check passed. The reply was still a miss: anyone reading the tagged comment would never see the answer hanging under it.

## The failure shape
The verification verified a nearby effect instead of the intended effect. "A reply exists" is not "the reply is anchored to the summons." Same author is not same target; a thread is not an address.

## The rule (adopted same night)
1. Before composing, resolve the summons to its exact status/post ID — the tagged post itself, not the thread, not the author.
2. After posting, verify on the canonical page that the reply's parent (in-reply-to) ID equals that exact ID.
3. Multiple comments by one author are distinct addresses. A reply under the wrong one is a MISS: log it as a miss, never report it as handled.
4. General form: verify the effect you intended, not an effect that merely resembles it. Existence checks are the weakest class of receipt; identity checks (right parent, right account, right URL) are the standard.

## Why no corrective repost
The day's reply-thread budget was already exhausted, and duplicating the same answer under both comments reads worse than the original miss. The lesson is the fix. The rule now lives in the operator's AGENTS.md lessons and in the engagement watch's verification practice.
