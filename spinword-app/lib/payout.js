"use client";
/*
  lib/payout.js — POT SETTLEMENT SEAM (frontend only)

  This module computes *who ranks where* and *what each winner's share of the
  operator-funded daily pot is*. It intentionally does NOT move tokens.

  The daily pot is funded by the operator/treasury (see NEXT_PUBLIC_DAILY_POT).
  Players never stake or deposit to play — rewards are a distribution from the
  operator-funded pot to top solvers. That keeps this a reward faucet, not a wager.

  The actual on-chain transfer of $SPIN to winners must be performed by YOUR
  audited settlement program / backend signer holding the treasury key. Wire it
  into `settleDailyPot` where marked. Do not ship real transfers from unaudited code.
*/

export const DAILY_POT = Number(process.env.NEXT_PUBLIC_DAILY_POT || 100000);

// rank weight — top-heavy but everyone who solves gets something
export function rankWeight(rank) {
  return 1 / Math.pow(rank, 1.15);
}

// given solvers sorted best->worst, return [{...solver, rank, share}]
export function computeShares(sortedSolvers, pot = DAILY_POT) {
  const weights = sortedSolvers.map((_, i) => rankWeight(i + 1));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return sortedSolvers.map((s, i) => ({
    ...s,
    rank: i + 1,
    share: Math.floor((pot * weights[i]) / sum),
  }));
}

// sort key: fewer rows first, then faster solve time
export function rankSolvers(solvers) {
  return [...solvers].sort((a, b) => (a.row - b.row) || (a.timeSec - b.timeSec));
}

// illustrative split for the UI (top ranks as % of pot, assuming ~nSolvers)
export function splitPreview(nSolvers = 20, pot = DAILY_POT) {
  const shares = computeShares(Array.from({ length: nSolvers }, () => ({})), pot);
  return shares.slice(0, 3).map((s) => Math.round((s.share / pot) * 100));
}

/*
  settleDailyPot(rankedWithShares)
  -------------------------------------------------------------------
  Called by YOUR backend at 00:00 UTC once the day's leaderboard is final.
  rankedWithShares = [{ wallet, rank, share }, ...]

  >>> PLUG YOUR AUDITED PROGRAM IN HERE <<<
  e.g. build a Solana tx (or batched txs) transferring `share` $SPIN from the
  treasury token account to each `wallet`, signed by your operator key on the
  server. This file deliberately contains no key handling and no transfer.
*/
export async function settleDailyPot(/* rankedWithShares */) {
  throw new Error(
    "settleDailyPot is a stub. Wire your audited on-chain settlement program here (server-side, treasury-signed)."
  );
}
