import { describe, it, expect } from "vitest";
import { calculateHammingDistance } from "./phash-utils";

describe("phash-utils", () => {
  describe("calculateHammingDistance", () => {
    it("should return 0 for identical hashes", () => {
      const hash = "ffffffffffffffff";
      expect(calculateHammingDistance(hash, hash)).toBe(0);
    });

    it("should return correct distance for different hashes", () => {
      const hash1 = "0000000000000000";
      const hash2 = "0000000000000001"; // 1 bit different
      expect(calculateHammingDistance(hash1, hash2)).toBe(1);

      const hash3 = "0000000000000003"; // 2 bits different (0011)
      expect(calculateHammingDistance(hash1, hash3)).toBe(2);

      const hash4 = "ffffffffffffffff"; // all 64 bits different
      expect(calculateHammingDistance(hash1, hash4)).toBe(64);
    });

    it("should handle hex characters correctly", () => {
      const hash1 = "a"; // 1010
      const hash2 = "5"; // 0101
      // All 4 bits are different
      expect(calculateHammingDistance(hash1, hash2)).toBe(4);
    });

    it("should throw error if lengths differ", () => {
      expect(() => calculateHammingDistance("abc", "abcd")).toThrow(
        "Hashes must have the same length",
      );
    });
  });
});
