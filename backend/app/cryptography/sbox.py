"""AES S-Box and inverse S-Box, generated from GF(2^8) inversion + affine map.

The construction follows FIPS 197 §5.1.1:
1. replace the byte by its multiplicative inverse in GF(2^8);
2. apply the affine transformation
       b'_i = b_i ⊕ b_{i+4} ⊕ b_{i+5} ⊕ b_{i+6} ⊕ b_{i+7} ⊕ c_i
   with c = 0x63.
"""

from __future__ import annotations

from app.cryptography.gf256 import gf_inv


AFFINE_C = 0x63
INV_AFFINE_C = 0x05


def _rotl8(value: int, n: int) -> int:
    value &= 0xFF
    n &= 7
    return ((value << n) | (value >> (8 - n))) & 0xFF


def affine_transform(byte: int) -> int:
    """Forward AES affine map over GF(2)."""
    b = byte & 0xFF
    return (b ^ _rotl8(b, 1) ^ _rotl8(b, 2) ^ _rotl8(b, 3) ^ _rotl8(b, 4) ^ AFFINE_C) & 0xFF


def inverse_affine_transform(byte: int) -> int:
    """Inverse AES affine map over GF(2)."""
    b = byte & 0xFF
    return (_rotl8(b, 1) ^ _rotl8(b, 3) ^ _rotl8(b, 6) ^ INV_AFFINE_C) & 0xFF


def sbox_value(byte: int) -> int:
    return affine_transform(gf_inv(byte))


def inv_sbox_value(byte: int) -> int:
    return gf_inv(inverse_affine_transform(byte))


def generate_sbox() -> list[int]:
    return [sbox_value(i) for i in range(256)]


def generate_inv_sbox() -> list[int]:
    return [inv_sbox_value(i) for i in range(256)]


SBOX: list[int] = generate_sbox()
INV_SBOX: list[int] = generate_inv_sbox()


def sub_byte(byte: int) -> int:
    return SBOX[byte & 0xFF]


def inv_sub_byte(byte: int) -> int:
    return INV_SBOX[byte & 0xFF]
