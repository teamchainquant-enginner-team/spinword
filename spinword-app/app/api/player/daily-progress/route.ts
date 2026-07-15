import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { getDailyProgress } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { try { return jsonOk(getDailyProgress(getDb(), await getCurrentPlayerId())); } catch (error) { return jsonError(error); } }
