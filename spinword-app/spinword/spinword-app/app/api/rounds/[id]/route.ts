import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { getRound } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return jsonOk(getRound(getDb(), await getCurrentPlayerId(), id)); }
  catch (error) { return jsonError(error); }
}
