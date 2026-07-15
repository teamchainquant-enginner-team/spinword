import { describe, expect, it } from "vitest";
import { generateServerSeed, scoreGuess, seedCommitment, selectWordIndex } from "../../server/fairness";

describe("letter scoring", () => {
  it("handles duplicate letters without over-crediting", () => {
    expect(scoreGuess("SHEEP", "EERIE")).toEqual(["absent", "absent", "present", "present", "absent"]);
  });

  it("marks exact matches before present matches", () => {
    expect(scoreGuess("LEVEL", "HELLO")).toEqual(["present", "correct", "absent", "absent", "present"]);
  });
});

describe("verifiable selection", () => {
  it("is deterministic and bounded", () => {
    const seed = "00".repeat(32);
    const index = selectWordIndex(seed, "client", 42, "POOL_001", 2048);
    expect(index).toBe(selectWordIndex(seed, "client", 42, "POOL_001", 2048));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(2048);
  });

  it("commits to a fresh random seed", () => {
    const first = generateServerSeed(); const second = generateServerSeed();
    expect(first).not.toBe(second);
    expect(seedCommitment(first)).toHaveLength(64);
  });
});
