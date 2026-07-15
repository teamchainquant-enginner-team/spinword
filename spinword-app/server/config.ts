import type { GameMode, Paytable, VirtualCurrency } from "./types";

export const PAYTABLES: Record<GameMode, { id: string; multipliers: Paytable }> = {
  STANDARD: { id: "STANDARD_V1", multipliers: [70000, 50000, 30000, 17000, 7000, 3000] },
  MAX: { id: "MAX_V1", multipliers: [1000000, 50000, 30000, 15000, 7000, 3300] },
};

export const CURRENCIES: VirtualCurrency[] = ["LOOT_COIN", "SPIN_COIN"];
export const MODES: GameMode[] = ["STANDARD", "MAX"];
export const ACTIVE_POOL_VERSION = "SPINWORD_EN_US_DEV_001";
export const DICTIONARY_VERSION = "SPINWORD_GUESSES_DEV_001";

export const PLAY_PRESETS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 25000, 50000, 100000];

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const limits = {
  minPlayMinor: Math.round(envNumber("MIN_PLAY_USD", 1) * 100),
  maxPlayMinor: Math.round(envNumber("MAX_PLAY_USD", 100000) * 100),
  maxStandardPlayMinor: Math.round(envNumber("MAX_STANDARD_PLAY_USD", 100000) * 100),
  maxMaxPlayMinor: Math.round(envNumber("MAX_MAX_MODE_PLAY_USD", 100000) * 100),
  maxReturnMinor: Math.round(envNumber("MAX_RETURN_PER_ROUND_USD", 10000000) * 100),
  maxOpenExposureMinor: Math.round(envNumber("MAX_OPEN_EXPOSURE_USD", 10000000) * 100),
  highValueReviewMinor: Math.round(envNumber("HIGH_VALUE_REVIEW_USD", 10000) * 100),
  dailyLootRewardMinor: Math.round(envNumber("DAILY_LOOT_COIN_REWARD", 1000000) * 100),
  paymentQuoteTtlSeconds: envNumber("PAYMENT_QUOTE_TTL_SECONDS", 900),
};

export const featureFlagDefaults: Record<string, boolean> = {
  DAILY_LOOT_CLAIM: true,
  LOOT_COIN_PLAY: true,
  SPIN_COIN_PLAY: true,
  CRYPTO_PURCHASES: process.env.CRYPTO_PURCHASES_ENABLED === "true",
  BTC_PURCHASES: false,
  ETH_PURCHASES: false,
  SOL_PURCHASES: false,
  USDC_PURCHASES: false,
  USDT_PURCHASES: false,
  LARGE_PLAYS: true,
  HIGH_VALUE_PLAYS: true,
  STANDARD_MODE: true,
  MAX_MODE: true,
  PUBLIC_RECENT_WINS: true,
  PURCHASE_BONUSES: false,
};

export const DEV_WORDS = [
  ["CRANE", "easy"], ["SLATE", "easy"], ["STONE", "easy"], ["HEART", "easy"],
  ["LIGHT", "easy"], ["PLANT", "easy"], ["WORLD", "easy"], ["DREAM", "easy"],
  ["FLAME", "medium"], ["SPARK", "medium"], ["GHOST", "medium"], ["MOONS", "medium"],
  ["BLOCK", "medium"], ["VAULT", "medium"], ["CHAIN", "medium"], ["TOKEN", "medium"],
  ["MINTS", "medium"], ["YIELD", "medium"], ["WHALE", "medium"], ["ALPHA", "medium"],
  ["CHIPS", "medium"], ["SPINS", "medium"], ["LUCKY", "medium"], ["HOUSE", "medium"],
  ["ROYAL", "hard"], ["CROWN", "hard"], ["JOKER", "hard"], ["DEALT", "hard"],
  ["RAISE", "hard"], ["BLUFF", "hard"], ["REELS", "hard"], ["PRIZE", "very_hard"],
] as const;

export const EXTRA_GUESSES = ["AUDIO", "ROUND", "MONEY", "POWER", "TRUST", "BRAVE", "SHINE", "GRAND", "STAKE", "BONUS"];
