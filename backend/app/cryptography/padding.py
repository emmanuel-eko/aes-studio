"""PKCS#7 padding for AES-CBC (block size 16).

CTR and GCM must not use this module for the payload.
"""

from __future__ import annotations

from app.cryptography.utils import BLOCK_SIZE


def pkcs7_pad(data: bytes, block_size: int = BLOCK_SIZE) -> bytes:
    if block_size < 1 or block_size > 255:
        raise ValueError("Unsupported PKCS#7 block size")
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len] * pad_len)


def pkcs7_unpad(data: bytes, block_size: int = BLOCK_SIZE) -> bytes:
    if not data or len(data) % block_size != 0:
        raise ValueError("Padded data length is not a multiple of the block size")
    pad_len = data[-1]
    if pad_len < 1 or pad_len > block_size:
        raise ValueError("Invalid PKCS#7 padding")
    if data[-pad_len:] != bytes([pad_len] * pad_len):
        raise ValueError("Invalid PKCS#7 padding")
    return data[:-pad_len]
