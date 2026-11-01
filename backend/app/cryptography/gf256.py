"""Arithmetic in the finite field GF(2^8) used by AES.

The irreducible polynomial is
    m(x) = x^8 + x^4 + x^3 + x + 1   (0x11B).
"""

from __future__ import annotations

AES_POLY = 0x11B


def xtime(byte: int) -> int:
    """Multiply by {02} in GF(2^8): left shift, reduce by 0x1B if needed."""
    byte &= 0xFF
    shifted = (byte << 1) & 0xFF
    return shifted ^ 0x1B if byte & 0x80 else shifted


def gf_add(left: int, right: int) -> int:
    """Addition in GF(2^8) is XOR."""
    return (left ^ right) & 0xFF


def gf_mul(left: int, right: int) -> int:
    """Peasant multiplication in GF(2^8)."""
    a = left & 0xFF
    b = right & 0xFF
    product = 0
    for _ in range(8):
        if b & 1:
            product ^= a
        a = xtime(a)
        b >>= 1
    return product & 0xFF


def gf_pow(base: int, exponent: int) -> int:
    result = 1
    value = base & 0xFF
    exp = exponent
    while exp:
        if exp & 1:
            result = gf_mul(result, value)
        value = gf_mul(value, value)
        exp >>= 1
    return result


def gf_inv(byte: int) -> int:
    """Multiplicative inverse: 0 maps to 0, otherwise a^{254} = a^{-1}."""
    byte &= 0xFF
    if byte == 0:
        return 0
    return gf_pow(byte, 254)


def rcon_byte(index: int) -> int:
    """First byte of the AES round constant word for expansion step `index` (1-based)."""
    if index < 1:
        raise ValueError("Rcon index must be >= 1")
    value = 1
    for _ in range(index - 1):
        value = xtime(value)
    return value
