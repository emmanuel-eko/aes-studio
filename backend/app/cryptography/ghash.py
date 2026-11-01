"""GHASH and multiplication in GF(2^128) as specified by NIST SP 800-38D.

The field polynomial is x^128 + x^7 + x^2 + x + 1.
The rightmost bit of a block is treated as the least-significant field bit
in the bit-serial algorithm of Appendix A.
"""

from __future__ import annotations

from app.cryptography.traces import TraceCollector
from app.cryptography.utils import to_hex, xor_bytes

R_POLY = 0xE1000000000000000000000000000000


def bytes_to_int(block: bytes) -> int:
    if len(block) != 16:
        raise ValueError("GF(2^128) block must be 16 bytes")
    return int.from_bytes(block, "big")


def int_to_bytes(value: int) -> bytes:
    return (value & ((1 << 128) - 1)).to_bytes(16, "big")


def gf128_mul(x: bytes, y: bytes) -> bytes:
    """Multiply two 128-bit field elements (NIST bit-serial algorithm)."""
    X = bytes_to_int(x)
    V = bytes_to_int(y)
    Z = 0
    for i in range(128):
        if (X >> (127 - i)) & 1:
            Z ^= V
        lsb = V & 1
        V >>= 1
        if lsb:
            V ^= R_POLY
    return int_to_bytes(Z)


def _pad16(data: bytes) -> bytes:
    if len(data) % 16 == 0:
        return data
    return data + b"\x00" * (16 - (len(data) % 16))


def encode_length(aad_len: int, ciphertext_len: int) -> bytes:
    """64-bit bit-lengths of AAD and ciphertext, concatenated."""
    return (aad_len * 8).to_bytes(8, "big") + (ciphertext_len * 8).to_bytes(8, "big")


def ghash(
    h: bytes,
    aad: bytes,
    ciphertext: bytes,
    trace: TraceCollector | None = None,
) -> bytes:
    """GHASH_H(AAD || pad || C || pad || [len(A)]_64 || [len(C)]_64)."""
    if len(h) != 16:
        raise ValueError("H must be 16 bytes")
    y = b"\x00" * 16
    blocks: list[tuple[str, bytes]] = []
    padded_aad = _pad16(aad)
    for i in range(0, len(padded_aad), 16):
        blocks.append(("aad", padded_aad[i : i + 16]))
    padded_c = _pad16(ciphertext)
    for i in range(0, len(padded_c), 16):
        blocks.append(("ciphertext", padded_c[i : i + 16]))
    blocks.append(("lengths", encode_length(len(aad), len(ciphertext))))

    if trace is not None:
        trace.add(
            operation="GHASH.start",
            title="Initialisation de GHASH",
            explanation=(
                "GHASH accumule un XOR puis une multiplication par H dans GF(2^128). "
                "Il authentifie le chiffré et les données associées, pas le clair."
            ),
            code_ref="ghash.py:ghash",
            phase="mode_gcm",
            intermediates={
                "H": to_hex(h),
                "aad_hex": to_hex(aad),
                "ciphertext_hex": to_hex(ciphertext),
            },
            glossary=["ghash", "gcm", "authentication"],
        )

    for index, (kind, block) in enumerate(blocks):
        xored = xor_bytes(y, block)
        y = gf128_mul(xored, h)
        if trace is not None:
            trace.add(
                operation="GHASH.block",
                title=f"GHASH — bloc {index} ({kind})",
                explanation=(
                    "Y ← (Y ⊕ X_i) · H. Le dernier bloc encode les longueurs de l'AAD "
                    "et du chiffré, en bits."
                ),
                code_ref="ghash.py:gf128_mul",
                phase="mode_gcm",
                block_index=index,
                intermediates={
                    "kind": kind,
                    "block": to_hex(block),
                    "y_xor": to_hex(xored),
                    "y": to_hex(y),
                    "H": to_hex(h),
                },
                glossary=["ghash", "gf256"],
            )
    return y
