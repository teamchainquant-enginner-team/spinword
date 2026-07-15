import { describe, expect, it } from "vitest";
import { calculateReturnMinor, parseAmountToMinor } from "../../server/money";

describe("decimal-safe virtual credits", () => {
  it("accepts exactly $1 and $100,000", () => {
    expect(parseAmountToMinor("1")).toBe(100);
    expect(parseAmountToMinor("100000")).toBe(10_000_000);
  });

  it("rejects malformed or unsupported precision", () => {
    expect(() => parseAmountToMinor("1.001")).toThrow();
    expect(() => parseAmountToMinor("1e3")).toThrow();
    expect(() => parseAmountToMinor("-1")).toThrow();
  });

  it("calculates exact Standard and Max total returns", () => {
    expect(calculateReturnMinor(10_000_000, 70_000)).toBe(70_000_000);
    expect(calculateReturnMinor(10_000_000, 1_000_000)).toBe(1_000_000_000);
  });
});
