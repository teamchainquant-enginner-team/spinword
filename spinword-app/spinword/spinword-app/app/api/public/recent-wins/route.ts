import { NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getPublicWins } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { try { return jsonOk({ wins: getPublicWins(getDb(), Number(request.nextUrl.searchParams.get("limit") || 20)) }); } catch (error) { return jsonError(error); } }
