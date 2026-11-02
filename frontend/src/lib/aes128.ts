// AES-128 sur un seul bloc (FIPS-197), sans mode d'opération, sans padding, sans IV.
const SBOX = new Uint8Array(256);
const INV = new Uint8Array(256);
(() => {
  let p = 1, q = 1;
  do {
    p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    const r = (x: number, s: number) => ((x << s) | (x >> (8 - s))) & 0xff;
    const x = q ^ r(q, 1) ^ r(q, 2) ^ r(q, 3) ^ r(q, 4) ^ 0x63;
    SBOX[p] = x; INV[x] = p;
  } while (p !== 1);
  SBOX[0] = 0x63; INV[0x63] = 0;
})();
const xt = (a: number) => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;
const mul = (a: number, b: number) => { let r = 0; while (b) { if (b & 1) r ^= a; a = xt(a); b >>= 1; } return r; };

function expand(key: Uint8Array): Uint8Array[] {
  const w = new Uint8Array(176); w.set(key);
  let rc = 1;
  for (let i = 16; i < 176; i += 4) {
    let t = w.slice(i - 4, i);
    if (i % 16 === 0) {
      t = new Uint8Array([SBOX[t[1]] ^ rc, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]]);
      rc = xt(rc);
    }
    for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
  }
  return Array.from({ length: 11 }, (_, r) => w.slice(r * 16, r * 16 + 16));
}
const addKey = (s: Uint8Array, k: Uint8Array) => { for (let i = 0; i < 16; i++) s[i] ^= k[i]; };
function shift(s: Uint8Array, inv: boolean) {
  const t = s.slice();
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    s[c * 4 + r] = t[(((inv ? c - r + 4 : c + r) % 4) * 4) + r];
}
function mix(s: Uint8Array, m: number[]) {
  for (let c = 0; c < 4; c++) {
    const a = s.slice(c * 4, c * 4 + 4);
    for (let r = 0; r < 4; r++)
      s[c * 4 + r] = mul(a[0], m[(4 - r) % 4]) ^ mul(a[1], m[(5 - r) % 4]) ^ mul(a[2], m[(6 - r) % 4]) ^ mul(a[3], m[(7 - r) % 4]);
  }
}
function check(b: Uint8Array, k: Uint8Array) {
  if (b.length !== 16 || k.length !== 16) throw new Error("Le bloc et la clé doivent faire exactement 16 octets.");
}
export function encryptBlock(block: Uint8Array, key: Uint8Array): Uint8Array {
  check(block, key);
  const ks = expand(key), s = block.slice();
  addKey(s, ks[0]);
  for (let r = 1; r <= 10; r++) {
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    shift(s, false);
    if (r < 10) mix(s, [2, 3, 1, 1]);
    addKey(s, ks[r]);
  }
  return s;
}
export function decryptBlock(block: Uint8Array, key: Uint8Array): Uint8Array {
  check(block, key);
  const ks = expand(key), s = block.slice();
  addKey(s, ks[10]);
  for (let r = 9; r >= 0; r--) {
    shift(s, true);
    for (let i = 0; i < 16; i++) s[i] = INV[s[i]];
    addKey(s, ks[r]);
    if (r > 0) mix(s, [14, 11, 13, 9]);
  }
  return s;
}
export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function fromHex(h: string): Uint8Array | null {
  const c = h.replace(/\s+/g, "");
  if (c.length % 2 || /[^0-9a-fA-F]/.test(c)) return null;
  return new Uint8Array(c.match(/../g)?.map((x) => parseInt(x, 16)) ?? []);
}
export const utf8 = (s: string) => new TextEncoder().encode(s);
