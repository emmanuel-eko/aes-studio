"""Homegrown AES-128 pedagogical engine.

This package implements AES-128 and the CBC, CTR and GCM modes without
calling an external AES primitive. It is intended for teaching, not for
protecting production data.
"""

from app.cryptography.aes import decrypt_block, encrypt_block
from app.cryptography.cbc import cbc_decrypt, cbc_encrypt
from app.cryptography.ctr import ctr_crypt
from app.cryptography.gcm import gcm_decrypt, gcm_encrypt
from app.cryptography.key_expansion import expand_key
from app.cryptography.sbox import INV_SBOX, SBOX

__all__ = [
    "SBOX",
    "INV_SBOX",
    "expand_key",
    "encrypt_block",
    "decrypt_block",
    "cbc_encrypt",
    "cbc_decrypt",
    "ctr_crypt",
    "gcm_encrypt",
    "gcm_decrypt",
]
