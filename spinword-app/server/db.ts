import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACTIVE_POOL_VERSION, DEV_WORDS, DICTIONARY_VERSION, EXTRA_GUESSES, featureFlagDefaults, limits, PAYTABLES } from "./config";

export type SpinwordDb = Database.Database;

function now() {
  return new Date().toISOString();
}

export function createDatabase(filename: string): SpinwordDb {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  applyMigrations(db);
  seedDatabase(db);
  return db;
}

export function applyMigrations(db: SpinwordDb) {
  const migrationDir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const record = db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)");
  for (const file of files) {
    if (applied.get(file)) continue;
    db.transaction(() => {
      db.exec(fs.readFileSync(path.join(migrationDir, file), "utf8"));
      record.run(file, now());
    })();
  }
}

export function seedDatabase(db: SpinwordDb) {
  const timestamp = now();
  const insertPaytable = db.prepare("INSERT OR IGNORE INTO paytable_versions(id, mode, multipliers_json, status, published_at, created_by, created_at) VALUES (?, ?, ?, 'PUBLISHED', ?, 'system', ?)");
  for (const [mode, paytable] of Object.entries(PAYTABLES)) {
    insertPaytable.run(paytable.id, mode, JSON.stringify(paytable.multipliers), timestamp, timestamp);
  }

  db.prepare("INSERT OR IGNORE INTO word_pool_versions(id, language, pool_type, status, expected_size, solver_version, created_at) VALUES (?, 'en-US', 'ROUND', 'DEVELOPMENT', 2048, 'development-seed', ?)")
    .run(ACTIVE_POOL_VERSION, timestamp);
  const wordInsert = db.prepare("INSERT OR IGNORE INTO word_pool_entries(pool_version_id, position, word, difficulty_band, has_repeated_letters) VALUES (?, ?, ?, ?, ?)");
  const guessInsert = db.prepare("INSERT OR IGNORE INTO accepted_guesses(dictionary_version, word) VALUES (?, ?)");
  DEV_WORDS.forEach(([word, band], position) => {
    wordInsert.run(ACTIVE_POOL_VERSION, position, word, band, new Set(word).size < 5 ? 1 : 0);
    guessInsert.run(DICTIONARY_VERSION, word);
  });
  EXTRA_GUESSES.forEach((word) => guessInsert.run(DICTIONARY_VERSION, word));

  const flagInsert = db.prepare("INSERT OR IGNORE INTO feature_flags(key, enabled, updated_at, updated_by) VALUES (?, ?, ?, 'system')");
  Object.entries(featureFlagDefaults).forEach(([key, enabled]) => flagInsert.run(key, enabled ? 1 : 0, timestamp));

  const riskInsert = db.prepare("INSERT OR IGNORE INTO risk_limits(key, value_minor, currency, mode, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, 'system')");
  riskInsert.run("MIN_PLAY", limits.minPlayMinor, null, null, timestamp);
  riskInsert.run("MAX_PLAY", limits.maxPlayMinor, null, null, timestamp);
  riskInsert.run("MAX_STANDARD_PLAY", limits.maxStandardPlayMinor, null, "STANDARD", timestamp);
  riskInsert.run("MAX_MAX_PLAY", limits.maxMaxPlayMinor, null, "MAX", timestamp);
  riskInsert.run("MAX_RETURN_PER_ROUND", limits.maxReturnMinor, null, null, timestamp);
  riskInsert.run("MAX_OPEN_EXPOSURE", limits.maxOpenExposureMinor, null, null, timestamp);
  riskInsert.run("HIGH_VALUE_REVIEW", limits.highValueReviewMinor, null, null, timestamp);

  const packageInsert = db.prepare("INSERT OR IGNORE INTO purchase_packages(id, price_usd_minor, spin_coins_minor, bonus_minor, supported_assets_json, terms_version, max_promotional_liability_minor, status) VALUES (?, ?, ?, 0, ?, 'SANDBOX_V1', 0, 'ACTIVE')");
  for (const price of [10, 25, 50, 100, 250, 500, 1000, 5000, 10000]) {
    packageInsert.run(`SC_${price}`, price * 100, price * 100, JSON.stringify(["BTC", "ETH", "SOL", "USDC"]));
  }

  const achievements = [
    ["FIRST_ROUND", "First Round", "Complete your first settled round", 25],
    ["FIRST_WIN", "First Win", "Solve your first SpinWord", 50],
    ["DAILY_TEN", "Daily Ten", "Complete ten qualifying rounds in one UTC day", 200],
    ["FIRST_MAX_WIN", "First Max Mode Win", "Solve a Max Mode round", 100],
    ["FIRST_100X", "First 100x Win", "Solve Max Mode on the first guess", 1000],
  ];
  const achievementInsert = db.prepare("INSERT OR IGNORE INTO achievements(id, name, description, xp, status) VALUES (?, ?, ?, ?, 'ACTIVE')");
  achievements.forEach((achievement) => achievementInsert.run(...achievement));
}

const globalForDb = globalThis as unknown as { spinwordDb?: SpinwordDb };

export function defaultDatabasePath() {
  // Vercel's deployed application bundle is read-only. Its temporary directory
  // is writable and is suitable for this self-contained sandbox/demo build.
  // Production deployments must override this with durable storage.
  if (process.env.VERCEL) return path.join(os.tmpdir(), "spinword", "spinword.db");
  return path.join(process.cwd(), "data", "spinword.db");
}

export function getDb(): SpinwordDb {
  if (!globalForDb.spinwordDb) {
    globalForDb.spinwordDb = createDatabase(process.env.SPINWORD_DB_PATH || defaultDatabasePath());
  }
  return globalForDb.spinwordDb;
}

export function createPlayer(db: SpinwordDb, email: string, displayName: string, options?: { publicWins?: boolean; lootMinor?: number; spinMinor?: number }) {
  const id = randomUUID();
  const timestamp = now();
  db.transaction(() => {
    db.prepare("INSERT INTO players(id, email, display_name, public_wins_opt_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, email.toLowerCase(), displayName, options?.publicWins ? 1 : 0, timestamp, timestamp);
    db.prepare("INSERT INTO currency_accounts(player_id, currency, balance_minor, updated_at) VALUES (?, ?, ?, ?)").run(id, "LOOT_COIN", options?.lootMinor ?? 0, timestamp);
    db.prepare("INSERT INTO currency_accounts(player_id, currency, balance_minor, updated_at) VALUES (?, ?, ?, ?)").run(id, "SPIN_COIN", options?.spinMinor ?? 0, timestamp);
    db.prepare("INSERT INTO player_statistics(player_id, updated_at) VALUES (?, ?)").run(id, timestamp);
  })();
  return id;
}

export function getOrCreateSandboxPlayer(db = getDb()): string {
  const email = process.env.SPINWORD_SANDBOX_PLAYER_EMAIL || "player@spinword.local";
  const row = db.prepare("SELECT id FROM players WHERE email = ?").get(email.toLowerCase()) as { id: string } | undefined;
  if (row) return row.id;
  const id = "sandbox-local-player";
  const timestamp = now();
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO players(id, email, display_name, public_wins_opt_in, created_at, updated_at) VALUES (?, ?, 'Sandbox Player', 1, ?, ?)")
      .run(id, email.toLowerCase(), timestamp, timestamp);
    db.prepare("INSERT OR IGNORE INTO currency_accounts(player_id, currency, balance_minor, updated_at) VALUES (?, 'LOOT_COIN', 0, ?)").run(id, timestamp);
    db.prepare("INSERT OR IGNORE INTO currency_accounts(player_id, currency, balance_minor, updated_at) VALUES (?, 'SPIN_COIN', 0, ?)").run(id, timestamp);
    db.prepare("INSERT OR IGNORE INTO player_statistics(player_id, updated_at) VALUES (?, ?)").run(id, timestamp);
  })();
  return id;
}
