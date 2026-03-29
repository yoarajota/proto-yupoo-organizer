/**
 * Calculates the Hamming distance between two hex strings representing perceptual hashes.
 * Assumes strings are of equal length (e.g., 16 characters for a 64-bit hash).
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error("Hashes must have the same length");
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const byte1 = parseInt(hash1[i], 16);
    const byte2 = parseInt(hash2[i], 16);

    // XOR to find differing bits
    let xor = byte1 ^ byte2;

    // Count set bits (popcount)
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}
