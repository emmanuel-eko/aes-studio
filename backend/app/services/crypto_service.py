"""Orchestrate encryption, decryption and pedagogical traces.

Keys and messages are never written to logs.
"""

from __future__ import annotations

import os
import secrets
from threading import Lock

from app.cryptography.cbc import cbc_decrypt, cbc_encrypt
from app.cryptography.ctr import ctr_crypt
from app.cryptography.gcm import AuthenticationError, gcm_decrypt, gcm_encrypt
from app.cryptography.key_expansion import expand_key
from app.cryptography.traces import TraceCollector
from app.cryptography.utils import (
    BLOCK_SIZE,
    align_cbc_ciphertext,
    bytes_to_state,
    display_text,
    hex_to_bytes,
    state_to_hex,
    to_bin,
    to_hex,
    try_utf8,
    utf8_bytes,
)
from app.models.schemas import (
    DecryptRequest,
    EncryptRequest,
    GenerateParamsResponse,
    Representations,
    SessionResponse,
    TraceStep,
)

MAX_MESSAGE_BYTES = int(os.environ.get("AES_STUDIO_MAX_MESSAGE_BYTES", "256"))

_used_gcm: set[tuple[str, str]] = set()
_gcm_lock = Lock()


class CryptoError(ValueError):
    def __init__(self, message: str, kind: str = "validation") -> None:
        super().__init__(message)
        self.kind = kind


def _limit(data: bytes, name: str) -> bytes:
    if len(data) > MAX_MESSAGE_BYTES:
        raise CryptoError(
            f"{name} dépasse la limite pédagogique de {MAX_MESSAGE_BYTES} octets.",
            "size",
        )
    return data


def _parse_key(key_hex: str) -> bytes:
    key = hex_to_bytes(key_hex, name="clé")
    if len(key) != BLOCK_SIZE:
        raise CryptoError("La clé AES-128 doit faire exactement 16 octets (32 hex).")
    return key


def generate_params(mode: str) -> GenerateParamsResponse:
    key = secrets.token_bytes(16)
    notes = [
        "Clé générée avec secrets.token_bytes (CSPRNG).",
        "La clé est secrète : elle n'appartient qu'à Alice et Bob.",
    ]
    iv_hex = counter_hex = nonce_hex = None
    if mode == "CBC":
        iv_hex = to_hex(secrets.token_bytes(16))
        notes.append("IV CBC de 128 bits, public, à usage unique.")
    elif mode == "CTR":
        counter_hex = to_hex(secrets.token_bytes(16))
        notes.append("Compteur initial CTR de 128 bits, à ne pas réutiliser avec la même clé.")
    else:
        nonce_hex = to_hex(secrets.token_bytes(12))
        notes.append("Nonce GCM de 96 bits. Ne jamais le réutiliser avec la même clé.")
    return GenerateParamsResponse(
        key_hex=to_hex(key),
        iv_hex=iv_hex,
        counter_hex=counter_hex,
        nonce_hex=nonce_hex,
        notes=notes,
    )


def expand_key_steps(key_hex: str) -> list[dict]:
    trace = TraceCollector()
    expand_key(_parse_key(key_hex), trace)
    return trace.as_list()


def _representations(
    *,
    text: str | None,
    data: bytes,
    ciphertext: bytes | None,
    tag: bytes | None,
    operations: list[str],
) -> Representations:
    matrix = None
    if len(data) >= 16:
        matrix = state_to_hex(bytes_to_state(data[:16]))
    elif data:
        padded = data + b"\x00" * (16 - len(data))
        matrix = state_to_hex(bytes_to_state(padded))
    return Representations(
        text=text,
        bytes_list=list(data),
        binary=to_bin(data),
        hex=to_hex(data),
        matrix=matrix,
        operations=operations,
        ciphertext_hex=to_hex(ciphertext) if ciphertext is not None else None,
        tag_hex=to_hex(tag) if tag is not None else None,
    )


def _register_gcm(key_hex: str, nonce_hex: str) -> None:
    token = (key_hex.lower().replace(" ", ""), nonce_hex.lower().replace(" ", ""))
    with _gcm_lock:
        if token in _used_gcm:
            raise CryptoError(
                "Ce nonce GCM a déjà été utilisé avec cette clé dans cette session. "
                "Générez un nouveau nonce.",
                "nonce_reuse",
            )
        _used_gcm.add(token)


def encrypt_session(req: EncryptRequest) -> SessionResponse:
    key = _parse_key(req.key_hex)
    plaintext = _limit(utf8_bytes(req.plaintext), "message")
    aad = _limit(utf8_bytes(req.aad), "AAD")
    trace = TraceCollector()
    warnings: list[str] = []
    tag = None
    public: dict[str, str] = {"mode": req.mode, "algorithm": "AES-128"}

    if req.mode == "CBC":
        if not req.iv_hex:
            raise CryptoError("CBC exige un IV de 16 octets.")
        iv = hex_to_bytes(req.iv_hex, name="IV")
        if len(iv) != 16:
            raise CryptoError("L'IV CBC doit faire 16 octets.")
        ciphertext = cbc_encrypt(plaintext, key, iv, trace)
        public["iv_hex"] = to_hex(iv)
    elif req.mode == "CTR":
        if not req.counter_hex:
            raise CryptoError("CTR exige un compteur initial de 16 octets.")
        counter = hex_to_bytes(req.counter_hex, name="compteur")
        if len(counter) != 16:
            raise CryptoError("Le compteur CTR doit faire 16 octets.")
        ciphertext = ctr_crypt(plaintext, key, counter, trace)
        public["counter_hex"] = to_hex(counter)
    else:
        if not req.nonce_hex:
            raise CryptoError("GCM exige un nonce de 12 octets (96 bits).")
        nonce = hex_to_bytes(req.nonce_hex, name="nonce")
        if len(nonce) != 12:
            raise CryptoError("Le nonce GCM de démonstration doit faire 12 octets.")
        _register_gcm(req.key_hex, req.nonce_hex)
        ciphertext, tag, extras = gcm_encrypt(plaintext, key, nonce, aad, trace)
        public["nonce_hex"] = to_hex(nonce)
        public["tag_hex"] = to_hex(tag)
        public["H"] = to_hex(extras["H"])
        if aad:
            public["aad"] = req.aad

    operations = [step["operation"] for step in trace.as_list()]
    return SessionResponse(
        ok=True,
        mode=req.mode,
        actor="alice",
        authenticated=True if req.mode == "GCM" else None,
        plaintext=req.plaintext,
        plaintext_hex=to_hex(plaintext),
        ciphertext_hex=to_hex(ciphertext),
        tag_hex=to_hex(tag) if tag is not None else None,
        public_params=public,
        secret_params_present={"key": True},
        representations=_representations(
            text=req.plaintext,
            data=plaintext,
            ciphertext=ciphertext,
            tag=tag,
            operations=operations,
        ),
        steps=[TraceStep(**step) for step in trace.as_list()],
        warnings=warnings,
    )


def decrypt_session(req: DecryptRequest) -> SessionResponse:
    key = _parse_key(req.key_hex)
    ciphertext = _limit(hex_to_bytes(req.ciphertext_hex, name="chiffré"), "chiffré")
    aad = _limit(utf8_bytes(req.aad), "AAD")
    trace = TraceCollector()
    public: dict[str, str] = {"mode": req.mode, "algorithm": "AES-128"}
    tag = None
    plaintext: bytes | None = None
    error = None
    error_kind = None
    authenticated: bool | None = None
    padding_valid: bool | None = None
    warnings: list[str] = []

    try:
        if req.mode == "CBC":
            if not req.iv_hex:
                raise CryptoError("CBC exige un IV.")
            iv = hex_to_bytes(req.iv_hex, name="IV")
            if len(iv) != 16:
                raise CryptoError("L'IV CBC doit faire 16 octets.")
            public["iv_hex"] = to_hex(iv)
            ciphertext, extra = align_cbc_ciphertext(ciphertext)
            if extra:
                warnings.append(
                    f"Le chiffré n'avait pas une longueur multiple de 16. "
                    f"{extra} octet(s) 00 ont été ajoutés pour tenter le déchiffrement."
                )
            # No authentication: always return the AES+XOR result, even if PKCS#7 is broken.
            plaintext = cbc_decrypt(ciphertext, key, iv, trace, strict=False)
            padding_valid = not any(
                step["operation"] == "CBC.padding_error" for step in trace.as_list()
            )
            if not padding_valid:
                warnings.append(
                    "CBC a déchiffré le canal modifié. Le padding est invalide : "
                    "le texte affiché est le résultat AES, sans garantie d'intégrité."
                )
        elif req.mode == "CTR":
            if not req.counter_hex:
                raise CryptoError("CTR exige un compteur initial.")
            counter = hex_to_bytes(req.counter_hex, name="compteur")
            if len(counter) != 16:
                raise CryptoError("Le compteur CTR doit faire 16 octets.")
            public["counter_hex"] = to_hex(counter)
            plaintext = ctr_crypt(ciphertext, key, counter, trace, phase="mode_ctr")
        else:
            if not req.nonce_hex or not req.tag_hex:
                raise CryptoError("GCM exige le nonce et le tag.")
            nonce = hex_to_bytes(req.nonce_hex, name="nonce")
            tag = hex_to_bytes(req.tag_hex, name="tag")
            if len(nonce) != 12:
                raise CryptoError("Le nonce GCM doit faire 12 octets.")
            if len(tag) != 16:
                warnings.append(
                    "Le tag GCM n'a pas 16 octets : il a été recadré (00) pour tenter la vérification."
                )
                tag = (tag + b"\x00" * 16)[:16]
            public["nonce_hex"] = to_hex(nonce)
            public["tag_hex"] = to_hex(tag)
            if aad:
                public["aad"] = req.aad
            try:
                plaintext = gcm_decrypt(ciphertext, tag, key, nonce, aad, trace)
                authenticated = True
            except AuthenticationError as exc:
                authenticated = False
                error = str(exc)
                error_kind = "authentication"
                plaintext = None
                warnings.append(
                    "GCM authentifie. Le tag est faux : le clair n'est pas restitué."
                )
    except CryptoError as exc:
        error = str(exc)
        error_kind = exc.kind
    except ValueError as exc:
        error = str(exc)
        error_kind = "crypto"

    recovered = display_text(plaintext) if plaintext is not None else None
    text = try_utf8(plaintext) if plaintext is not None else None
    if req.mode in {"CBC", "CTR"} and recovered is not None:
        # No authentication: always expose the obtained string, even if it is not UTF-8.
        text = recovered
        if error_kind == "crypto" and plaintext is not None:
            error_kind = None
            error = None
    if req.actor == "oscar":
        warnings.insert(
            0,
            "Oscar n'a pas la clé d'Alice. Le résultat d'un essai sans la clé "
            "n'est pas le message confidentiel.",
        )
    operations = [step["operation"] for step in trace.as_list()]
    return SessionResponse(
        ok=(
            (req.mode in {"CBC", "CTR"} and plaintext is not None)
            or (
                authenticated is not False
                and error_kind not in {"validation", "size", "crypto", "nonce_reuse"}
            )
        ),
        mode=req.mode,
        actor=req.actor,
        authenticated=authenticated,
        plaintext=text,
        plaintext_hex=to_hex(plaintext) if plaintext is not None else None,
        ciphertext_hex=to_hex(ciphertext),
        tag_hex=to_hex(tag) if tag is not None else None,
        public_params=public,
        secret_params_present={"key": True},
        representations=_representations(
            text=recovered,
            data=plaintext if plaintext is not None else ciphertext,
            ciphertext=ciphertext,
            tag=tag,
            operations=operations,
        ),
        steps=[TraceStep(**step) for step in trace.as_list()],
        warnings=warnings,
        error=error,
        error_kind=error_kind,
        recovered_text=recovered,
        padding_valid=padding_valid,
        used_key_hex=to_hex(key),
    )
