import { NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getLeaderboard } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { try { return jsonOk(getLeaderboard(getDb(), { mode: request.nextUrl.searchParams.get("mode") ?? undefined, currency: request.nextUrl.searchParams.get("currency") ?? undefined, period: request.nextUrl.searchParams.get("period") ?? undefined })); } catch (error) { return jsonError(error); } }
