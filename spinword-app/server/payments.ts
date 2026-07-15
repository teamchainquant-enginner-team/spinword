import { randomUUID } from "node:crypto";
import type { SpinwordDb } from "./db";
import { limits } from "./config";
import { DomainError } from "./types";
import { postLedger } from "./game";

export function listPackages(db: SpinwordDb) {
  return db.prepare("SELECT id,price_usd_minor,spin_coins_minor,bonus_minor,supported_assets_json,terms_version FROM purchase_packages WHERE status='ACTIVE' ORDER BY price_usd_minor").all()
    .map((row) => ({ ...(row as Record<string, unknown>), supported_assets: JSON.parse(String((row as Record<string, unknown>).supported_assets_json)), supported_assets_json: undefined }));
}

export function createPaymentQuote(db: SpinwordDb, playerId: string, input: { packageId: string; asset: string; idempotencyKey: string }) {
  const enabled = (db.prepare("SELECT enabled FROM feature_flags WHERE key='CRYPTO_PURCHASES'").get() as { enabled: number } | undefined)?.enabled === 1;
  if (!enabled || process.env.SANDBOX_PAYMENTS_ENABLED !== "true") throw new DomainError("PURCHASES_DISABLED", "Crypto purchases are disabled until an approved sandbox provider is configured.", 403);
  const packageRow = db.prepare("SELECT * FROM purchase_packages WHERE id=? AND status='ACTIVE'").get(input.packageId) as { id: string; price_usd_minor: number; spin_coins_minor: number; bonus_minor: number; supported_assets_json: string } | undefined;
  if (!packageRow) throw new DomainError("PACKAGE_NOT_FOUND", "Purchase package not found.", 404);
  if (packageRow.price_usd_minor < 1000) throw new DomainError("PURCHASE_BELOW_MINIMUM", "Minimum purchase is $10 USD equivalent.");
  const supported = JSON.parse(packageRow.supported_assets_json) as string[];
  const asset = input.asset.toUpperCase();
  if (!supported.includes(asset)) throw new DomainError("ASSET_DISABLED", "That cryptocurrency is not enabled for this package.");
  const existing = db.prepare("SELECT * FROM payment_quotes WHERE idempotency_key=?").get(input.idempotencyKey);
  if (existing) return existing;
  const id = randomUUID();
  const created = new Date();
  const expires = new Date(created.getTime() + limits.paymentQuoteTtlSeconds * 1000);
  const network = asset === "BTC" ? "bitcoin" : asset === "SOL" ? "solana" : "ethereum";
  const expectedCrypto = "PROVIDER_QUOTE_REQUIRED";
  db.prepare(`INSERT INTO payment_quotes(id,player_id,package_id,asset,network,expected_crypto_amount,expected_usd_minor,status,
    spin_coins_minor,bonus_minor,idempotency_key,created_at,expires_at) VALUES (?,?,?,?,?,?,?,'AWAITING_PAYMENT',?,?,?,?,?)`)
    .run(id, playerId, packageRow.id, asset, network, expectedCrypto, packageRow.price_usd_minor, packageRow.spin_coins_minor, packageRow.bonus_minor, input.idempotencyKey, created.toISOString(), expires.toISOString());
  return db.prepare("SELECT * FROM payment_quotes WHERE id=?").get(id);
}

export function creditConfirmedPayment(db: SpinwordDb, input: { quoteId: string; transactionHash: string; receivedUsdMinor: number; confirmations: number }) {
  return db.transaction(() => {
    const quote = db.prepare("SELECT * FROM payment_quotes WHERE id=?").get(input.quoteId) as {
      id: string; player_id: string; expected_usd_minor: number; status: string; expires_at: string; spin_coins_minor: number; bonus_minor: number;
    } | undefined;
    if (!quote) throw new DomainError("QUOTE_NOT_FOUND", "Payment quote not found.", 404);
    if (quote.status === "CREDITED") return db.prepare("SELECT * FROM payment_quotes WHERE id=?").get(input.quoteId);
    if (new Date(quote.expires_at) <= new Date()) {
      db.prepare("UPDATE payment_quotes SET status='EXPIRED' WHERE id=?").run(quote.id);
      throw new DomainError("QUOTE_EXPIRED", "Expired quotes cannot credit Spin Coins.", 409);
    }
    if (input.receivedUsdMinor < 1000 || input.receivedUsdMinor < quote.expected_usd_minor) {
      db.prepare("UPDATE payment_quotes SET status='UNDERPAID',transaction_hash=?,confirmation_count=? WHERE id=?").run(input.transactionHash, input.confirmations, quote.id);
      throw new DomainError("PAYMENT_UNDERPAID", "Payments below the quoted amount require manual resolution.", 409);
    }
    if (input.confirmations < 1) throw new DomainError("CONFIRMATIONS_REQUIRED", "The payment is still confirming.", 409);
    const timestamp = new Date().toISOString();
    postLedger(db, { playerId: quote.player_id, currency: "SPIN_COIN", amountMinor: quote.spin_coins_minor, direction: "CREDIT", category: "CRYPTO_PURCHASE", idempotencyKey: `purchase:${quote.id}:base`, externalReference: input.transactionHash });
    if (quote.bonus_minor > 0) postLedger(db, { playerId: quote.player_id, currency: "SPIN_COIN", amountMinor: quote.bonus_minor, direction: "CREDIT", category: "PURCHASE_BONUS", idempotencyKey: `purchase:${quote.id}:bonus`, externalReference: input.transactionHash });
    db.prepare("UPDATE payment_quotes SET status='CREDITED',transaction_hash=?,confirmation_count=?,confirmed_at=? WHERE id=?")
      .run(input.transactionHash, input.confirmations, timestamp, quote.id);
    return db.prepare("SELECT * FROM payment_quotes WHERE id=?").get(input.quoteId);
  })();
}
