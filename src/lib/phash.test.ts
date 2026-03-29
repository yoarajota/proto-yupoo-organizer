import { describe, it, expect } from "vitest";
import phash from "sharp-phash";
import sharp from "sharp";

describe("pHash Utility", () => {
  it("should compute a perceptual hash for a buffer", async () => {
    // Create a 100x100 red image buffer using sharp
    const redBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const hash = await phash(redBuffer);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should return different hashes for different images", async () => {
    const redBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const blueBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const hashRed = await phash(redBuffer);
    const hashBlue = await phash(blueBuffer);

    expect(hashRed).not.toEqual(hashBlue);
  });
});
