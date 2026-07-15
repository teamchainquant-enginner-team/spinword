import { getDb } from "@/server/db";
import { getOperatorOverview } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";
import { DomainError } from "@/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { try { const expected = process.env.SPINWORD_ADMIN_API_KEY; if (expected && request.headers.get("x-spinword-admin-key") !== expected) throw new DomainError("FORBIDDEN", "Administrator permission is required.", 403); return jsonOk(getOperatorOverview(getDb())); } catch (error) { return jsonError(error); } }
