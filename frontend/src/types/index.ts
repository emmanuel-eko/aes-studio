export type Mode = "CBC" | "CTR" | "GCM";
export type Actor = "alice" | "bob" | "oscar";
export type Phase =
  | "compose"
  | "encrypting"
  | "transit"
  | "tamper"
  | "decrypting"
  | "complete";

export interface TraceStep {
  index: number;
  operation: string;
  title: string;
  explanation: string;
  code_ref: string;
  phase: string;
  round_number: number | null;
  block_index: number | null;
  state_before: string[][] | null;
  state_after: string[][] | null;
  intermediates: Record<string, unknown>;
  glossary: string[];
}

export interface Representations {
  text: string | null;
  bytes_list: number[];
  binary: string;
  hex: string;
  matrix: string[][] | null;
  operations: string[];
  ciphertext_hex: string | null;
  tag_hex: string | null;
}

export interface SessionResponse {
  ok: boolean;
  mode: Mode;
  actor: string;
  authenticated: boolean | null;
  plaintext: string | null;
  plaintext_hex: string | null;
  ciphertext_hex: string;
  tag_hex: string | null;
  public_params: Record<string, string>;
  secret_params_present: Record<string, boolean>;
  representations: Representations;
  steps: TraceStep[];
  warnings: string[];
  error: string | null;
  error_kind: string | null;
  recovered_text: string | null;
  padding_valid: boolean | null;
  used_key_hex?: string | null;
}

export interface GenerateParams {
  key_hex: string;
  iv_hex: string | null;
  counter_hex: string | null;
  nonce_hex: string | null;
  notes: string[];
}

export interface SourceFile {
  id: string;
  category: string;
  title: string;
  path: string;
  functions: string[];
}

export interface SourceContent {
  id: string;
  category: string;
  title: string;
  path: string;
  language: string;
  content: string;
}

export interface GlossaryTerm {
  id: string;
  title: string;
  summary: string;
  detail: string;
}

export type RepresentationKey =
  | "text"
  | "bytes"
  | "binary"
  | "hex"
  | "matrix"
  | "operations"
  | "cipher";
