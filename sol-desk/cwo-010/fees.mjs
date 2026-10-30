#!/usr/bin/env node
// fees.mjs — SOL desk manual priority-fee cap (CWO-010 deliverable 1).
//
// EXP-1 lesson (ledger 2026-10-26): Jupiter's prioritizationFeeLamports
// 'auto' charged a flat 100,000 lamports on a $1 leg and made fees 91.7%
// of round-trip drag. Rule from that day forward: priority fees are set
// EXPLICITLY, in lamports, and hard-capped. No 'auto', no silent fallback,
// no unit ambiguity — every fee input is validated before any transaction
// is constructed.
//
// Caps (desk policy constants — change here only, nowhere else):
//   PRIORITY_FEE_CAP_LAMPORTS     total priority fee per transaction
//   CU_PRICE_CAP_MICRO_LAMPORTS   compute-unit price ceiling
// Both caps apply together: a huge requested CU limit cannot smuggle an
// over-budget fee past the per-CU price cap, and vice versa.
//
// Fee math (Solana fee structure): priority fee =
//   ceil(CU price in micro-lamports/CU * requested CU limit / 1,000,000)
// The network charges on the REQUESTED limit, not consumed units.
//
// CLI:
//   node fees.mjs check <cuPriceMicroLamports> <cuLimit>   breakdown + verdict
//   node fees.mjs test                                     acceptance fixtures
// Import (execution path): see swap.mjs — assertPriorityFeeLamports(),
// checkPriorityFee(), checkJupiterBuild().

export const PRIORITY_FEE_CAP_LAMPORTS = 50_000;      // 0.00005 SOL per tx
export const CU_PRICE_CAP_MICRO_LAMPORTS = 100_000;   // micro-lamports per CU
export const BASE_FEE_LAMPORTS_PER_SIG = 5_000;       // Solana base fee
// The desk's chosen explicit priority fee for Jupiter builds (lamports).
// 10x under the cap; EXP-1's 'auto' charged 10x this on leg 2 alone.
export const DESK_PRIORITY_FEE_LAMPORTS = 10_000;

function feeError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// Validate one raw numeric input. Rejects missing values, 'auto', strings
// (unit ambiguity), negatives, and non-finite numbers — per CWO-010 spec 1.
function requireFeeNumber(value, field) {
  if (value === undefined || value === null) {
    throw feeError('FEE_MISSING', `${field} is required (explicit numeric value; 'auto' is banned)`);
  }
  if (typeof value === 'string') {
    throw feeError('FEE_NOT_NUMERIC', `${field} must be a number, got string ${JSON.stringify(value)} — 'auto' and unit-suffixed strings are banned`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw feeError('FEE_NON_FINITE', `${field} must be a finite number, got ${String(value)}`);
  }
  if (!Number.isInteger(value)) {
    throw feeError('FEE_NOT_INTEGER', `${field} must be an integer (lamports / micro-lamports are indivisible), got ${value}`);
  }
  if (value < 0) {
    throw feeError('FEE_NEGATIVE', `${field} must be >= 0, got ${value}`);
  }
  return value;
}

// ceil(price * limit / 1e6) in exact integer arithmetic.
export function computePriorityFeeLamports(cuPriceMicroLamports, cuLimit) {
  const price = requireFeeNumber(cuPriceMicroLamports, 'cuPriceMicroLamports');
  const limit = requireFeeNumber(cuLimit, 'cuLimit');
  return Number((BigInt(price) * BigInt(limit) + 999_999n) / 1_000_000n);
}

// Full check for a (CU price, CU limit) pair against BOTH caps.
// Returns a structured verdict; never throws.
export function checkPriorityFee(input = {}) {
  const breakdown = {
    cuPriceMicroLamports: input.cuPriceMicroLamports ?? null,
    cuLimit: input.cuLimit ?? null,
    priorityFeeLamports: null,
    capLamports: PRIORITY_FEE_CAP_LAMPORTS,
    cuPriceCapMicroLamports: CU_PRICE_CAP_MICRO_LAMPORTS,
    baseFeeLamportsPerSig: BASE_FEE_LAMPORTS_PER_SIG,
    estimatedTotalFeeLamports: null,
  };
  try {
    const price = requireFeeNumber(input.cuPriceMicroLamports, 'cuPriceMicroLamports');
    const limit = requireFeeNumber(input.cuLimit, 'cuLimit');
    if (price > CU_PRICE_CAP_MICRO_LAMPORTS) {
      return { pass: false, code: 'CU_PRICE_OVER_CAP', reason: `CU price ${price} micro-lamports exceeds per-CU cap ${CU_PRICE_CAP_MICRO_LAMPORTS}`, breakdown };
    }
    const fee = computePriorityFeeLamports(price, limit);
    breakdown.priorityFeeLamports = fee;
    breakdown.estimatedTotalFeeLamports = fee + BASE_FEE_LAMPORTS_PER_SIG;
    if (fee > PRIORITY_FEE_CAP_LAMPORTS) {
      return { pass: false, code: 'FEE_OVER_CAP', reason: `priority fee ${fee} lamports (price ${price} x limit ${limit}) exceeds cap ${PRIORITY_FEE_CAP_LAMPORTS}`, breakdown };
    }
    return { pass: true, code: 'OK', reason: `priority fee ${fee} lamports within cap ${PRIORITY_FEE_CAP_LAMPORTS}`, breakdown };
  } catch (e) {
    return { pass: false, code: e.code || 'FEE_INVALID', reason: e.message, breakdown };
  }
}

// Validate a bare lamports amount (the form Jupiter's /swap takes).
// Returns the value or throws. Used by the execution path BEFORE building.
export function assertPriorityFeeLamports(value) {
  const v = requireFeeNumber(value, 'prioritizationFeeLamports');
  if (v > PRIORITY_FEE_CAP_LAMPORTS) {
    throw feeError('FEE_OVER_CAP', `prioritizationFeeLamports ${v} exceeds cap ${PRIORITY_FEE_CAP_LAMPORTS}`);
  }
  return v;
}

// Quote/build check: given a Jupiter /swap build response, reject it if
// the priority fee Jupiter actually embedded exceeds the cap, or if the
// build came back with 'auto'/missing fee handling. Fail closed.
export function checkJupiterBuild(build) {
  if (!build || typeof build !== 'object') {
    return { pass: false, code: 'BUILD_MISSING', reason: 'no Jupiter build response to check' };
  }
  const v = build.prioritizationFeeLamports;
  if (v === undefined || v === null) {
    // We always request an explicit fee; a build without one means the
    // request was not honored as sent — do not sign blind.
    return { pass: false, code: 'BUILD_FEE_UNREPORTED', reason: 'build response does not report prioritizationFeeLamports; refusing to assume the fee' };
  }
  try {
    assertPriorityFeeLamports(v);
  } catch (e) {
    return { pass: false, code: e.code || 'BUILD_FEE_INVALID', reason: e.message };
  }
  return { pass: true, code: 'OK', reason: `build priority fee ${v} lamports within cap ${PRIORITY_FEE_CAP_LAMPORTS}` };
}

// ---------------------------------------------------------------- CLI ----
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'check') {
    const r = checkPriorityFee({ cuPriceMicroLamports: a === undefined ? undefined : Number(a), cuLimit: b === undefined ? undefined : Number(b) });
    const d = r.breakdown;
    console.log(`CU price (micro-lamports/CU): ${d.cuPriceMicroLamports}`);
    console.log(`requested CU limit:           ${d.cuLimit}`);
    console.log(`priority fee (lamports):      ${d.priorityFeeLamports}`);
    console.log(`configured cap (lamports):    ${d.capLamports}`);
    console.log(`base fee per signature:       ${d.baseFeeLamportsPerSig}`);
    console.log(`estimated total fee:          ${d.estimatedTotalFeeLamports}`);
    console.log(`verdict: ${r.pass ? 'PASS' : 'FAIL'} (${r.code}) — ${r.reason}`);
    process.exit(r.pass ? 0 : 1);
  } else if (cmd === 'test') {
    const cases = [
      // CWO-010 acceptance matrix, section 1 (Oct 29 03:04 + Oct 28 10:52).
      { name: 'missing fee', input: {}, expectPass: false },
      { name: "'auto' fee", input: { cuPriceMicroLamports: 'auto', cuLimit: 200_000 }, expectPass: false },
      { name: 'negative fee', input: { cuPriceMicroLamports: -1, cuLimit: 200_000 }, expectPass: false },
      { name: 'NaN fee', input: { cuPriceMicroLamports: NaN, cuLimit: 200_000 }, expectPass: false },
      { name: 'Infinity fee', input: { cuPriceMicroLamports: Infinity, cuLimit: 200_000 }, expectPass: false },
      { name: 'known fixture 5000 x 200000 = 1000', input: { cuPriceMicroLamports: 5_000, cuLimit: 200_000 }, expectPass: true, expectFee: 1_000 },
      { name: 'CU price over per-CU cap', input: { cuPriceMicroLamports: 100_001, cuLimit: 200_000 }, expectPass: false },
      { name: 'computed fee over total cap (100000 x 600000 = 60000)', input: { cuPriceMicroLamports: 100_000, cuLimit: 600_000 }, expectPass: false },
      { name: 'exactly at total cap (50000 x 1000000 = 50000)', input: { cuPriceMicroLamports: 50_000, cuLimit: 1_000_000 }, expectPass: true, expectFee: 50_000 },
    ];
    let failed = 0;
    for (const c of cases) {
      const r = checkPriorityFee(c.input);
      const feeOk = c.expectFee === undefined || r.breakdown.priorityFeeLamports === c.expectFee;
      const ok = r.pass === c.expectPass && feeOk;
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} -> verdict=${r.pass ? 'PASS' : 'FAIL'} (${r.code}) fee=${r.breakdown.priorityFeeLamports}`);
    }
    // Build-response checks (the EXP-1 failure, replayed):
    const buildCases = [
      { name: "build with EXP-1 leg-2 'auto' charge 100000", build: { prioritizationFeeLamports: 100_000 }, expectPass: false },
      { name: 'build with desk explicit fee 10000', build: { prioritizationFeeLamports: DESK_PRIORITY_FEE_LAMPORTS }, expectPass: true },
      { name: "build with 'auto' unexpanded", build: { prioritizationFeeLamports: 'auto' }, expectPass: false },
      { name: 'build with fee unreported', build: {}, expectPass: false },
    ];
    for (const c of buildCases) {
      const r = checkJupiterBuild(c.build);
      const ok = r.pass === c.expectPass;
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} -> verdict=${r.pass ? 'PASS' : 'FAIL'} (${r.code})`);
    }
    console.log(failed === 0 ? 'ALL FEE FIXTURES PASS' : `${failed} FIXTURE(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
  } else {
    console.error('usage: node fees.mjs check <cuPriceMicroLamports> <cuLimit> | node fees.mjs test');
    process.exit(2);
  }
}
