import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { createRound, getActiveRound, listRecentRounds } from "@/server/game";
import { parseAmountToMinor } from "@/server/money";
import { jsonError, jsonOk } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const createSchema = z.object({ mode: z.enum(["STANDARD", "MAX"]), currency: z.enum(["LOOT_COIN", "SPIN_COIN"]), amount: z.union([z.string(), z.number()]), clientSeed: z.string().max(128).optional() });

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    return jsonOk(createRound(getDb(), await getCurrentPlayerId(), { ...input, amountMinor: parseAmountToMinor(input.amount) }), { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function GET(request: NextRequest) {
  try {
    const playerId = await getCurrentPlayerId();
    if (request.nextUrl.searchParams.get("active") === "true") return jsonOk({ activeRound: getActiveRound(getDb(), playerId) });
    return jsonOk(listRecentRounds(getDb(), playerId, {
      mode: request.nextUrl.searchParams.get("mode") ?? undefined,
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
      outcome: request.nextUrl.searchParams.get("outcome") ?? undefined,
      limit: Number(request.nextUrl.searchParams.get("limit") || 50), offset: Number(request.nextUrl.searchParams.get("offset") || 0),
    }));
  } catch (error) { return jsonError(error); }
}
