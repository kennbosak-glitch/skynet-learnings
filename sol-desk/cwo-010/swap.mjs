#!/usr/bin/env node
// Jupiter swap executor — EXP-1 only (round-trip rail proof).
// Flow per leg: quote (impact gate) -> POST /swap -> sign locally ->
// simulate (sigVerify) -> send -> confirm -> read executed amounts from tx meta.
// Keys never leave memory; no verb prints secrets. Requires proxy env sourced
// and SKYNET_WALLET_PASSPHRASE set, same as wallet-sol.mjs.
import { mnemonicToSeedSync } from '@scure/bip39';
import { createDecipheriv, createHmac, createPrivateKey, createPublicKey, scryptSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DESK_PRIORITY_FEE_LAMPORTS, assertPriorityFeeLamports, checkJupiterBuild } from './fees.mjs';

const ENC = '/home/hatch/.config/skynet-agent-wallet-sol/wallet.enc';
const RPC = 'https://api.mainnet-beta.solana.com';
const JUP = 'https://lite-api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const LEG1_LAMPORTS = '10000000'; // 0.010000 SOL per EXP-1 card
const SLIPPAGE_BPS = 50;
const pp = process.env.SKYNET_WALLET_PASSPHRASE;
if (!pp) { console.error('SKYNET_WALLET_PASSPHRASE not set'); process.exit(2); }

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(buf) {
  let zeros = 0; while (zeros < buf.length && buf[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < buf.length; i++) {
    let carry = buf[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return zeros === buf.length ? out : out;
}
function hmac512(key, data) { return createHmac('sha512', key).update(data).digest(); }
function derive(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic);
  let I = hmac512(Buffer.from('ed25519 seed'), Buffer.from(seed));
  let k = I.subarray(0, 32), c = I.subarray(32);
  for (const idx of [44, 501, 0, 0]) {
    const ser = Buffer.alloc(4); ser.writeUInt32BE(idx + 0x80000000);
    I = hmac512(c, Buffer.concat([Buffer.from([0]), k, ser]));
    k = I.subarray(0, 32); c = I.subarray(32);
  }
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), k]);
  const privKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(privKey).export({ format: 'der', type: 'spki' });
  const pub = Buffer.from(spki.subarray(spki.length - 32));
  return { privKey, pub, address: base58Encode(pub) };
}
function decrypt() {
  const o = JSON.parse(readFileSync(ENC, 'utf8'));
  const key = scryptSync(pp, Buffer.from(o.salt, 'base64'), 32);
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(o.iv, 'base64'));
  d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(o.ct, 'base64')), d.final()]).toString('utf8');
}

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(`RPC ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}
async function getBalance(addr) { return (await rpc('getBalance', [addr])).value; }
async function getQuote(inMint, outMint, amount) {
  const url = `${JUP}/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${amount}&slippageBps=${SLIPPAGE_BPS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`quote HTTP ${res.status}`);
  return res.json();
}
async function buildSwapTx(quote, userPublicKey) {
  // CWO-010 fee cap: explicit lamports only, validated against the hard cap
  // in fees.mjs BEFORE the build request. The EXP-1 'auto' mode and the old
  // silent retry-without-a-fee-hint are both banned — if the build fails or
  // the returned build's embedded fee breaches the cap, we throw, not sign.
  const feeLamports = assertPriorityFeeLamports(DESK_PRIORITY_FEE_LAMPORTS);
  const body = { quoteResponse: quote, userPublicKey, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: feeLamports };
  const res = await fetch(`${JUP}/swap`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`swap build HTTP ${res.status}: ${await res.text()}`);
  const build = await res.json();
  const feeCheck = checkJupiterBuild(build);
  if (!feeCheck.pass) throw new Error(`fee gate: Jupiter build rejected (${feeCheck.code}) — ${feeCheck.reason}`);
  return build;
}
// Sign a base64 VersionedTransaction where signer is accountKeys[0] (fee payer).
function signTx(b64, wallet) {
  const raw = Buffer.from(b64, 'base64');
  let off = 0, shift = 0, numSigs = 0;
  for (;;) { const b = raw[off++]; numSigs |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7; }
  const sigStart = off;
  const msgStart = sigStart + 64 * numSigs;
  const message = raw.subarray(msgStart);
  // Safety gate: accountKeys[0] in the message must be our pubkey.
  // Versioned (v0) messages carry a 0x80|version prefix byte before the header.
  let moff = (message[0] & 0x80) ? 1 : 0;
  moff += 3; // header: numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned
  let kshift = 0, numKeys = 0;
  for (;;) { const b = message[moff++]; numKeys |= (b & 0x7f) << kshift; if (!(b & 0x80)) break; kshift += 7; }
  const key0 = message.subarray(moff, moff + 32);
  if (!key0.equals(wallet.pub)) throw new Error('accountKeys[0] != wallet pubkey — refusing to sign');
  if (numSigs < 1) throw new Error('tx has no signature slots');
  const sig = sign(null, message, wallet.privKey);
  const out = Buffer.from(raw);
  sig.copy(out, sigStart);
  return out.toString('base64');
}
async function simulate(b64) {
  const r = await rpc('simulateTransaction', [b64, { sigVerify: true, commitment: 'confirmed', encoding: 'base64' }]);
  return r.value;
}
async function sendAndConfirm(b64) {
  const sig = await rpc('sendTransaction', [b64, { encoding: 'base64', skipPreflight: true, maxRetries: 3 }]);
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const st = (await rpc('getSignatureStatuses', [[sig]])).value[0];
    if (st) {
      if (st.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(st.err)}`);
      if (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized') return sig;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`tx ${sig} not confirmed in 120s`);
}
async function txMeta(sig) {
  const tx = await rpc('getTransaction', [sig, { maxSupportedTransactionVersion: 0, encoding: 'json' }]);
  if (!tx) throw new Error(`getTransaction ${sig} returned null`);
  return tx;
}
function tokenDelta(tx, mint, owner) {
  const pre = (tx.meta.preTokenBalances || []).find(b => b.mint === mint && b.owner === owner);
  const post = (tx.meta.postTokenBalances || []).find(b => b.mint === mint && b.owner === owner);
  return { pre: pre ? BigInt(pre.uiTokenAmount.amount) : 0n, post: post ? BigInt(post.uiTokenAmount.amount) : 0n };
}

const rec = JSON.parse(decrypt());
const wallet = derive(rec.mnemonic);
if (wallet.address !== rec.address) throw new Error('derived address mismatch');
const addr = wallet.address;
const out = { experiment: 'EXP-1', address: addr, started_at: new Date().toISOString() };

out.balance_before_lamports = await getBalance(addr);
const ataCheck = await rpc('getTokenAccountsByOwner', [addr, { mint: USDC_MINT }, { encoding: 'jsonParsed' }]);
out.usdc_ata_existed_before = (ataCheck.value || []).length > 0;

// ---- LEG 1: SOL -> USDC ----
const q1 = await getQuote(SOL_MINT, USDC_MINT, LEG1_LAMPORTS);
out.leg1_quote = { inAmount: q1.inAmount, outAmount: q1.outAmount, priceImpactPct: q1.priceImpactPct, route: (q1.routePlan || []).map(r => r.swapInfo && r.swapInfo.label) };
if (parseFloat(q1.priceImpactPct) >= 0.1) throw new Error(`entry gate: impact ${q1.priceImpactPct}% >= 0.1% — aborting`);
const s1 = await buildSwapTx(q1, addr);
const signed1 = signTx(s1.swapTransaction, wallet);
const sim1 = await simulate(signed1);
out.leg1_simulation_err = sim1.err;
if (sim1.err) { out.aborted = 'leg1 simulation failed'; console.log(JSON.stringify(out, null, 2)); process.exit(5); }
out.leg1_tx = await sendAndConfirm(signed1);
const m1 = await txMeta(out.leg1_tx);
const d1 = tokenDelta(m1, USDC_MINT, addr);
out.leg1_executed = { fee_lamports: m1.meta.fee, usdc_received: d1.post.toString(), slot: m1.slot };
if (d1.post <= 0n) throw new Error('leg1 landed but no USDC received — STOP, state inconsistent');

// ---- LEG 2: USDC -> SOL (full received amount) ----
const q2 = await getQuote(USDC_MINT, SOL_MINT, d1.post.toString());
out.leg2_quote = { inAmount: q2.inAmount, outAmount: q2.outAmount, priceImpactPct: q2.priceImpactPct, route: (q2.routePlan || []).map(r => r.swapInfo && r.swapInfo.label) };
if (parseFloat(q2.priceImpactPct) >= 0.1) throw new Error(`exit gate: impact ${q2.priceImpactPct}% >= 0.1% — holding USDC, aborting leg2`);
const s2 = await buildSwapTx(q2, addr);
const signed2 = signTx(s2.swapTransaction, wallet);
const sim2 = await simulate(signed2);
out.leg2_simulation_err = sim2.err;
if (sim2.err) { out.aborted = 'leg2 simulation failed — holding USDC'; console.log(JSON.stringify(out, null, 2)); process.exit(6); }
out.leg2_tx = await sendAndConfirm(signed2);
const m2 = await txMeta(out.leg2_tx);
const d2 = tokenDelta(m2, USDC_MINT, addr);
out.leg2_executed = { fee_lamports: m2.meta.fee, usdc_remaining: d2.post.toString(), slot: m2.slot };

out.balance_after_lamports = await getBalance(addr);
const totalDrag = out.balance_before_lamports - out.balance_after_lamports;
const totalFees = m1.meta.fee + m2.meta.fee;
// Rent is MEASURED, never assumed: sum lamports held in the USDC ATA(s) after
// the run (EXP-1 lesson: chain charged 1,488,440, not the textbook 2,039,280).
const ataAfter = await rpc('getTokenAccountsByOwner', [addr, { mint: USDC_MINT }, { encoding: 'jsonParsed' }]);
const ataLamports = (ataAfter.value || []).reduce((s, a) => s + (a.account.lamports || 0), 0);
const rent = out.usdc_ata_existed_before ? 0 : ataLamports;
out.totals = {
  total_drag_lamports: totalDrag,
  fees_lamports: totalFees,
  ata_rent_lamports_attributed: rent,
  executed_spread_impact_lamports: totalDrag - totalFees - rent,
  drag_ex_rent_pct_of_leg1: ((totalDrag - rent) / Number(LEG1_LAMPORTS) * 100).toFixed(4) + '%',
};
out.finished_at = new Date().toISOString();
console.log(JSON.stringify(out, null, 2));
