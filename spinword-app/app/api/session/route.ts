import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError, jsonOk } from "@/server/api";
import { getSessionSummary } from "@/server/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return jsonOk(getSessionSummary(getDb(), await getCurrentPlayerId())); }
  catch (error) { return jsonError(error); }
}
