import { getDb } from "@/server/db";
import { jsonError, jsonOk } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { try { const db = getDb(); db.prepare("SELECT 1").get(); return jsonOk({ status: "ok", database: "ready", timestamp: new Date().toISOString() }); } catch (error) { return jsonError(error); } }
