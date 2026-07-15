import { randomBytes, randomUUID } from "node:crypto";
import type { SpinwordDb } from "./db";
import { getDb } from "./db";
import { ACTIVE_POOL_VERSION, limits, PAYTABLES } from "./config";
import { calculateReturnMinor } from "./money";
import { decryptSeed, encryptSeed, generateServerSeed, scoreGuess, seedCommitment, selectWordIndex } from "./fairness";
import { DomainError, type GameMode, type Paytable, type PublicGuess, type PublicRound, type VirtualCurrency } from "./types";

type RoundRow = {
  id: string; public_ref: string; player_id: string; mode: GameMode; currency: VirtualCurrency; play_amount_minor: number;
  status: "ACTIVE" | "SETTLED" | "VOIDED" | "EXPIRED"; outcome: "WON" | "LOST" | null;
  paytable_version: string; paytable_snapshot_json: string; word_pool_version: string; answer_position: number; answer_word: string;
  server_seed_hash: string; encrypted_server_seed: string; revealed_server_seed: string | null; client_seed: string; nonce: number;
  guesses_used: number; multiplier_basis_points: number | null; payout_amount_minor: number | null; verification_status: string;
  created_at: string; settled_at: string | null;
};

type PlayerRow = {
  id: string; display_name: string; public_wins_opt_in: number; status: string; next_nonce: number;
  preferred_mode: GameMode; preferred_currency: VirtualCurrency; preferred_amount_minor: number;
  daily_play_limit_minor: number | null; cooling_off_until: string | null;
};

const isoNow = () => new Date().toISOString();
const utcDate = (date = new Date()) => date.toISOString().slice(0, 10);

function featureEnabled(db: SpinwordDb, key: string) {
  return (db.prepare("SELECT enabled FROM feature_flags WHERE key = ?").get(key) as { enabled: number } | undefined)?.enabled === 1;
}

function riskLimit(db: SpinwordDb, key: string, fallback: number) {
  return (db.prepare("SELECT value_minor FROM risk_limits WHERE key = ?").get(key) as { value_minor: number } | undefined)?.value_minor ?? fallback;
}

function accountBalance(db: SpinwordDb, playerId: string, currency: VirtualCurrency): number {
  const row = db.prepare("SELECT balance_minor FROM currency_accounts WHERE player_id = ? AND currency = ?").get(playerId, currency) as { balance_minor: number } | undefined;
  if (!row) throw new DomainError("ACCOUNT_MISSING", "Currency account is unavailable.", 500);
  return row.balance_minor;
}

export function postLedger(db: SpinwordDb, input: {
  playerId: string; currency: VirtualCurrency; amountMinor: number; direction: "DEBIT" | "CREDIT"; category: string;
  idempotencyKey: string; roundId?: string; externalReference?: string; reason?: string;
}) {
  const existing = db.prepare("SELECT id, balance_after_minor FROM ledger_entries WHERE idempotency_key = ?").get(input.idempotencyKey) as { id: string; balance_after_minor: number } | undefined;
  if (existing) return existing;
  const before = accountBalance(db, input.playerId, input.currency);
  const after = input.direction === "CREDIT" ? before + input.amountMinor : before - input.amountMinor;
  if (after < 0) throw new DomainError("INSUFFICIENT_BALANCE", "The selected currency balance is too low.", 409);
  const timestamp = isoNow();
  db.prepare("UPDATE currency_accounts SET balance_minor = ?, updated_at = ? WHERE player_id = ? AND currency = ?")
    .run(after, timestamp, input.playerId, input.currency);
  const id = randomUUID();
  db.prepare(`INSERT INTO ledger_entries(id, player_id, currency, amount_minor, direction, category, round_id, external_reference,
    idempotency_key, balance_before_minor, balance_after_minor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, input.playerId, input.currency, input.amountMinor, input.direction, input.category, input.roundId ?? null,
      input.externalReference ?? null, input.idempotencyKey, before, after, input.reason ?? null, timestamp);
  return { id, balance_after_minor: after };
}

function getPlayer(db: SpinwordDb, playerId: string): PlayerRow {
  const player = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId) as PlayerRow | undefined;
  if (!player) throw new DomainError("PLAYER_NOT_FOUND", "Player account not found.", 404);
  if (player.status !== "ACTIVE") throw new DomainError("ACCOUNT_RESTRICTED", "This account cannot play right now.", 403);
  if (player.cooling_off_until && new Date(player.cooling_off_until) > new Date()) {
    throw new DomainError("COOLING_OFF", `Cooling-off period ends at ${player.cooling_off_until}.`, 403);
  }
  return player;
}

function validateRoundRequest(db: SpinwordDb, player: PlayerRow, mode: GameMode, currency: VirtualCurrency, amountMinor: number) {
  if (!featureEnabled(db, `${mode === "MAX" ? "MAX" : "STANDARD"}_MODE`)) throw new DomainError("MODE_DISABLED", "This mode is not currently available.", 403);
  if (!featureEnabled(db, `${currency === "LOOT_COIN" ? "LOOT" : "SPIN"}_COIN_PLAY`)) throw new DomainError("CURRENCY_DISABLED", "This currency is not currently available.", 403);
  const min = riskLimit(db, "MIN_PLAY", limits.minPlayMinor);
  const globalMax = riskLimit(db, "MAX_PLAY", limits.maxPlayMinor);
  const modeMax = riskLimit(db, mode === "MAX" ? "MAX_MAX_PLAY" : "MAX_STANDARD_PLAY", mode === "MAX" ? limits.maxMaxPlayMinor : limits.maxStandardPlayMinor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < min) throw new DomainError("PLAY_BELOW_MINIMUM", `Minimum play is ${(min / 100).toFixed(2)} virtual credits.`);
  if (amountMinor > globalMax || amountMinor > modeMax) throw new DomainError("PLAY_ABOVE_MAXIMUM", `Maximum configured play is ${(Math.min(globalMax, modeMax) / 100).toFixed(2)} virtual credits.`);
  const maxReturn = calculateReturnMinor(amountMinor, PAYTABLES[mode].multipliers[0]);
  if (maxReturn > riskLimit(db, "MAX_RETURN_PER_ROUND", limits.maxReturnMinor)) throw new DomainError("RETURN_LIMIT", "This play would exceed the per-round return limit.", 409);
  const openExposure = (db.prepare(`SELECT COALESCE(SUM(play_amount_minor * CASE WHEN mode = 'MAX' THEN 100 ELSE 7 END), 0) AS exposure FROM game_rounds WHERE status = 'ACTIVE'`).get() as { exposure: number }).exposure;
  if (openExposure + maxReturn > riskLimit(db, "MAX_OPEN_EXPOSURE", limits.maxOpenExposureMinor)) throw new DomainError("EXPOSURE_LIMIT", "A new round cannot open because the configured exposure limit would be exceeded.", 409);
  const todayPlayed = (db.prepare("SELECT COALESCE(SUM(play_amount_minor),0) AS total FROM game_rounds WHERE player_id = ? AND created_at >= ?").get(player.id, `${utcDate()}T00:00:00.000Z`) as { total: number }).total;
  if (player.daily_play_limit_minor != null && todayPlayed + amountMinor > player.daily_play_limit_minor) throw new DomainError("DAILY_PLAY_LIMIT", "Your daily play-volume limit would be exceeded.", 403);
  if (accountBalance(db, player.id, currency) < amountMinor) throw new DomainError("INSUFFICIENT_BALANCE", "The selected currency balance is too low.", 409);
}

export function createRound(db: SpinwordDb, playerId: string, input: { mode: GameMode; currency: VirtualCurrency; amountMinor: number; clientSeed?: string }): PublicRound {
  return db.transaction(() => {
    const player = getPlayer(db, playerId);
    const active = db.prepare("SELECT id FROM game_rounds WHERE player_id = ? AND status = 'ACTIVE'").get(playerId) as { id: string } | undefined;
    if (active) throw new DomainError("ACTIVE_ROUND_EXISTS", "Finish or resume the active round before changing settings.", 409);
    validateRoundRequest(db, player, input.mode, input.currency, input.amountMinor);
    const words = db.prepare("SELECT position, word FROM word_pool_entries WHERE pool_version_id = ? AND status = 'APPROVED' ORDER BY position").all(ACTIVE_POOL_VERSION) as Array<{ position: number; word: string }>;
    if (words.length === 0) throw new DomainError("WORD_POOL_EMPTY", "No active word pool is available.", 503);
    const nonce = player.next_nonce;
    const clientSeed = input.clientSeed?.trim().slice(0, 128) || randomBytes(16).toString("hex");
    const serverSeed = generateServerSeed();
    const selectedArrayIndex = selectWordIndex(serverSeed, clientSeed, nonce, ACTIVE_POOL_VERSION, words.length);
    const selected = words[selectedArrayIndex];
    const id = randomUUID();
    const publicRef = id.replaceAll("-", "").slice(0, 12).toUpperCase();
    const timestamp = isoNow();
    const paytable = PAYTABLES[input.mode];
    postLedger(db, { playerId, currency: input.currency, amountMinor: input.amountMinor, direction: "DEBIT", category: "GAME_PLAY", idempotencyKey: `round:${id}:play`, roundId: id });
    db.prepare(`INSERT INTO game_rounds(id, public_ref, player_id, mode, currency, play_amount_minor, status, paytable_version,
      paytable_snapshot_json, word_pool_version, answer_position, answer_word, server_seed_hash, encrypted_server_seed,
      client_seed, nonce, created_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, publicRef, playerId, input.mode, input.currency, input.amountMinor, paytable.id, JSON.stringify(paytable.multipliers),
        ACTIVE_POOL_VERSION, selected.position, selected.word, seedCommitment(serverSeed), encryptSeed(serverSeed), clientSeed, nonce, timestamp);
    db.prepare("UPDATE players SET next_nonce = next_nonce + 1, preferred_mode = ?, preferred_currency = ?, preferred_amount_minor = ?, updated_at = ? WHERE id = ?")
      .run(input.mode, input.currency, input.amountMinor, timestamp, playerId);
    return getRound(db, playerId, id);
  })();
}

function mapRound(db: SpinwordDb, row: RoundRow): PublicRound {
  const guesses = db.prepare("SELECT guess_number, guess_word, result_json, submitted_at FROM game_guesses WHERE round_id = ? ORDER BY guess_number").all(row.id) as Array<{ guess_number: number; guess_word: string; result_json: string; submitted_at: string }>;
  const settled = row.status === "SETTLED" || row.status === "VOIDED";
  return {
    id: row.id, publicRef: row.public_ref, mode: row.mode, currency: row.currency, playAmountMinor: row.play_amount_minor,
    status: row.status, outcome: row.outcome, paytableVersion: row.paytable_version, paytable: JSON.parse(row.paytable_snapshot_json) as Paytable,
    wordPoolVersion: row.word_pool_version, serverSeedHash: row.server_seed_hash, revealedServerSeed: settled ? row.revealed_server_seed : null,
    clientSeed: row.client_seed, nonce: row.nonce, guessesUsed: row.guesses_used, multiplierBasisPoints: row.multiplier_basis_points,
    payoutAmountMinor: row.payout_amount_minor, answer: settled ? row.answer_word : null, verificationStatus: row.verification_status,
    createdAt: row.created_at, settledAt: row.settled_at,
    guesses: guesses.map((guess): PublicGuess => ({ guessNumber: guess.guess_number, word: guess.guess_word, result: JSON.parse(guess.result_json), submittedAt: guess.submitted_at })),
  };
}

export function getRound(db: SpinwordDb, playerId: string, roundId: string): PublicRound {
  const row = db.prepare("SELECT * FROM game_rounds WHERE id = ? AND player_id = ?").get(roundId, playerId) as RoundRow | undefined;
  if (!row) throw new DomainError("ROUND_NOT_FOUND", "Round not found.", 404);
  return mapRound(db, row);
}

export function getActiveRound(db: SpinwordDb, playerId: string): PublicRound | null {
  const row = db.prepare("SELECT * FROM game_rounds WHERE player_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1").get(playerId) as RoundRow | undefined;
  return row ? mapRound(db, row) : null;
}

function updateProgressAndStats(db: SpinwordDb, row: RoundRow, won: boolean, guessNumber: number, multiplier: number, payout: number) {
  const timestamp = isoNow();
  const date = utcDate(new Date(timestamp));
  db.prepare(`INSERT INTO player_statistics(player_id, total_rounds, successful_rounds, total_guesses, best_multiplier_basis_points,
    current_streak, longest_streak, xp, level, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, 10, 1, ?)
    ON CONFLICT(player_id) DO UPDATE SET total_rounds=total_rounds+1, successful_rounds=successful_rounds+excluded.successful_rounds,
    total_guesses=total_guesses+excluded.total_guesses, best_multiplier_basis_points=MAX(best_multiplier_basis_points, excluded.best_multiplier_basis_points),
    current_streak=CASE WHEN ?=1 THEN current_streak+1 ELSE 0 END,
    longest_streak=MAX(longest_streak, CASE WHEN ?=1 THEN current_streak+1 ELSE 0 END), xp=xp+10,
    level=1+CAST((xp+10)/500 AS INTEGER), updated_at=excluded.updated_at`)
    .run(row.player_id, won ? 1 : 0, guessNumber, multiplier, won ? 1 : 0, won ? 1 : 0, timestamp, won ? 1 : 0, won ? 1 : 0);
  db.prepare(`INSERT INTO player_mode_statistics(player_id, mode, currency, rounds, wins, guesses, played_minor, returned_minor,
    best_multiplier_basis_points, wins_100x, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id,mode,currency) DO UPDATE SET rounds=rounds+1,wins=wins+excluded.wins,guesses=guesses+excluded.guesses,
    played_minor=played_minor+excluded.played_minor,returned_minor=returned_minor+excluded.returned_minor,
    best_multiplier_basis_points=MAX(best_multiplier_basis_points,excluded.best_multiplier_basis_points),wins_100x=wins_100x+excluded.wins_100x,updated_at=excluded.updated_at`)
    .run(row.player_id, row.mode, row.currency, won ? 1 : 0, guessNumber, row.play_amount_minor, payout, multiplier, multiplier === 1000000 ? 1 : 0, timestamp);
  const current = db.prepare("SELECT qualifying_rounds FROM daily_progress WHERE player_id = ? AND progress_date = ?").get(row.player_id, date) as { qualifying_rounds: number } | undefined;
  const ordinal = (current?.qualifying_rounds ?? 0) + 1;
  db.prepare(`INSERT INTO daily_progress(player_id, progress_date, qualifying_rounds, daily_ten_score, completed, updated_at)
    VALUES (?, ?, 1, ?, 0, ?) ON CONFLICT(player_id, progress_date) DO UPDATE SET qualifying_rounds=qualifying_rounds+1,
    daily_ten_score=daily_ten_score+CASE WHEN qualifying_rounds < 10 THEN excluded.daily_ten_score ELSE 0 END,
    completed=CASE WHEN qualifying_rounds+1 >= 10 THEN 1 ELSE completed END,updated_at=excluded.updated_at`)
    .run(row.player_id, date, won ? guessNumber : 7, timestamp);
  if (ordinal <= 10) db.prepare("INSERT OR IGNORE INTO daily_progress_rounds(player_id, progress_date, round_id, ordinal, guesses_score) VALUES (?, ?, ?, ?, ?)").run(row.player_id, date, row.id, ordinal, won ? guessNumber : 7);
}

function settleRound(db: SpinwordDb, row: RoundRow, won: boolean, guessNumber: number): RoundRow {
  if (row.status === "SETTLED") return row;
  const paytable = JSON.parse(row.paytable_snapshot_json) as Paytable;
  const multiplier = won ? paytable[guessNumber - 1] : 0;
  const payout = calculateReturnMinor(row.play_amount_minor, multiplier);
  const timestamp = isoNow();
  const serverSeed = decryptSeed(row.encrypted_server_seed);
  db.prepare(`UPDATE game_rounds SET status='SETTLED', outcome=?, guesses_used=?, multiplier_basis_points=?, payout_amount_minor=?,
    revealed_server_seed=?, verification_status='VERIFIABLE', settled_at=? WHERE id=? AND status='ACTIVE'`)
    .run(won ? "WON" : "LOST", guessNumber, multiplier, payout, serverSeed, timestamp, row.id);
  if (payout > 0) postLedger(db, { playerId: row.player_id, currency: row.currency, amountMinor: payout, direction: "CREDIT", category: "GAME_RETURN", idempotencyKey: `round:${row.id}:return`, roundId: row.id });
  updateProgressAndStats(db, row, won, guessNumber, multiplier, payout);
  const player = getPlayer(db, row.player_id);
  if (won && player.public_wins_opt_in && featureEnabled(db, "PUBLIC_RECENT_WINS")) {
    const moderation = payout >= riskLimit(db, "HIGH_VALUE_REVIEW", limits.highValueReviewMinor) ? "REVIEW" : "PUBLISHED";
    db.prepare(`INSERT OR IGNORE INTO public_win_feed(id, round_id, player_id, masked_identity, mode, currency, play_amount_minor,
      multiplier_basis_points, payout_amount_minor, moderation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), row.id, row.player_id, maskIdentity(player.display_name, row.player_id), row.mode, row.currency,
        row.play_amount_minor, multiplier, payout, moderation, timestamp);
  }
  return db.prepare("SELECT * FROM game_rounds WHERE id = ?").get(row.id) as RoundRow;
}

export function submitGuess(db: SpinwordDb, playerId: string, roundId: string, rawGuess: string): PublicRound {
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM game_rounds WHERE id = ? AND player_id = ?").get(roundId, playerId) as RoundRow | undefined;
    if (!row) throw new DomainError("ROUND_NOT_FOUND", "Round not found.", 404);
    if (row.status !== "ACTIVE") return mapRound(db, row);
    const guess = rawGuess.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(guess)) throw new DomainError("INVALID_GUESS", "Enter a five-letter word.");
    const guessNumber = row.guesses_used + 1;
    if (guessNumber > 6) throw new DomainError("ROUND_COMPLETE", "This round has no remaining guesses.", 409);
    const result = scoreGuess(guess, row.answer_word);
    db.prepare("INSERT INTO game_guesses(id, round_id, guess_number, guess_word, result_json, submitted_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), row.id, guessNumber, guess, JSON.stringify(result), isoNow());
    db.prepare("UPDATE game_rounds SET guesses_used = ? WHERE id = ?").run(guessNumber, row.id);
    const won = result.every((state) => state === "correct");
    const updated = won || guessNumber === 6 ? settleRound(db, { ...row, guesses_used: guessNumber }, won, guessNumber) : db.prepare("SELECT * FROM game_rounds WHERE id = ?").get(row.id) as RoundRow;
    return mapRound(db, updated);
  })();
}

export function settleExistingRound(db: SpinwordDb, playerId: string, roundId: string): PublicRound {
  const row = db.prepare("SELECT * FROM game_rounds WHERE id = ? AND player_id = ?").get(roundId, playerId) as RoundRow | undefined;
  if (!row) throw new DomainError("ROUND_NOT_FOUND", "Round not found.", 404);
  if (row.status === "ACTIVE") throw new DomainError("ROUND_ACTIVE", "The round settles automatically after a win or the sixth valid guess.", 409);
  return mapRound(db, row);
}

export function claimDailyLoot(db: SpinwordDb, playerId: string, idempotencyKey: string) {
  return db.transaction(() => {
    getPlayer(db, playerId);
    if (!featureEnabled(db, "DAILY_LOOT_CLAIM")) throw new DomainError("CLAIM_DISABLED", "Daily Loot Coin claims are unavailable.", 403);
    const date = utcDate();
    const existing = db.prepare("SELECT amount_minor, created_at FROM daily_loot_claims WHERE player_id = ? AND claim_date = ?").get(playerId, date) as { amount_minor: number; created_at: string } | undefined;
    if (existing) return { claimed: false, amountMinor: existing.amount_minor, balanceMinor: accountBalance(db, playerId, "LOOT_COIN"), nextClaimAt: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z` };
    const timestamp = isoNow();
    const claimId = randomUUID();
    db.prepare("INSERT INTO daily_loot_claims(id, player_id, claim_date, amount_minor, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(claimId, playerId, date, limits.dailyLootRewardMinor, idempotencyKey, timestamp);
    const ledger = postLedger(db, { playerId, currency: "LOOT_COIN", amountMinor: limits.dailyLootRewardMinor, direction: "CREDIT", category: "DAILY_LOOT_CLAIM", idempotencyKey: `daily-loot:${playerId}:${date}`, externalReference: claimId });
    return { claimed: true, amountMinor: limits.dailyLootRewardMinor, balanceMinor: ledger.balance_after_minor, nextClaimAt: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z` };
  })();
}

export function getSessionSummary(db: SpinwordDb, playerId: string) {
  const player = getPlayer(db, playerId);
  const balances = db.prepare("SELECT currency, balance_minor FROM currency_accounts WHERE player_id = ?").all(playerId) as Array<{ currency: VirtualCurrency; balance_minor: number }>;
  const claim = db.prepare("SELECT created_at FROM daily_loot_claims WHERE player_id = ? AND claim_date = ?").get(playerId, utcDate()) as { created_at: string } | undefined;
  return {
    player: { id: player.id, displayName: player.display_name, publicWinsOptIn: Boolean(player.public_wins_opt_in), preferredMode: player.preferred_mode, preferredCurrency: player.preferred_currency, preferredAmountMinor: player.preferred_amount_minor },
    balances: Object.fromEntries(balances.map((balance) => [balance.currency, balance.balance_minor])),
    dailyClaim: { available: !claim, nextClaimAt: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z`, amountMinor: limits.dailyLootRewardMinor },
    activeRound: getActiveRound(db, playerId),
    limits: { minPlayMinor: riskLimit(db, "MIN_PLAY", limits.minPlayMinor), maxPlayMinor: riskLimit(db, "MAX_PLAY", limits.maxPlayMinor), highValueReviewMinor: riskLimit(db, "HIGH_VALUE_REVIEW", limits.highValueReviewMinor) },
    paytables: PAYTABLES,
    sandbox: true,
  };
}

export function listRecentRounds(db: SpinwordDb, playerId: string, query: { mode?: string; currency?: string; outcome?: string; limit?: number; offset?: number }) {
  const clauses = ["player_id = ?"];
  const params: Array<string | number> = [playerId];
  if (query.mode === "STANDARD" || query.mode === "MAX") { clauses.push("mode = ?"); params.push(query.mode); }
  if (query.currency === "LOOT_COIN" || query.currency === "SPIN_COIN") { clauses.push("currency = ?"); params.push(query.currency); }
  if (query.outcome === "WON" || query.outcome === "LOST") { clauses.push("outcome = ?"); params.push(query.outcome); }
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const rows = db.prepare(`SELECT * FROM game_rounds WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as RoundRow[];
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM game_rounds WHERE ${clauses.join(" AND ")}`).get(...params) as { count: number }).count;
  return { rounds: rows.map((row) => mapRound(db, row)), total, limit, offset };
}

export function getDailyProgress(db: SpinwordDb, playerId: string) {
  const progress = db.prepare("SELECT * FROM daily_progress WHERE player_id = ? AND progress_date = ?").get(playerId, utcDate()) as { qualifying_rounds: number; daily_ten_score: number; completed: number } | undefined;
  const rounds = progress?.qualifying_rounds ?? 0;
  return { date: utcDate(), rounds, scoredRounds: Math.min(rounds, 10), score: progress?.daily_ten_score ?? 0, completed: Boolean(progress?.completed), canContinue: true, milestones: [1, 3, 5, 7, 10].map((target) => ({ target, complete: rounds >= target })) };
}

export function getPlayerStatistics(db: SpinwordDb, playerId: string) {
  const overall = db.prepare("SELECT * FROM player_statistics WHERE player_id = ?").get(playerId) as Record<string, number> | undefined;
  const modes = db.prepare("SELECT * FROM player_mode_statistics WHERE player_id = ? ORDER BY mode, currency").all(playerId);
  const ledger = db.prepare(`SELECT currency,
    SUM(CASE WHEN category='GAME_PLAY' AND direction='DEBIT' THEN amount_minor ELSE 0 END) played_minor,
    SUM(CASE WHEN category='GAME_RETURN' AND direction='CREDIT' THEN amount_minor ELSE 0 END) returned_minor
    FROM ledger_entries WHERE player_id=? GROUP BY currency`).all(playerId);
  return { overall: overall ?? {}, modes, ledger };
}

export function getLeaderboard(db: SpinwordDb, filters: { mode?: string; currency?: string; period?: string }) {
  const clauses = ["r.status='SETTLED'", "r.outcome='WON'"];
  const params: string[] = [];
  if (filters.mode === "STANDARD" || filters.mode === "MAX") { clauses.push("r.mode=?"); params.push(filters.mode); }
  if (filters.currency === "LOOT_COIN" || filters.currency === "SPIN_COIN") { clauses.push("r.currency=?"); params.push(filters.currency); }
  const period = filters.period ?? "DAILY";
  const since = period === "DAILY" ? `${utcDate()}T00:00:00.000Z` : period === "WEEKLY" ? new Date(Date.now() - 7 * 86400000).toISOString() : period === "MONTHLY" ? new Date(Date.now() - 30 * 86400000).toISOString() : null;
  if (since) { clauses.push("r.settled_at>=?"); params.push(since); }
  const rows = db.prepare(`SELECT p.id player_id,p.display_name,r.mode,r.currency,COUNT(*) wins,MIN(r.guesses_used) best_guesses,
    MAX(r.multiplier_basis_points) best_multiplier_basis_points,SUM(r.payout_amount_minor) total_returned_minor,MIN(r.settled_at) tie_breaker
    FROM game_rounds r JOIN players p ON p.id=r.player_id WHERE ${clauses.join(" AND ")}
    GROUP BY p.id,r.mode,r.currency ORDER BY best_multiplier_basis_points DESC,best_guesses ASC,wins DESC,tie_breaker ASC,p.id ASC LIMIT 100`).all(...params) as Array<Record<string, string | number>>;
  return { period, entries: rows.map((row, index) => ({ rank: index + 1, ...row, identity: maskIdentity(String(row.display_name), String(row.player_id)), display_name: undefined })) };
}

export function getPublicWins(db: SpinwordDb, limit = 20) {
  return db.prepare(`SELECT masked_identity identity,mode,currency,play_amount_minor,multiplier_basis_points,payout_amount_minor,created_at
    FROM public_win_feed WHERE moderation_status='PUBLISHED' ORDER BY created_at DESC LIMIT ?`).all(Math.min(Math.max(limit, 1), 50));
}

export function getFairness(db: SpinwordDb, playerId: string, roundId: string) {
  const round = getRound(db, playerId, roundId);
  if (round.status === "ACTIVE") return { ...round, verification: null };
  const words = db.prepare("SELECT position, word FROM word_pool_entries WHERE pool_version_id = ? AND status='APPROVED' ORDER BY position").all(round.wordPoolVersion) as Array<{ position: number; word: string }>;
  const selectedArrayIndex = selectWordIndex(round.revealedServerSeed!, round.clientSeed, round.nonce, round.wordPoolVersion, words.length);
  return { ...round, verification: { algorithm: "HMAC-SHA256 with rejection sampling", selectedArrayIndex, selectedPosition: words[selectedArrayIndex]?.position, recomputedAnswer: words[selectedArrayIndex]?.word, commitmentMatches: seedCommitment(round.revealedServerSeed!) === round.serverSeedHash, answerMatches: words[selectedArrayIndex]?.word === round.answer, poolSize: words.length, poolStatus: "DEVELOPMENT" } };
}

export function maskIdentity(displayName: string, playerId: string) {
  const clean = displayName.trim();
  if (clean.length >= 4) return `${clean.slice(0, 2)}••${clean.slice(-1)}`;
  return `Player…${playerId.slice(-4)}`;
}

export function getOperatorOverview(db = getDb()) {
  const gameplay = db.prepare(`SELECT currency,mode,COUNT(*) rounds,SUM(play_amount_minor) played_minor,SUM(COALESCE(payout_amount_minor,0)) returned_minor,
    SUM(CASE WHEN status='ACTIVE' THEN play_amount_minor*CASE WHEN mode='MAX' THEN 100 ELSE 7 END ELSE 0 END) open_exposure_minor,
    SUM(CASE WHEN multiplier_basis_points=1000000 THEN 1 ELSE 0 END) hits_100x FROM game_rounds GROUP BY currency,mode`).all();
  const balances = db.prepare("SELECT currency,SUM(balance_minor) liability_minor FROM currency_accounts GROUP BY currency").all();
  const payments = db.prepare("SELECT status,COUNT(*) count,SUM(expected_usd_minor) expected_usd_minor FROM payment_quotes GROUP BY status").all();
  return { generatedAt: isoNow(), gameplay, balances, payments, note: "Virtual-credit activity is not real-money gaming revenue." };
}
