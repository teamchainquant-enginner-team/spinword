import { z } from "zod";
import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError, jsonOk } from "@/server/api";
import { claimDailyLoot } from "@/server/game";

export const runtime = "nodejs";
const schema = z.object({ idempotencyKey: z.string().min(8).max(128) });

export async function POST(request: Request) {
  try { return jsonOk(claimDailyLoot(getDb(), await getCurrentPlayerId(), schema.parse(await request.json()).idempotencyKey)); }
  catch (error) { return jsonError(error); }
}
