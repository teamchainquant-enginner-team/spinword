import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { settleExistingRound } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";

export const runtime = "nodejs";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return jsonOk(settleExistingRound(getDb(), await getCurrentPlayerId(), id)); }
  catch (error) { return jsonError(error); }
}
