// Crockford-ish alphabet: no 0/O/1/I to avoid read-aloud and typing confusion.
export const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateShareCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * SHARE_CODE_ALPHABET.length);
    out += SHARE_CODE_ALPHABET[idx];
  }
  return out;
}
