import { NextResponse } from "next/server";
import { DomainError } from "./types";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export function jsonError(error: unknown) {
  if (error instanceof DomainError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "The server could not complete this request." } }, { status: 500 });
}
