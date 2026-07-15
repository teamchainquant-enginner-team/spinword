import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimDailyLoot, createRound, getDailyProgress, getFairness, getLeaderboard, getPublicWins, getSessionSummary, listRecentRounds, submitGuess } from "../../server/game";
import { createDatabase, createPlayer, type SpinwordDb } from "../../server/db";

describe("server-authoritative gameplay", () => {
  let db: SpinwordDb;
  let playerId: string;
  beforeEach(() => { db = createDatabase(":memory:"); playerId = createPlayer(db, "alpha@example.test", "Alpha Player", { publicWins: true, lootMinor: 200_000_000_00, spinMinor: 20_000_00 }); });
  afterEach(() => db.close());

  it("claims exactly 1,000,000 Loot Coins once per UTC day", () => {
    const first = claimDailyLoot(db, playerId, "claim-key-first");
    const retry = claimDailyLoot(db, playerId, "claim-key-retry");
    expect(first.claimed).toBe(true);
    expect(first.amountMinor).toBe(100_000_000);
    expect(retry.claimed).toBe(false);
    expect(db.prepare("SELECT COUNT(*) count FROM daily_loot_claims").get()).toMatchObject({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) count FROM ledger_entries WHERE category='DAILY_LOOT_CLAIM'").get()).toMatchObject({ count: 1 });
  });

  it("locks mode, currency, amount, versions, nonce, and commitment", () => {
    const round = createRound(db, playerId, { mode: "MAX", currency: "LOOT_COIN", amountMinor: 100, clientSeed: "test-client" });
    expect(round.mode).toBe("MAX"); expect(round.currency).toBe("LOOT_COIN"); expect(round.playAmountMinor).toBe(100);
    expect(round.answer).toBeNull(); expect(round.serverSeedHash).toHaveLength(64); expect(round.nonce).toBe(1);
    expect(() => createRound(db, playerId, { mode: "STANDARD", currency: "SPIN_COIN", amountMinor: 100 })).toThrow(/active round/i);
  });

  it("uses the locked paytables and settles a 100x result exactly once", () => {
    const round = createRound(db, playerId, { mode: "MAX", currency: "SPIN_COIN", amountMinor: 100, clientSeed: "winner" });
    const answer = (db.prepare("SELECT answer_word FROM game_rounds WHERE id=?").get(round.id) as { answer_word: string }).answer_word;
    const settled = submitGuess(db, playerId, round.id, answer);
    const retry = submitGuess(db, playerId, round.id, answer);
    expect(settled.multiplierBasisPoints).toBe(1_000_000);
    expect(settled.payoutAmountMinor).toBe(10_000);
    expect(retry.payoutAmountMinor).toBe(10_000);
    expect(db.prepare("SELECT COUNT(*) count FROM ledger_entries WHERE round_id=? AND category='GAME_RETURN'").get(round.id)).toMatchObject({ count: 1 });
    expect(getPublicWins(db)).toHaveLength(1);
  });

  it("reveals and recomputes the committed answer only after settlement", () => {
    const round = createRound(db, playerId, { mode: "STANDARD", currency: "LOOT_COIN", amountMinor: 100, clientSeed: "verify" });
    expect(getFairness(db, playerId, round.id).verification).toBeNull();
    const answer = (db.prepare("SELECT answer_word FROM game_rounds WHERE id=?").get(round.id) as { answer_word: string }).answer_word;
    submitGuess(db, playerId, round.id, answer);
    const verified = getFairness(db, playerId, round.id);
    expect(verified.verification).toMatchObject({ commitmentMatches: true, answerMatches: true });
  });

  it("keeps player histories isolated and masks public identities", () => {
    const otherId = createPlayer(db, "beta@example.test", "Beta Player", { lootMinor: 100_000 });
    const round = createRound(db, playerId, { mode: "STANDARD", currency: "LOOT_COIN", amountMinor: 100 });
    expect(listRecentRounds(db, playerId, {}).total).toBe(1);
    expect(listRecentRounds(db, otherId, {}).total).toBe(0);
    expect(getPublicWins(db)).toHaveLength(0);
    expect(round.answer).toBeNull();
  });

  it("enforces exact boundaries, balance, and exposure limits server-side", () => {
    expect(() => createRound(db, playerId, { mode: "STANDARD", currency: "LOOT_COIN", amountMinor: 99 })).toThrow(/minimum/i);
    expect(() => createRound(db, playerId, { mode: "STANDARD", currency: "LOOT_COIN", amountMinor: 10_000_001 })).toThrow(/maximum/i);
    db.prepare("UPDATE risk_limits SET value_minor=699 WHERE key='MAX_OPEN_EXPOSURE'").run();
    expect(() => createRound(db, playerId, { mode: "STANDARD", currency: "LOOT_COIN", amountMinor: 100 })).toThrow(/exposure/i);
  });

  it("never inserts unsettled or fabricated public wins", () => {
    createRound(db, playerId, { mode: "MAX", currency: "LOOT_COIN", amountMinor: 100 });
    expect(getPublicWins(db)).toEqual([]);
    expect(getLeaderboard(db, { period: "ALL_TIME" }).entries).toEqual([]);
  });

  it("tracks only the first ten eligible rounds while allowing round eleven", () => {
    for (let index = 0; index < 11; index += 1) {
      const round = createRound(db, playerId, { mode: "STANDARD", currency: "LOOT_COIN", amountMinor: 100, clientSeed: `daily-${index}` });
      const answer = (db.prepare("SELECT answer_word FROM game_rounds WHERE id=?").get(round.id) as { answer_word: string }).answer_word;
      submitGuess(db, playerId, round.id, answer);
    }
    const progress = getDailyProgress(db, playerId);
    expect(progress.rounds).toBe(11); expect(progress.scoredRounds).toBe(10); expect(progress.score).toBe(10); expect(progress.completed).toBe(true); expect(progress.canContinue).toBe(true);
    expect(db.prepare("SELECT COUNT(*) count FROM daily_progress_rounds WHERE player_id=?").get(playerId)).toMatchObject({ count: 10 });
  });

  it("keeps Loot Coin and Spin Coin ledger accounts completely separate", () => {
    const before = getSessionSummary(db, playerId).balances;
    const round = createRound(db, playerId, { mode: "STANDARD", currency: "LOOT_COIN", amountMinor: 100 });
    const after = getSessionSummary(db, playerId).balances;
    expect(after.LOOT_COIN).toBe(before.LOOT_COIN - 100);
    expect(after.SPIN_COIN).toBe(before.SPIN_COIN);
    expect(db.prepare("SELECT currency FROM ledger_entries WHERE round_id=?").get(round.id)).toMatchObject({ currency: "LOOT_COIN" });
  });
});
