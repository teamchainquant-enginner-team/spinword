import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, createPlayer, type SpinwordDb } from "../../server/db";
import { createPaymentQuote, creditConfirmedPayment } from "../../server/payments";

describe("sandbox Spin Coin purchasing", () => {
  let db: SpinwordDb; let playerId: string;
  beforeEach(() => { process.env.SANDBOX_PAYMENTS_ENABLED = "true"; db = createDatabase(":memory:"); db.prepare("UPDATE feature_flags SET enabled=1 WHERE key='CRYPTO_PURCHASES'").run(); playerId = createPlayer(db, "buyer@example.test", "Buyer"); });
  afterEach(() => { db.close(); delete process.env.SANDBOX_PAYMENTS_ENABLED; });

  it("rejects packages below the protected $10 minimum", () => {
    db.prepare("INSERT INTO purchase_packages(id,price_usd_minor,spin_coins_minor,bonus_minor,supported_assets_json,terms_version,max_promotional_liability_minor,status) VALUES ('SC_5',500,500,0,'[\"USDC\"]','TEST',0,'ACTIVE')").run();
    expect(() => createPaymentQuote(db, playerId, { packageId: "SC_5", asset: "USDC", idempotencyKey: "below-minimum" })).toThrow(/minimum/i);
  });

  it("credits a valid $10-equivalent confirmed payment exactly once", () => {
    const quote = createPaymentQuote(db, playerId, { packageId: "SC_10", asset: "USDC", idempotencyKey: "quote-ten" }) as { id: string };
    creditConfirmedPayment(db, { quoteId: quote.id, transactionHash: "0x1234567890abcdef", receivedUsdMinor: 1000, confirmations: 1 });
    creditConfirmedPayment(db, { quoteId: quote.id, transactionHash: "0x1234567890abcdef", receivedUsdMinor: 1000, confirmations: 2 });
    expect(db.prepare("SELECT balance_minor FROM currency_accounts WHERE player_id=? AND currency='SPIN_COIN'").get(playerId)).toMatchObject({ balance_minor: 1000 });
    expect(db.prepare("SELECT COUNT(*) count FROM ledger_entries WHERE category='CRYPTO_PURCHASE'").get()).toMatchObject({ count: 1 });
  });

  it("does not credit an expired quote", () => {
    const quote = createPaymentQuote(db, playerId, { packageId: "SC_10", asset: "BTC", idempotencyKey: "expired-quote" }) as { id: string };
    db.prepare("UPDATE payment_quotes SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(quote.id);
    expect(() => creditConfirmedPayment(db, { quoteId: quote.id, transactionHash: "btc-transaction-abcdef", receivedUsdMinor: 1000, confirmations: 2 })).toThrow(/expired/i);
    expect(db.prepare("SELECT balance_minor FROM currency_accounts WHERE player_id=? AND currency='SPIN_COIN'").get(playerId)).toMatchObject({ balance_minor: 0 });
  });
});
