import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "./types";
import { getDb, getOrCreateSandboxPlayer } from "./db";

function signature(value: string) {
  const secret = process.env.SPINWORD_SESSION_SECRET || "spinword-local-development-session-secret";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signedSessionValue(playerId: string) {
  return `${playerId}.${signature(playerId)}`;
}

function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const [playerId, supplied] = value.split(".");
  if (!playerId || !supplied) return null;
  const expected = signature(playerId);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? playerId : null;
}

export async function getCurrentPlayerId(): Promise<string> {
  const db = getDb();
  const sessionPlayer = verifySession((await cookies()).get("spinword_session")?.value);
  if (sessionPlayer) {
    const player = db.prepare("SELECT id, status FROM players WHERE id = ?").get(sessionPlayer) as { id: string; status: string } | undefined;
    if (!player) throw new DomainError("UNAUTHENTICATED", "Session account no longer exists.", 401);
    if (player.status !== "ACTIVE") throw new DomainError("ACCOUNT_RESTRICTED", "This account cannot play right now.", 403);
    return player.id;
  }
  // This repository ships as a sandbox with a deterministic demo player. Set
  // SPINWORD_SANDBOX_AUTH=false once a real authentication provider is wired.
  if (process.env.SPINWORD_SANDBOX_AUTH === "false") {
    throw new DomainError("UNAUTHENTICATED", "Sign in is required.", 401);
  }
  return getOrCreateSandboxPlayer(db);
}
