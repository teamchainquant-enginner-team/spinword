PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  public_profile INTEGER NOT NULL DEFAULT 1,
  public_wins_opt_in INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','SELF_EXCLUDED','CLOSED')),
  preferred_currency TEXT NOT NULL DEFAULT 'LOOT_COIN',
  preferred_mode TEXT NOT NULL DEFAULT 'STANDARD',
  preferred_amount_minor INTEGER NOT NULL DEFAULT 100,
  next_nonce INTEGER NOT NULL DEFAULT 1,
  daily_play_limit_minor INTEGER,
  daily_purchase_limit_minor INTEGER,
  cooling_off_until TEXT,
  promotional_opt_out INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS currency_accounts (
  player_id TEXT NOT NULL REFERENCES players(id),
  currency TEXT NOT NULL CHECK (currency IN ('LOOT_COIN','SPIN_COIN')),
  balance_minor INTEGER NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, currency)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  currency TEXT NOT NULL CHECK (currency IN ('LOOT_COIN','SPIN_COIN')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  category TEXT NOT NULL,
  round_id TEXT,
  external_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  balance_before_minor INTEGER NOT NULL,
  balance_after_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','REVERSED')),
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_player_time ON ledger_entries(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_currency_time ON ledger_entries(currency, created_at DESC);

CREATE TABLE IF NOT EXISTS paytable_versions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('STANDARD','MAX')),
  multipliers_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  published_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS word_pool_versions (
  id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'en-US',
  pool_type TEXT NOT NULL DEFAULT 'ROUND' CHECK (pool_type IN ('ROUND','DAILY_CHALLENGE')),
  status TEXT NOT NULL CHECK (status IN ('DEVELOPMENT','PUBLISHED','RETIRED')),
  expected_size INTEGER NOT NULL,
  solver_version TEXT,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS word_pool_entries (
  pool_version_id TEXT NOT NULL REFERENCES word_pool_versions(id),
  position INTEGER NOT NULL,
  word TEXT NOT NULL,
  difficulty_band TEXT NOT NULL,
  has_repeated_letters INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  PRIMARY KEY (pool_version_id, position),
  UNIQUE (pool_version_id, word)
);

CREATE TABLE IF NOT EXISTS accepted_guesses (
  dictionary_version TEXT NOT NULL,
  word TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  PRIMARY KEY (dictionary_version, word)
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  public_ref TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT NOT NULL CHECK (mode IN ('STANDARD','MAX')),
  currency TEXT NOT NULL CHECK (currency IN ('LOOT_COIN','SPIN_COIN')),
  play_amount_minor INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','SETTLED','VOIDED','EXPIRED')),
  outcome TEXT CHECK (outcome IN ('WON','LOST')),
  paytable_version TEXT NOT NULL REFERENCES paytable_versions(id),
  paytable_snapshot_json TEXT NOT NULL,
  word_pool_version TEXT NOT NULL REFERENCES word_pool_versions(id),
  answer_position INTEGER NOT NULL,
  answer_word TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  encrypted_server_seed TEXT NOT NULL,
  revealed_server_seed TEXT,
  client_seed TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  guesses_used INTEGER NOT NULL DEFAULT 0,
  multiplier_basis_points INTEGER,
  payout_amount_minor INTEGER,
  verification_status TEXT NOT NULL DEFAULT 'COMMITTED',
  created_at TEXT NOT NULL,
  settled_at TEXT,
  void_reason TEXT,
  UNIQUE(player_id, nonce)
);
CREATE INDEX IF NOT EXISTS idx_round_player_created ON game_rounds(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_round_status_created ON game_rounds(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_round_mode_created ON game_rounds(mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_round_pool ON game_rounds(word_pool_version, created_at DESC);

CREATE TABLE IF NOT EXISTS game_guesses (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES game_rounds(id),
  guess_number INTEGER NOT NULL,
  guess_word TEXT NOT NULL,
  result_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE(round_id, guess_number)
);

CREATE TABLE IF NOT EXISTS daily_loot_claims (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  claim_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE(player_id, claim_date)
);

CREATE TABLE IF NOT EXISTS daily_progress (
  player_id TEXT NOT NULL REFERENCES players(id),
  progress_date TEXT NOT NULL,
  qualifying_rounds INTEGER NOT NULL DEFAULT 0,
  daily_ten_score INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(player_id, progress_date)
);

CREATE TABLE IF NOT EXISTS daily_progress_rounds (
  player_id TEXT NOT NULL,
  progress_date TEXT NOT NULL,
  round_id TEXT NOT NULL UNIQUE REFERENCES game_rounds(id),
  ordinal INTEGER NOT NULL,
  guesses_score INTEGER NOT NULL,
  PRIMARY KEY(player_id, progress_date, ordinal)
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  challenge_date TEXT PRIMARY KEY,
  word_pool_version TEXT NOT NULL,
  answer_position INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_statistics (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  total_rounds INTEGER NOT NULL DEFAULT 0,
  successful_rounds INTEGER NOT NULL DEFAULT 0,
  total_guesses INTEGER NOT NULL DEFAULT 0,
  best_multiplier_basis_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_mode_statistics (
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT NOT NULL,
  currency TEXT NOT NULL,
  rounds INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  guesses INTEGER NOT NULL DEFAULT 0,
  played_minor INTEGER NOT NULL DEFAULT 0,
  returned_minor INTEGER NOT NULL DEFAULT 0,
  best_multiplier_basis_points INTEGER NOT NULL DEFAULT 0,
  wins_100x INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(player_id, mode, currency)
);

CREATE TABLE IF NOT EXISTS public_win_feed (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL UNIQUE REFERENCES game_rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  masked_identity TEXT NOT NULL,
  mode TEXT NOT NULL,
  currency TEXT NOT NULL,
  play_amount_minor INTEGER NOT NULL,
  multiplier_basis_points INTEGER NOT NULL,
  payout_amount_minor INTEGER NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'PUBLISHED',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_wins_published ON public_win_feed(moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS leaderboard_periods (
  id TEXT PRIMARY KEY,
  period_type TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  rebuilt_at TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  period_id TEXT NOT NULL REFERENCES leaderboard_periods(id),
  category TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT,
  currency TEXT,
  score INTEGER NOT NULL,
  tie_breaker TEXT NOT NULL,
  rank INTEGER,
  review_status TEXT NOT NULL DEFAULT 'ELIGIBLE',
  PRIMARY KEY(period_id, category, player_id, mode, currency)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_entries(period_id, category, mode, currency, rank);

CREATE TABLE IF NOT EXISTS achievements (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, xp INTEGER NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS player_achievements (player_id TEXT NOT NULL REFERENCES players(id), achievement_id TEXT NOT NULL REFERENCES achievements(id), earned_at TEXT NOT NULL, round_id TEXT, PRIMARY KEY(player_id, achievement_id));
CREATE TABLE IF NOT EXISTS missions (id TEXT PRIMARY KEY, name TEXT NOT NULL, rules_json TEXT NOT NULL, rewards_json TEXT NOT NULL, starts_at TEXT, ends_at TEXT, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS player_missions (player_id TEXT NOT NULL REFERENCES players(id), mission_id TEXT NOT NULL REFERENCES missions(id), progress INTEGER NOT NULL DEFAULT 0, completed_at TEXT, PRIMARY KEY(player_id, mission_id));
CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, name TEXT NOT NULL, rules_json TEXT NOT NULL, prize_pool_json TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tournament_entries (tournament_id TEXT NOT NULL REFERENCES tournaments(id), player_id TEXT NOT NULL REFERENCES players(id), score INTEGER NOT NULL DEFAULT 0, review_status TEXT NOT NULL DEFAULT 'ELIGIBLE', entered_at TEXT NOT NULL, PRIMARY KEY(tournament_id, player_id));
CREATE INDEX IF NOT EXISTS idx_tournament_entries ON tournament_entries(tournament_id, score DESC);

CREATE TABLE IF NOT EXISTS promotions (id TEXT PRIMARY KEY, rules_json TEXT NOT NULL, currency TEXT NOT NULL, budget_cap_minor INTEGER NOT NULL, liability_minor INTEGER NOT NULL DEFAULT 0, claim_limit INTEGER NOT NULL, terms_version TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS promotion_claims (id TEXT PRIMARY KEY, promotion_id TEXT NOT NULL REFERENCES promotions(id), player_id TEXT NOT NULL REFERENCES players(id), amount_minor INTEGER NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY, referrer_player_id TEXT NOT NULL REFERENCES players(id), code TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS affiliate_accounts (id TEXT PRIMARY KEY, player_id TEXT REFERENCES players(id), commission_basis_points INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS affiliate_conversions (id TEXT PRIMARY KEY, affiliate_id TEXT NOT NULL REFERENCES affiliate_accounts(id), player_id TEXT NOT NULL REFERENCES players(id), purchase_quote_id TEXT, amount_minor INTEGER NOT NULL, commission_minor INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_affiliate_player ON affiliate_conversions(affiliate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS purchase_packages (
  id TEXT PRIMARY KEY,
  price_usd_minor INTEGER NOT NULL,
  spin_coins_minor INTEGER NOT NULL,
  bonus_minor INTEGER NOT NULL DEFAULT 0,
  supported_assets_json TEXT NOT NULL,
  purchase_limit INTEGER,
  starts_at TEXT,
  ends_at TEXT,
  terms_version TEXT NOT NULL,
  max_promotional_liability_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_quotes (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  package_id TEXT NOT NULL REFERENCES purchase_packages(id),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  expected_crypto_amount TEXT NOT NULL,
  expected_usd_minor INTEGER NOT NULL,
  received_crypto_amount TEXT,
  transaction_hash TEXT UNIQUE,
  confirmation_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  spin_coins_minor INTEGER NOT NULL,
  bonus_minor INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id), type TEXT NOT NULL, channel TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, promotional INTEGER NOT NULL DEFAULT 0, read_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fraud_flags (id TEXT PRIMARY KEY, player_id TEXT REFERENCES players(id), round_id TEXT REFERENCES game_rounds(id), reason TEXT NOT NULL, risk_score INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS risk_limits (key TEXT PRIMARY KEY, value_minor INTEGER NOT NULL, currency TEXT, mode TEXT, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS feature_flags (key TEXT PRIMARY KEY, enabled INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, before_json TEXT, after_json TEXT, reason TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, player_id TEXT, event_type TEXT NOT NULL, currency TEXT, mode TEXT, value_minor INTEGER, properties_json TEXT NOT NULL, created_at TEXT NOT NULL);
