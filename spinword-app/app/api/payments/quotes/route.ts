import { z } from "zod";
import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { createPaymentQuote } from "@/server/payments";
import { jsonError, jsonOk } from "@/server/api";
export const runtime = "nodejs";
const schema = z.object({ packageId: z.string(), asset: z.string(), idempotencyKey: z.string().min(8) });
export async function POST(request: Request) { try { return jsonOk(createPaymentQuote(getDb(), await getCurrentPlayerId(), schema.parse(await request.json())), { status: 201 }); } catch (error) { return jsonError(error); } }
