export type KeyFormat = "hex" | "texte";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}

/** 32 hex digits, any case, or exactly 16 UTF-8 bytes. Returns lowercase hex. */
export function resolveKeyHex(value: string, format: KeyFormat): string | null {
  if (format === "hex") {
    const clean = value.replace(/[\s:]/g, "");
    if (!/^[0-9a-fA-F]{32}$/.test(clean)) return null;
    return clean.toLowerCase();
  }
  const bytes = encoder.encode(value);
  if (bytes.length !== 16) return null;
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function keyMaterialBytes(value: string, format: KeyFormat): number | null {
  if (format === "hex") {
    const clean = value.replace(/[\s:]/g, "");
    if (!clean) return 0;
    if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) return null;
    return clean.length / 2;
  }
  return utf8ByteLength(value);
}

export function keyError(value: string, format: KeyFormat): string | null {
  if (resolveKeyHex(value, format)) return null;
  const size = keyMaterialBytes(value, format);
  if (format === "hex") {
    if (size === null) {
      return "La clé hexadécimale est invalide. Utilisez 32 chiffres 0–9 ou A–F : les majuscules conviennent.";
    }
    return `La clé hexadécimale doit faire exactement 16 octets, soit 32 chiffres (actuellement ${size} octet${size > 1 ? "s" : ""}).`;
  }
  return `La clé texte doit faire exactement 16 octets (actuellement ${size ?? 0}). Les majuscules et les accents comptent dans ces octets.`;
}

export function hexToUtf8(hex: string): string | null {
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  const bytes = Uint8Array.from(hex.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
  try {
    const text = decoder.decode(bytes);
    const back = encoder.encode(text);
    if (back.length !== bytes.length || back.some((byte, index) => byte !== bytes[index])) return null;
    return text;
  } catch {
    return null;
  }
}

export function switchKeyDraft(
  value: string,
  from: KeyFormat,
  to: KeyFormat,
): { draft: string; format: KeyFormat; note: string | null } {
  if (from === to) return { draft: value, format: to, note: null };
  if (to === "hex") {
    const hex = resolveKeyHex(value, "texte");
    if (!hex) {
      return {
        draft: "",
        format: "hex",
        note: "Saisissez 32 chiffres hexadécimaux. Les majuscules conviennent.",
      };
    }
    return { draft: hex, format: "hex", note: null };
  }
  const hex = resolveKeyHex(value, "hex");
  if (!hex) {
    return {
      draft: "",
      format: "texte",
      note: "Saisissez exactement 16 octets de texte. Les majuscules et les accents comptent.",
    };
  }
  const text = hexToUtf8(hex);
  if (text === null) {
    return {
      draft: "",
      format: "texte",
      note: "L’ancienne clé n’est pas du texte UTF-8. Saisissez-en une nouvelle de 16 octets.",
    };
  }
  return { draft: text, format: "texte", note: null };
}

/** Bob keeps a key he chose himself. Otherwise he receives Alice’s key at the next encryption. */
export function keyForBob(aliceHex: string, bobHex: string | null, bobChoseOwnKey: boolean): string | null {
  if (bobChoseOwnKey) return bobHex;
  return aliceHex;
}
