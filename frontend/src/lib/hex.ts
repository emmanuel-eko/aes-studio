export function normalizeHex(value: string): string {
  return value.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

export function splitBytes(hex: string): string[] {
  const clean = normalizeHex(hex);
  const bytes: string[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(clean.slice(i, i + 2).padEnd(2, "0"));
  }
  return bytes;
}

export function setByte(hex: string, index: number, byteHex: string): string {
  const bytes = splitBytes(hex);
  const next = normalizeHex(byteHex).slice(0, 2).padStart(2, "0");
  if (index >= 0 && index < bytes.length) bytes[index] = next;
  return bytes.join("");
}

export function insertByte(hex: string, index: number, byteHex = "00"): string {
  const bytes = splitBytes(hex);
  const next = normalizeHex(byteHex).slice(0, 2).padStart(2, "0");
  const at = Math.max(0, Math.min(index, bytes.length));
  bytes.splice(at, 0, next);
  return bytes.join("");
}

export function removeByte(hex: string, index: number): string {
  const bytes = splitBytes(hex);
  if (index >= 0 && index < bytes.length) bytes.splice(index, 1);
  return bytes.join("");
}

export function formatGrouped(hex: string, group = 2): string {
  const clean = normalizeHex(hex);
  return clean.replace(new RegExp(`.{1,${group}}`, "g"), "$& ").trim();
}

export function randomKeyHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sourceIdFromRef(codeRef: string): string {
  const file = codeRef.split(":")[0] ?? "aes.py";
  return file.replace(".py", "");
}
