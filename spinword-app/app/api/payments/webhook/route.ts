import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/server/db";
import { creditConfirmedPayment } from "@/server/payments";
import { jsonError, jsonOk } from "@/server/api";
import { DomainError } from "@/server/types";

export const runtime = "nodejs";
const schema = z.object({ quoteId: z.string().uuid(), transactionHash: z.string().min(16).max(128), receivedUsdMinor: z.number().int().positive(), confirmations: z.number().int().nonnegative() });

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new DomainError("WEBHOOK_DISABLED", "Payment webhook is not configured.", 503);
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const supplied = request.headers.get("x-spinword-signature") ?? "";
    const a = Buffer.from(expected); const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new DomainError("INVALID_SIGNATURE", "Webhook signature is invalid.", 401);
    return jsonOk(creditConfirmedPayment(getDb(), schema.parse(JSON.parse(raw))));
  } catch (error) { return jsonError(error); }
}
