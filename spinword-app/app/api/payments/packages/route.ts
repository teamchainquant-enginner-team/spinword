import { getDb } from "@/server/db";
import { listPackages } from "@/server/payments";
import { jsonError, jsonOk } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { try { return jsonOk({ minimumPurchaseUsdMinor: 1000, packages: listPackages(getDb()), purchasesEnabled: process.env.CRYPTO_PURCHASES_ENABLED === "true" && process.env.SANDBOX_PAYMENTS_ENABLED === "true" }); } catch (error) { return jsonError(error); } }
