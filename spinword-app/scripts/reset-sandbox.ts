import { getDb } from "../server/db";

if (!process.argv.includes("--confirm")) throw new Error("Refusing to reset without --confirm");
if (process.env.NODE_ENV === "production") throw new Error("Sandbox reset is disabled in production");
const db = getDb();
db.transaction(() => {
  for (const table of [
    "public_win_feed", "daily_progress_rounds", "daily_progress", "daily_loot_claims", "game_guesses", "ledger_entries",
    "player_achievements", "player_missions", "promotion_claims", "tournament_entries", "affiliate_conversions",
    "affiliate_accounts", "notifications", "fraud_flags", "analytics_events", "referrals", "leaderboard_entries",
    "payment_quotes", "player_mode_statistics", "player_statistics", "game_rounds", "currency_accounts", "players",
  ]) db.exec(`DELETE FROM ${table}`);
})();
db.pragma("wal_checkpoint(TRUNCATE)");
console.log("Sandbox player, round, payment, and ledger state reset. Versioned configuration was preserved.");
db.close();
