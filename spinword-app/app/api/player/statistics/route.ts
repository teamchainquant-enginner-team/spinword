import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { getPlayerStatistics } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { try { return jsonOk(getPlayerStatistics(getDb(), await getCurrentPlayerId())); } catch (error) { return jsonError(error); } }
