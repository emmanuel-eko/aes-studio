"""AES-128-GCM (NIST SP 800-38D) with a 96-bit nonce.

Confidentiality comes from CTR. Authenticity comes from GHASH and the tag.
The tag is verified before any plaintext is returned.
"""

from __future__ import annotations

from app.cryptography.aes import encrypt_block
from app.cryptography.ghash import ghash
from app.cryptography.key_expansion import expand_key
from app.cryptography.traces import TraceCollector
from app.cryptography.utils import (
    BLOCK_SIZE,
    require_bytes,
    to_hex,
    xor_bytes,
)


GCM_NONCE_SIZE = 12
TAG_SIZE = 16


class AuthenticationError(Exception):
    """Raised when the GCM tag does not match."""


def inc32(block: bytes) -> bytes:
    """Increment the least-significant 32 bits of a 16-byte block."""
    block = require_bytes("counter", block, BLOCK_SIZE)
    prefix = block[:12]
    counter = (int.from_bytes(block[12:], "big") + 1) & 0xFFFFFFFF
    return prefix + counter.to_bytes(4, "big")


def compute_j0(nonce: bytes) -> bytes:
    nonce = require_bytes("nonce", nonce, GCM_NONCE_SIZE)
    return nonce + b"\x00\x00\x00\x01"


def gctr(
    data: bytes,
    key: bytes,
    initial_counter: bytes,
    round_keys: list[bytes],
    trace: TraceCollector | None = None,
    *,
    label: str = "payload",
) -> bytes:
    """GCTR: AES-CTR using a 32-bit increment on the last word."""
    if not data:
        return b""
    counter = require_bytes("initial_counter", initial_counter, BLOCK_SIZE)
    output = bytearray()
    offset = 0
    index = 0
    while offset < len(data):
        chunk = data[offset : offset + BLOCK_SIZE]
        keystream_full = encrypt_block(
            counter,
            key,
            trace,
            phase="encrypt",
            block_index=index,
            expand=False,
            round_keys=round_keys,
        )
        used = keystream_full[: len(chunk)]
        mixed = xor_bytes(chunk, used)
        if trace is not None:
            trace.add(
                operation="GCM.gctr",
                title=f"GCTR ({label}) — bloc {index}",
                explanation=(
                    "GCM chiffre les compteurs comme CTR, mais n'incrémente que "
                    "les 32 bits de poids faible."
                ),
                code_ref="gcm.py:gctr",
                phase="mode_gcm",
                block_index=index,
                intermediates={
                    "counter": to_hex(counter),
                    "keystream": to_hex(used),
                    "input": to_hex(chunk),
                    "output": to_hex(mixed),
                    "label": label,
                },
                glossary=["gcm", "ctr", "xor"],
            )
        output.extend(mixed)
        counter = inc32(counter)
        offset += BLOCK_SIZE
        index += 1
    return bytes(output)


def gcm_encrypt(
    plaintext: bytes,
    key: bytes,
    nonce: bytes,
    aad: bytes = b"",
    trace: TraceCollector | None = None,
) -> tuple[bytes, bytes, dict]:
    """Return (ciphertext, tag, extras) with extras containing H and J0."""
    key = require_bytes("key", key, BLOCK_SIZE)
    nonce = require_bytes("nonce", nonce, GCM_NONCE_SIZE)
    plaintext = require_bytes("plaintext", plaintext)
    aad = require_bytes("aad", aad)
    round_keys = expand_key(key, trace)

    h = encrypt_block(b"\x00" * 16, key, None, expand=False, round_keys=round_keys)
    j0 = compute_j0(nonce)
    if trace is not None:
        trace.add(
            operation="GCM.init",
            title="Sous-clé H et compteur J0",
            explanation=(
                "H = AES_K(0^128) est la clé de GHASH. "
                "Pour un nonce de 96 bits, J0 = nonce || 0x00000001. "
                "Le même couple (clé, nonce) ne doit jamais être réutilisé."
            ),
            code_ref="gcm.py:gcm_encrypt",
            phase="mode_gcm",
            intermediates={
                "H": to_hex(h),
                "nonce": to_hex(nonce),
                "J0": to_hex(j0),
                "aad": to_hex(aad),
            },
            glossary=["gcm", "nonce", "ghash", "confidentiality", "authentication"],
        )

    ciphertext = gctr(
        plaintext,
        key,
        inc32(j0),
        round_keys,
        trace,
        label="confidentialité",
    )
    s = ghash(h, aad, ciphertext, trace)
    tag = gctr(s, key, j0, round_keys, trace, label="étiquette")
    if trace is not None:
        trace.add(
            operation="GCM.tag",
            title="Étiquette d'authentification",
            explanation=(
                "Le tag est GCTR_K(J0, GHASH(H, AAD, C)). "
                "Il lie le chiffré, l'AAD et le nonce. Le modifier, ou modifier C, "
                "doit faire échouer Bob."
            ),
            code_ref="gcm.py:gcm_encrypt",
            phase="mode_gcm",
            intermediates={"S": to_hex(s), "tag": to_hex(tag)},
            glossary=["authentication-tag", "authentication", "integrity"],
        )
    extras = {"H": h, "J0": j0, "S": s}
    return ciphertext, tag, extras


def gcm_decrypt(
    ciphertext: bytes,
    tag: bytes,
    key: bytes,
    nonce: bytes,
    aad: bytes = b"",
    trace: TraceCollector | None = None,
) -> bytes:
    """Verify the tag, then decrypt. Never return plaintext on tag failure."""
    key = require_bytes("key", key, BLOCK_SIZE)
    nonce = require_bytes("nonce", nonce, GCM_NONCE_SIZE)
    ciphertext = require_bytes("ciphertext", ciphertext)
    tag = require_bytes("tag", tag, TAG_SIZE)
    aad = require_bytes("aad", aad)
    round_keys = expand_key(key, trace)

    h = encrypt_block(b"\x00" * 16, key, None, expand=False, round_keys=round_keys)
    j0 = compute_j0(nonce)
    s = ghash(h, aad, ciphertext, trace)
    expected = gctr(s, key, j0, round_keys, trace, label="étiquette")

    if trace is not None:
        trace.add(
            operation="GCM.verify",
            title="Vérification du tag",
            explanation=(
                "Bob recalcule le tag et le compare. En cas d'échec, le clair "
                "n'est pas restitué : GCM fournit confidentialité et authentification."
            ),
            code_ref="gcm.py:gcm_decrypt",
            phase="mode_gcm",
            intermediates={
                "H": to_hex(h),
                "received_tag": to_hex(tag),
                "expected_tag": to_hex(expected),
                "match": tag == expected,
            },
            glossary=["authentication-tag", "authentication", "integrity", "ciphertext-tampering"],
        )

    if tag != expected:
        raise AuthenticationError("GCM authentication tag mismatch")

    plaintext = gctr(
        ciphertext,
        key,
        inc32(j0),
        round_keys,
        trace,
        label="déchiffrement",
    )
    return plaintext
