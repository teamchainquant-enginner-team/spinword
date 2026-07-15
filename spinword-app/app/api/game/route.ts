import { z } from "zod";
import { getCurrentPlayerId } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/api";
import { getDb } from "@/server/db";
import { claimDailyLoot, createRound, getDailyProgress, getSessionSummary, submitGuess } from "@/server/game";
import { parseAmountToMinor } from "@/server/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bootstrap") }),
  z.object({ action: z.literal("claim"), idempotencyKey: z.string().min(8).max(128) }),
  z.object({
    action: z.literal("createRound"),
    mode: z.enum(["STANDARD", "MAX"]),
    currency: z.enum(["LOOT_COIN", "SPIN_COIN"]),
    amount: z.union([z.string(), z.number()]),
    clientSeed: z.string().max(128).optional(),
  }),
  z.object({ action: z.literal("guess"), roundId: z.string().uuid(), guess: z.string().min(1).max(5) }),
]);

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const db = getDb();
    const playerId = await getCurrentPlayerId();

    switch (input.action) {
      case "bootstrap":
        return jsonOk({ session: getSessionSummary(db, playerId), progress: getDailyProgress(db, playerId) });
      case "claim":
        return jsonOk(claimDailyLoot(db, playerId, input.idempotencyKey));
      case "createRound":
        return jsonOk(createRound(db, playerId, { ...input, amountMinor: parseAmountToMinor(input.amount) }), { status: 201 });
      case "guess":
        return jsonOk(submitGuess(db, playerId, input.roundId, input.guess));
    }
  } catch (error) {
    return jsonError(error);
  }
}
