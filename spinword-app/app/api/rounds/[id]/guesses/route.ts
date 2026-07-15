import { z } from "zod";
import { getCurrentPlayerId } from "@/server/auth";
import { getDb } from "@/server/db";
import { submitGuess } from "@/server/game";
import { jsonError, jsonOk } from "@/server/api";

export const runtime = "nodejs";
const schema = z.object({ guess: z.string().min(1).max(5) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return jsonOk(submitGuess(getDb(), await getCurrentPlayerId(), id, schema.parse(await request.json()).guess)); }
  catch (error) { return jsonError(error); }
}
