import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { TileState } from "./types";

export function scoreGuess(guess: string, answer: string): TileState[] {
  const result: TileState[] = Array.from({ length: 5 }, () => "absent");
  const remaining = new Map<string, number>();
  for (const letter of answer) remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  for (let index = 0; index < 5; index += 1) {
    if (guess[index] === answer[index]) {
      result[index] = "correct";
      remaining.set(guess[index], (remaining.get(guess[index]) ?? 0) - 1);
    }
  }
  for (let index = 0; index < 5; index += 1) {
    const letter = guess[index];
    if (result[index] === "absent" && (remaining.get(letter) ?? 0) > 0) {
      result[index] = "present";
      remaining.set(letter, (remaining.get(letter) ?? 0) - 1);
    }
  }
  return result;
}

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function seedCommitment(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

export function selectionDigest(serverSeed: string, clientSeed: string, nonce: number, poolVersion: string): Buffer {
  return createHmac("sha256", Buffer.from(serverSeed, "hex"))
    .update(`${clientSeed}:${nonce}:${poolVersion}`)
    .digest();
}

export function unbiasedIndex(digest: Buffer, size: number): number {
  if (!Number.isInteger(size) || size < 1) throw new Error("Pool size must be positive");
  const range = 0x100000000;
  const limit = range - (range % size);
  for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
    const value = digest.readUInt32BE(offset);
    if (value < limit) return value % size;
  }
  return unbiasedIndex(createHash("sha256").update(digest).digest(), size);
}

export function selectWordIndex(serverSeed: string, clientSeed: string, nonce: number, poolVersion: string, poolSize: number): number {
  return unbiasedIndex(selectionDigest(serverSeed, clientSeed, nonce, poolVersion), poolSize);
}

function encryptionKey(): Buffer {
  const secret = process.env.SPINWORD_SEED_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production" && process.env.SPINWORD_SANDBOX_AUTH === "false") {
    throw new Error("SPINWORD_SEED_ENCRYPTION_KEY is required when sandbox mode is disabled");
  }
  return createHash("sha256").update(secret || "spinword-local-development-seed-key").digest();
}

export function encryptSeed(seed: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(seed, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSeed(value: string): string {
  const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
