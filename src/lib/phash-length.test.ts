import { describe, it } from "vitest";
import phash from "sharp-phash";
import sharp from "sharp";

describe("phash-length", () => {
  it("should check hash length", async () => {
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
    console.log("PHASH:", hash, "LENGTH:", hash.length);
  });
});
