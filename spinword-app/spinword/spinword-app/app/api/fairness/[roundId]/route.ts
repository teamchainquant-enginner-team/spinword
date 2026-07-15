import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { getFairness } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ roundId: string }> }) {
  try { const { roundId } = await params; return jsonOk(getFairness(getDb(), await getCurrentPlayerId(), roundId)); }
  catch (error) { return jsonError(error); }
}
