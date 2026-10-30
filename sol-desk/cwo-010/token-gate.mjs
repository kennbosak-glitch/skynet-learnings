#!/usr/bin/env node
// token-gate.mjs — SOL desk token gate, FAIL CLOSED (CWO-010 deliverable 2).
//
// Desk rule (Kenn 2026-10-26, funding receipt): every non-major token is
// verification-gated before entry — mint/freeze authority, liquidity,
// holder concentration. ChatEBT's acceptance spec (Oct 28-29) hardened it:
//   * PASS only when every check passes against an APPROVED policy.
//   * Missing policy values, stale/incomplete data, unidentified LP,
//     unverifiable lock/burn, RPC/indexer errors, or an unsupported
//     Token-2022 extension surface => FAIL / INDETERMINATE, never PASS.
//   * Thresholds are owner-approved config (token-policy.json), never
//     invented here. The shipped policy is a DRAFT with null thresholds,
//     so today every non-major correctly resolves INDETERMINATE.
// Majors (explicit allowlist in the policy) pass by identity — the same
// basis EXP-1 used for USDC — with live evidence still recorded.
//
// No keys, no signing, read-only public RPC. Usage:
//   node token-gate.mjs <mintAddress>            live check (JSON verdict)
//   node token-gate.mjs --fixture <name>         offline synthetic fixtures
//   node token-gate.mjs --fixtures               list fixture names
// Requires proxy env for live RPC: source ~/workspace/telegram-user/proxy.env
import { readFileSync } from 'node:fs';

const RPC = 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const POLICY = JSON.parse(readFileSync(new URL('./token-policy.json', import.meta.url), 'utf8'));

async function rpc(method, params) {
  // Public RPC rate-limits (HTTP 429) under burst load — back off and
  // retry a few times before surfacing the error to the fail-closed path.
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (res.status === 429) { lastErr = new Error('RPC HTTP 429'); continue; }
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const j = await res.json();
    if (j.error) throw new Error(`RPC ${method}: ${JSON.stringify(j.error)}`);
    return j.result;
  }
  throw lastErr || new Error('RPC retries exhausted');
}

// Policy validation (DEPOT config contract): configuration validity is
// judged separately from the token verdict. Missing/null/out-of-range
// fields are named exactly; no defaults are substituted.
export function validatePolicy(policy) {
  const missing = [];
  if (!policy || typeof policy !== 'object') return ['policy:unreadable'];
  if (!policy.policy_version) missing.push('policy_version');
  if (!policy.cluster) missing.push('cluster');
  if (!Array.isArray(policy.supported_token_programs) || policy.supported_token_programs.length === 0) missing.push('supported_token_programs');
  const c = policy.concentration || {};
  if (c.max_top1_pct === null || c.max_top1_pct === undefined) missing.push('concentration.max_top1_pct');
  if (c.max_top10_pct === null || c.max_top10_pct === undefined) missing.push('concentration.max_top10_pct');
  if (!c.denominator_definition) missing.push('concentration.denominator_definition');
  if (!(c.max_snapshot_age_seconds > 0)) missing.push('concentration.max_snapshot_age_seconds');
  const l = policy.liquidity || {};
  if (!Array.isArray(l.accepted_pool_programs) || l.accepted_pool_programs.length === 0) missing.push('liquidity.accepted_pool_programs');
  if (!Array.isArray(l.accepted_lock_or_burn_evidence_methods) || l.accepted_lock_or_burn_evidence_methods.length === 0) missing.push('liquidity.accepted_lock_or_burn_evidence_methods');
  return missing;
}

// Core evaluator. `evidence` is a normalized object so the SAME logic runs
// live RPC data and synthetic fixtures:
// { programId, mintAuthority, freezeAuthority, supply, decimals,
//   largest: [{address, amount}], extensions: [names] | null,
//   lp: { status: 'evidenced'|'unidentified'|'unproven', detail } }
export function evaluate(mint, evidence, policy, meta = {}) {
  const checks = {};
  const reasons = [];
  const major = (policy.majors_allowlist || []).find(m => m.mint === mint);
  if (major) {
    return {
      mint, class: 'MAJOR_ALLOWLIST', symbol: major.symbol, verdict: 'PASS',
      checks: { allowlist: { result: 'PASS', basis: major.basis } },
      reasons: [`allowlisted major (${major.symbol}) — passes by identity; live evidence recorded separately`],
      ...meta,
    };
  }
  // Token program surface
  if (evidence.programId === TOKEN_2022_PROGRAM) {
    const ext = evidence.extensions;
    checks.token_program = { result: 'INDETERMINATE', program: 'Token-2022', extensions: ext };
    reasons.push(policy.token2022_supported
      ? 'Token-2022 present but extension inventory could not be fully evaluated'
      : 'Token-2022 mint: extension surface NOT supported by policy (incl. permanent-delegate risk) — fail closed');
    if (Array.isArray(ext) && ext.includes('permanentDelegate')) {
      reasons.push('permanent delegate extension present: a mint-level delegate can move/burn any holder\'s tokens and cannot be revoked by holders');
    }
  } else if (evidence.programId === TOKEN_PROGRAM) {
    checks.token_program = { result: 'PASS', program: 'legacy SPL' };
  } else {
    checks.token_program = { result: 'FAIL', program: evidence.programId || 'unknown' };
    reasons.push(`account owner ${evidence.programId} is not a supported token program`);
  }
  if (!(policy.supported_token_programs || []).includes(evidence.programId)) {
    if (checks.token_program.result === 'PASS') checks.token_program.result = 'INDETERMINATE';
    reasons.push('token program not in policy.supported_token_programs');
  }
  // Authorities — hard fails, independent of policy values.
  checks.mint_authority = { result: evidence.mintAuthority === null ? 'PASS' : 'FAIL', value: evidence.mintAuthority };
  if (evidence.mintAuthority !== null) reasons.push(`mint authority ACTIVE (${evidence.mintAuthority}) — new supply can be minted`);
  checks.freeze_authority = { result: evidence.freezeAuthority === null ? 'PASS' : 'FAIL', value: evidence.freezeAuthority };
  if (evidence.freezeAuthority !== null) reasons.push(`freeze authority ACTIVE (${evidence.freezeAuthority}) — holder accounts can be frozen`);
  // Concentration — needs approved thresholds; raw numbers always shown.
  const supply = Number(evidence.supply);
  const amounts = (evidence.largest || []).map(a => Number(a.amount)).sort((x, y) => y - x);
  const pct = n => supply > 0 ? +(100 * n / supply).toFixed(4) : null;
  const top1 = amounts.length ? pct(amounts[0]) : null;
  const top10 = amounts.length ? pct(amounts.slice(0, 10).reduce((s, n) => s + n, 0)) : null;
  const missingPolicy = validatePolicy(policy);
  checks.concentration = {
    result: 'INDETERMINATE', raw_top1_pct: top1, raw_top10_pct: top10,
    adjusted_top1_pct: top1, adjusted_top10_pct: top10,
    note: 'adjusted == raw: no exclusion is applied without evidence-backed account labels',
    thresholds: { max_top1_pct: policy.concentration?.max_top1_pct ?? null, max_top10_pct: policy.concentration?.max_top10_pct ?? null },
  };
  if (amounts.length === 0) {
    reasons.push('holder data incomplete (no largest-accounts snapshot) — cannot evaluate concentration');
  } else if (policy.concentration?.max_top1_pct == null || policy.concentration?.max_top10_pct == null) {
    reasons.push('concentration thresholds not owner-approved (max_top1_pct/max_top10_pct missing) — cannot PASS');
  } else if (top1 > policy.concentration.max_top1_pct || top10 > policy.concentration.max_top10_pct) {
    checks.concentration.result = 'FAIL';
    reasons.push(`concentration over threshold: top1 ${top1}% (max ${policy.concentration.max_top1_pct}%), top10 ${top10}% (max ${policy.concentration.max_top10_pct}%)`);
  } else {
    checks.concentration.result = 'PASS';
  }
  // Liquidity — needs an identified pool + an accepted evidence method.
  checks.liquidity = { result: 'INDETERMINATE', ...(evidence.lp || { status: 'unidentified' }) };
  if (!evidence.lp || evidence.lp.status === 'unidentified') {
    reasons.push('LP/pool not identified — no liquidity evidence');
  } else if (evidence.lp.status === 'unproven') {
    reasons.push('LP lock/burn claimed but not verifiable with an accepted evidence method — badges and project claims do not count');
  } else if (evidence.lp.status === 'evidenced') {
    checks.liquidity.result = 'PASS';
  }
  const results = Object.values(checks).map(c => c.result);
  const verdict = results.includes('FAIL') ? 'FAIL' : results.every(r => r === 'PASS') ? 'PASS' : 'INDETERMINATE';
  return { mint, class: 'NON_MAJOR', verdict, checks, policy_missing_fields: missingPolicy, reasons, ...meta };
}

async function liveCheck(mint) {
  const meta = { cluster: POLICY.cluster, source: RPC, policy_version: POLICY.policy_version };
  let slot = null;
  try {
    const info = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
    slot = info.context?.slot ?? null;
    const val = info.value;
    if (!val) {
      const major = (POLICY.majors_allowlist || []).find(m => m.mint === mint);
      return { mint, class: major ? 'MAJOR_ALLOWLIST' : 'NON_MAJOR', verdict: 'FAIL', checks: {}, reasons: ['mint account not found on this cluster — unknown token fails closed'], ...meta, slot, fetched_at: new Date().toISOString() };
    }
    const parsed = val.data?.parsed?.info || {};
    const major = (POLICY.majors_allowlist || []).find(m => m.mint === mint);
    if (major) {
      // Majors pass by identity (policy basis); concentration/LP fetches are
      // not part of their gate, so a rate-limited evidence call cannot and
      // should not block the verdict.
      const out = evaluate(mint, { programId: val.owner, mintAuthority: parsed.mintAuthority ?? null, freezeAuthority: parsed.freezeAuthority ?? null, supply: parsed.supply, largest: [], extensions: null, lp: { status: 'unidentified' } }, POLICY, meta);
      out.slot = slot;
      out.fetched_at = new Date().toISOString();
      out.evidence = { program: val.owner, mintAuthority: parsed.mintAuthority ?? null, freezeAuthority: parsed.freezeAuthority ?? null, decimals: parsed.decimals, supply: parsed.supply };
      return out;
    }
    // Non-major: fetch holder snapshot independently — if the indexer/RPC
    // refuses it, concentration stays INDETERMINATE (never PASS) while the
    // authority checks still report.
    let largest = [];
    let largestError = null;
    try {
      const l = await rpc('getTokenLargestAccounts', [mint]);
      largest = (l.value || []).map(a => ({ address: a.address, amount: a.amount }));
    } catch (e) { largestError = e.message; }
    const evidence = {
      programId: val.owner,
      mintAuthority: parsed.mintAuthority ?? null,
      freezeAuthority: parsed.freezeAuthority ?? null,
      supply: parsed.supply, decimals: parsed.decimals,
      largest,
      extensions: val.owner === TOKEN_2022_PROGRAM ? (val.data?.parsed?.info?.extensions || []).map(e => e.extension) : null,
      lp: { status: 'unidentified', detail: 'no pool/LP evidence supplied and no accepted evidence method configured in policy' },
    };
    const out = evaluate(mint, evidence, POLICY, meta);
    if (largestError) out.reasons.push(`holder snapshot fetch failed (${largestError}) — concentration INDETERMINATE, fail closed`);
    out.slot = slot;
    out.fetched_at = new Date().toISOString();
    out.evidence = { decimals: parsed.decimals, supply: parsed.supply, largest_accounts: largest.length };
    return out;
  } catch (e) {
    // RPC/indexer error => INDETERMINATE, never PASS (fail closed).
    const major = (POLICY.majors_allowlist || []).find(m => m.mint === mint);
    return { mint, class: major ? 'MAJOR_ALLOWLIST' : 'NON_MAJOR', verdict: 'INDETERMINATE', checks: {}, reasons: [`RPC error while fetching evidence: ${e.message} — fail closed`], ...meta, slot, fetched_at: new Date().toISOString() };
  }
}

// ------------------------------------------------------------ fixtures ----
const APPROVED_TEST_POLICY = {
  ...POLICY,
  policy_version: 'fixture-policy/APPROVED-TEST-ONLY',
  concentration: { ...POLICY.concentration, max_top1_pct: 25, max_top10_pct: 60 },
  liquidity: { accepted_pool_programs: ['fixture-pool-program'], accepted_lock_or_burn_evidence_methods: ['fixture-onchain-burn-attestation'], minimum_lock_duration_seconds: null },
  supported_token_programs: [TOKEN_PROGRAM],
};
const baseEvidence = {
  programId: TOKEN_PROGRAM, mintAuthority: null, freezeAuthority: null,
  supply: '1000000000', decimals: 6,
  largest: Array.from({ length: 20 }, (_, i) => ({ address: `holder${i}`, amount: String(70_000_000 - i * 4_000_000) })),
  extensions: null,
  lp: { status: 'evidenced', detail: 'fixture: LP tokens burned, burn tx attested by accepted method' },
};
const FIXTURES = {
  'safe-legacy': { policy: APPROVED_TEST_POLICY, evidence: baseEvidence, expect: 'PASS' },
  'mint-authority-active': { policy: APPROVED_TEST_POLICY, evidence: { ...baseEvidence, mintAuthority: 'AttackerMintAuth111111111111111111111111111' }, expect: 'FAIL' },
  'freeze-authority-active': { policy: APPROVED_TEST_POLICY, evidence: { ...baseEvidence, freezeAuthority: 'AttackerFreezeAuth1111111111111111111111111' }, expect: 'FAIL' },
  'thresholds-missing': { policy: POLICY, evidence: baseEvidence, expect: 'INDETERMINATE' },
  'concentration-over': { policy: APPROVED_TEST_POLICY, evidence: { ...baseEvidence, largest: [{ address: 'whale', amount: '400000000' }, ...baseEvidence.largest.slice(1)] }, expect: 'FAIL' },
  'lp-unproven-badge': { policy: APPROVED_TEST_POLICY, evidence: { ...baseEvidence, lp: { status: 'unproven', detail: 'project website shows an LP LOCKED badge; no on-chain attestation' } }, expect: 'INDETERMINATE' },
  'token2022-permanent-delegate': { policy: APPROVED_TEST_POLICY, evidence: { ...baseEvidence, programId: TOKEN_2022_PROGRAM, extensions: ['permanentDelegate'] }, expect: 'INDETERMINATE' },
  'token2022-unknown-extension': { policy: APPROVED_TEST_POLICY, evidence: { ...baseEvidence, programId: TOKEN_2022_PROGRAM, extensions: ['someFutureExtension'] }, expect: 'INDETERMINATE' },
};

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [arg, name] = process.argv.slice(2);
  if (arg === '--fixtures') {
    console.log(Object.keys(FIXTURES).join('\n'));
  } else if (arg === '--fixture') {
    const f = FIXTURES[name];
    if (!f) { console.error(`unknown fixture ${name}; try --fixtures`); process.exit(2); }
    const out = evaluate('FixtureMint1111111111111111111111111111111111', f.evidence, f.policy, { mode: 'FIXTURE', fixture: name });
    out.expected = f.expect;
    out.fixture_result = out.verdict === f.expect ? 'MATCH' : 'MISMATCH';
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.fixture_result === 'MATCH' ? 0 : 1);
  } else if (arg === '--test') {
    let bad = 0;
    for (const [n, f] of Object.entries(FIXTURES)) {
      const out = evaluate('FixtureMint1111111111111111111111111111111111', f.evidence, f.policy, { mode: 'FIXTURE', fixture: n });
      const ok = out.verdict === f.expect;
      if (!ok) bad++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  fixture ${n} -> ${out.verdict} (expected ${f.expect})`);
    }
    console.log(bad === 0 ? 'ALL GATE FIXTURES MATCH' : `${bad} FIXTURE MISMATCH(ES)`);
    process.exit(bad === 0 ? 0 : 1);
  } else if (arg && !arg.startsWith('--')) {
    console.log(JSON.stringify(await liveCheck(arg), null, 2));
  } else {
    console.error('usage: node token-gate.mjs <mint> | --fixture <name> | --fixtures | --test');
    process.exit(2);
  }
}
