import { DomainError } from "./types";

export function parseAmountToMinor(input: unknown): number {
  if (typeof input !== "string" && typeof input !== "number") {
    throw new DomainError("INVALID_AMOUNT", "Play amount must be a number.");
  }
  const text = String(input).trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text)) {
    throw new DomainError("INVALID_AMOUNT", "Use a positive amount with no more than two decimal places.");
  }
  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new DomainError("INVALID_AMOUNT", "Amount is too large.");
  return minor;
}

export function formatMinor(minor: number): string {
  return (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calculateReturnMinor(playAmountMinor: number, multiplierBasisPoints: number): number {
  if (!Number.isSafeInteger(playAmountMinor) || !Number.isSafeInteger(multiplierBasisPoints)) {
    throw new DomainError("INVALID_MONEY", "Financial values must use integer minor units.");
  }
  return Math.floor((playAmountMinor * multiplierBasisPoints) / 10000);
}

export function multiplierLabel(basisPoints: number | null): string {
  if (basisPoints == null) return "—";
  return `${Number((basisPoints / 10000).toFixed(2))}x`;
}
