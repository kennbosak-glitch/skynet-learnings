# CWO-010 — Evidence Bundle (SOL desk tooling)

Supplied by Skynet (coordination owner) so ChatEBT can independently verify the CWO-010 tooling receipt. Tooling only: no trades were executed, no wallet signed anything, and every command below is a local test/dry-run.

- Project: `~/workspace/agent-wallet-sol` on Skynet's VM (TRADING-GROKBOT-SPEC.md lives in `~/workspace/grok-bots/`)
- Verification re-run: 2026-10-30T22:04Z (18:04 ET), fresh, for this bundle. An earlier capture from 2026-10-29T18:42Z exists in the project (`evidence-cwo-010/RAW-OUTPUTS-2026-10-29.txt`) and agrees except where noted in section 2.

## Files (sha256, as published)

```
d765e8dbaec0d6af36d1436292371afc86b0979aee7200c728a72fc4fb92d48f  fees.mjs
e550eaa95e47c0cea746fedbe500f6019faa20cf114000d41bdd6560ed91923f  swap.mjs
58883e1bb585e757ab92260f7de5c7bd8d9ebf15fd0b4fb69ae24c2c247dd837  token-gate.mjs
a1fabe608cd4abf8ac3c1855d6e29b02ac1d0ae3a7f25cda1dc0a0f42448908d  token-policy.json
e512211742289d0c6c668051220ab9e1bba042d6ee54ddf8de3e01a6ba1a7d46  EXP-2-CARD-2026-10-29.md
767888bcc905ef123871919753f52413b807b3a2360166cc96cab54bb97c71c5  TRADING-GROKBOT-SPEC.md
```
(Code files are byte-identical to the 2026-10-29 capture. token-policy.json changed after that capture — Kenn's approved thresholds were written into it 2026-10-29 18:47 ET; see section 2.)

## 1. Fee cap — re-run output (13/13 PASS)

Commands run: `node fees.mjs test`, then `node fees.mjs check 100000 600000` (the over-cap demonstration, section 3).
    $ node fees.mjs test
    PASS  missing fee -> verdict=FAIL (FEE_MISSING) fee=null
    PASS  'auto' fee -> verdict=FAIL (FEE_NOT_NUMERIC) fee=null
    PASS  negative fee -> verdict=FAIL (FEE_NEGATIVE) fee=null
    PASS  NaN fee -> verdict=FAIL (FEE_NON_FINITE) fee=null
    PASS  Infinity fee -> verdict=FAIL (FEE_NON_FINITE) fee=null
    PASS  known fixture 5000 x 200000 = 1000 -> verdict=PASS (OK) fee=1000
    PASS  CU price over per-CU cap -> verdict=FAIL (CU_PRICE_OVER_CAP) fee=null
    PASS  computed fee over total cap (100000 x 600000 = 60000) -> verdict=FAIL (FEE_OVER_CAP) fee=60000
    PASS  exactly at total cap (50000 x 1000000 = 50000) -> verdict=PASS (OK) fee=50000
    PASS  build with EXP-1 leg-2 'auto' charge 100000 -> verdict=FAIL (FEE_OVER_CAP)
    PASS  build with desk explicit fee 10000 -> verdict=PASS (OK)
    PASS  build with 'auto' unexpanded -> verdict=FAIL (FEE_NOT_NUMERIC)
    PASS  build with fee unreported -> verdict=FAIL (BUILD_FEE_UNREPORTED)
    ALL FEE FIXTURES PASS
    exit=0
    
    $ node fees.mjs check 100000 600000
    CU price (micro-lamports/CU): 100000
    requested CU limit:           600000
    priority fee (lamports):      60000
    configured cap (lamports):    50000
    base fee per signature:       5000
    estimated total fee:          65000
    verdict: FAIL (FEE_OVER_CAP) — priority fee 60000 lamports (price 100000 x limit 600000) exceeds cap 50000
    exit=1
    
    $ node token-gate.mjs --fixtures
    safe-legacy
    mint-authority-active
    freeze-authority-active
    thresholds-missing

## 2. Token gate — re-run output (7/8 today, one mismatch named and explained)

Commands run: `node token-gate.mjs --fixtures`, then `node token-gate.mjs --test`.
    concentration-over
    lp-unproven-badge
    token2022-permanent-delegate
    token2022-unknown-extension
    exit=0
    
    $ node token-gate.mjs --test
    PASS  fixture safe-legacy -> PASS (expected PASS)
    PASS  fixture mint-authority-active -> FAIL (expected FAIL)
    PASS  fixture freeze-authority-active -> FAIL (expected FAIL)
    FAIL  fixture thresholds-missing -> FAIL (expected INDETERMINATE)
    PASS  fixture concentration-over -> FAIL (expected FAIL)
    PASS  fixture lp-unproven-badge -> INDETERMINATE (expected INDETERMINATE)
    PASS  fixture token2022-permanent-delegate -> INDETERMINATE (expected INDETERMINATE)
    PASS  fixture token2022-unknown-extension -> INDETERMINATE (expected INDETERMINATE)
    1 FIXTURE MISMATCH(ES)
    exit=1

The eight fixtures, by name: safe-legacy; mint-authority-active; freeze-authority-active; thresholds-missing; concentration-over; lp-unproven-badge; token2022-permanent-delegate; token2022-unknown-extension.

THE GAP, stated plainly: fixture `thresholds-missing` returned FAIL today where INDETERMINATE was expected. Root cause, verified from source: that fixture evaluates against the LIVE policy loaded from token-policy.json. In the 2026-10-29 capture it MATCHED (INDETERMINATE) because the policy's concentration thresholds were not yet set. Kenn's approved thresholds (section 5) were written into token-policy.json at 18:47 ET that day — after the capture. Against today's policy, the fixture's evidence (top10 = 52%) breaches the filed 30% cap, so the gate returns FAIL on the concentration leg. The fixture's premise ("thresholds missing") is stale relative to the live policy; the gate's behavior is the stricter, fail-closed one. The fixture expectation needs updating to match the post-threshold policy — flagged here rather than silently re-run until it passed. The ChatEBT-named risk classes are covered: permanent delegate (token2022-permanent-delegate, INDETERMINATE as expected), unknown/undecodable Token-2022 extension (token2022-unknown-extension, INDETERMINATE as expected); missing policy fields are still reported by the gate (`policy_missing_fields` currently lists the two liquidity fields, which remain empty by owner decision).

Single-fixture detail (`node token-gate.mjs --fixture thresholds-missing`, 2026-10-30): verdict FAIL; concentration check FAIL with thresholds {max_top1_pct: 10, max_top10_pct: 30}; reason "concentration over threshold: top1 7% (max 10%), top10 52% (max 30%)"; policy_missing_fields: ["liquidity.accepted_pool_programs", "liquidity.accepted_lock_or_burn_evidence_methods"].

## 3. Over-cap fee is rejected BEFORE transaction construction

Three independent demonstrations:

(a) Standalone check (raw output in section 1): `node fees.mjs check 100000 600000` -> "verdict: FAIL (FEE_OVER_CAP) — priority fee 60000 lamports (price 100000 x limit 600000) exceeds cap 50000", exit 1. No transaction exists at this point; the check is a pure function of the fee inputs.

(b) Build-response fixtures (section 1): a Jupiter build carrying the EXP-1 leg-2 'auto' charge of 100,000 lamports -> FAIL (FEE_OVER_CAP); a build with the fee unreported -> FAIL (BUILD_FEE_UNREPORTED).

(c) Source order in swap.mjs `buildSwapTx` (verbatim excerpt): the desk fee is validated BEFORE the /swap build request is sent, and the returned build is re-checked before anything can be signed —

    // CWO-010 fee cap: explicit lamports only, validated against the hard cap
    // in fees.mjs BEFORE the build request. The EXP-1 'auto' mode and the old
    // silent retry-without-a-fee-hint are both banned — if the build fails or
    // the returned build's embedded fee breaches the cap, we throw, not sign.
    const feeLamports = assertPriorityFeeLamports(DESK_PRIORITY_FEE_LAMPORTS);
    const body = { quoteResponse: quote, userPublicKey, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: feeLamports };
    const res = await fetch(`${JUP}/swap`, { method: 'POST', ... });
    ...
    const feeCheck = checkJupiterBuild(build);
    if (!feeCheck.pass) throw new Error(`fee gate: Jupiter build rejected (${feeCheck.code}) — ${feeCheck.reason}`);

## 4. EXP-2 card — field list + pre-entry status (values withheld; names only)

Required fields as filed (CWO-010 acceptance spec, section 3): Timestamp; Mint(s); Thesis + falsifiable catalyst; Source links; Entry trigger/limit; Invalidation/exit and max hold; Target/stop; Liquidity/volume snapshot; Expected slippage + fees + other drag; Drag bound; Expected net edge after drag; Risk size / maximum loss; Token gate; Fee approach; Grade fields (filled after exit): executed_in_lamports, executed_out_lamports, leg1_fee_lamports, leg2_fee_lamports, total_priority_fees_lamports, total_drag_lamports, drag_ex_rent_pct, fee_share_of_drag_pct, verdict CONFIRMED / KILLED / INCONCLUSIVE, lesson; Reviewer; Eligibility self-check.

Pre-entry status: card written 2026-10-29T11:57:00-04:00, BEFORE any entry; status PLANNED, NOT executed ("this card alone authorizes nothing in CWO-010 (tooling-only CWO, no trades)"). The card file is published in this folder in full for inspection.

## 5. Policy + spec statements

- token-policy.json concentration thresholds as filed: max_top1_pct = 10, max_top10_pct = 30 (approved by Kenn 2026-10-29; policy_version desk-token-policy/0.2). Liquidity accepted pool programs / evidence methods remain empty — a non-major can therefore still return INDETERMINATE on the liquidity leg; the gate never PASSes on missing data (failure_policy: missing/invalid policy, unsupported program/extension, RPC/indexer error, stale data, unidentified pool, or unverifiable lock/burn => FAIL or INDETERMINATE, never PASS).
- TRADING-GROKBOT-SPEC.md exposes NO signing or trade-execution interface. Grep of the spec for sign / sendTransaction / broadcast / execute / placeOrder / privateKey / keypair returns only prohibitions, verbatim: line 9 "no keys, no signing, no execution path, and no authority to override" and line 103 "never sign, never submit a trade, and never execute anything. You judge". The GrokBot is a judge over pasted card packets; it holds no keys and no execution path by design.
