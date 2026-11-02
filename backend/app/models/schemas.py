"""Request and response schemas. Hex strings never appear in server logs."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Mode = Literal["CBC", "CTR", "GCM", "BLOC"]


class GenerateParamsRequest(BaseModel):
    mode: Mode = "CBC"


class GenerateParamsResponse(BaseModel):
    key_hex: str
    iv_hex: str | None = None
    counter_hex: str | None = None
    nonce_hex: str | None = None
    notes: list[str]


class EncryptRequest(BaseModel):
    plaintext: str = Field(default="", max_length=512)
    plaintext_hex: str | None = None
    mode: Mode
    key_hex: str
    iv_hex: str | None = None
    counter_hex: str | None = None
    nonce_hex: str | None = None
    aad: str = ""


class DecryptRequest(BaseModel):
    ciphertext_hex: str
    mode: Mode
    key_hex: str
    iv_hex: str | None = None
    counter_hex: str | None = None
    nonce_hex: str | None = None
    tag_hex: str | None = None
    aad: str = ""
    actor: Literal["bob", "oscar"] = "bob"


class KeyExpansionRequest(BaseModel):
    key_hex: str


class TraceStep(BaseModel):
    index: int
    operation: str
    title: str
    explanation: str
    code_ref: str
    phase: str
    round_number: int | None = None
    block_index: int | None = None
    state_before: list[list[str]] | None = None
    state_after: list[list[str]] | None = None
    intermediates: dict[str, Any] = Field(default_factory=dict)
    glossary: list[str] = Field(default_factory=list)


class Representations(BaseModel):
    text: str | None
    bytes_list: list[int]
    binary: str
    hex: str
    matrix: list[list[str]] | None
    operations: list[str]
    ciphertext_hex: str | None = None
    tag_hex: str | None = None


class SessionResponse(BaseModel):
    ok: bool
    mode: Mode
    actor: str
    authenticated: bool | None = None
    plaintext: str | None = None
    plaintext_hex: str | None = None
    ciphertext_hex: str
    tag_hex: str | None = None
    public_params: dict[str, str]
    secret_params_present: dict[str, bool]
    representations: Representations
    steps: list[TraceStep]
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_kind: str | None = None
    recovered_text: str | None = None
    padding_valid: bool | None = None
    used_key_hex: str | None = None


class SourceFile(BaseModel):
    id: str
    category: str
    title: str
    path: str
    functions: list[str]


class SourceListResponse(BaseModel):
    files: list[SourceFile]


class SourceContentResponse(BaseModel):
    id: str
    category: str
    title: str
    path: str
    language: str = "python"
    content: str


class GlossaryTerm(BaseModel):
    id: str
    title: str
    summary: str
    detail: str


class HealthResponse(BaseModel):
    status: str
    engine: str
    notice: str
