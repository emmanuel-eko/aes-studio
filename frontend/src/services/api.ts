import type {
  GenerateParams,
  GlossaryTerm,
  Mode,
  SessionResponse,
  SourceContent,
  SourceFile,
  TraceStep,
} from "../types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `Erreur ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (body.detail?.message) detail = body.detail.message;
    } catch {
      /* keep status text */
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export function generateParams(mode: Mode) {
  return request<GenerateParams>("/api/params/generate", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export function expandKey(key_hex: string) {
  return request<TraceStep[]>("/api/key-expansion", {
    method: "POST",
    body: JSON.stringify({ key_hex }),
  });
}

export function encryptSession(payload: {
  plaintext: string;
  mode: Mode;
  key_hex: string;
  iv_hex?: string;
  counter_hex?: string;
  nonce_hex?: string;
  aad?: string;
}) {
  return request<SessionResponse>("/api/session/encrypt", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function decryptSession(payload: {
  ciphertext_hex: string;
  mode: Mode;
  key_hex: string;
  iv_hex?: string;
  counter_hex?: string;
  nonce_hex?: string;
  tag_hex?: string;
  aad?: string;
  actor?: "bob" | "oscar";
}) {
  return request<SessionResponse>("/api/session/decrypt", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listSources() {
  return request<{ files: SourceFile[] }>("/api/source");
}

export function readSource(id: string) {
  return request<SourceContent>(`/api/source/${id}`);
}

export function glossary() {
  return request<GlossaryTerm[]>("/api/glossary");
}

export function archiveUrl() {
  return `${BASE}/api/source/archive.zip`;
}

export function downloadUrl(id: string) {
  return `${BASE}/api/source/${id}/download`;
}

export function health() {
  return request<{ status: string; engine: string; notice: string }>("/api/health");
}
