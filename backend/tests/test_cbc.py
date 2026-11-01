"""AES-CBC versus NIST SP 800-38A F.2.1 / F.2.2."""

import pytest

from app.cryptography.cbc import cbc_decrypt, cbc_encrypt
from app.cryptography.padding import pkcs7_pad

KEY = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")
IV = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
# Four exact blocks — NIST vector has no PKCS#7; we encrypt the raw 64 bytes
# by feeding already-aligned data and comparing the first 64 ciphertext bytes
# after padding an extra block, or we encrypt without going through pad by
# testing the NIST blocks via a helper that pads then strips the extra block.

NIST_PT = bytes.fromhex(
    "6bc1bee22e409f96e93d7e117393172a"
    "ae2d8a571e03ac9c9eb76fac45af8e51"
    "30c81c46a35ce411e5fbc1191a0a52ef"
    "f69f2445df4f9b17ad2b417be66c3710"
)
NIST_CT = bytes.fromhex(
    "7649abac8119b246cee98e9b12e9197d"
    "5086cb9b507219ee95db113a917678b2"
    "73bed6b8e3c1743b7116e69e22229516"
    "3ff1caa1681fac09120eca307586e1a7"
)


def test_nist_sp800_38a_f21_raw_blocks() -> None:
    """Encrypt the NIST 64-byte plaintext; ignore the extra PKCS#7 block."""
    padded = pkcs7_pad(NIST_PT)
    assert padded[:64] == NIST_PT
    ciphertext = cbc_encrypt(NIST_PT, KEY, IV)
    assert ciphertext[:64] == NIST_CT
    assert len(ciphertext) == 80


def test_cbc_roundtrip_nist_payload() -> None:
    ciphertext = cbc_encrypt(NIST_PT, KEY, IV)
    assert cbc_decrypt(ciphertext, KEY, IV) == NIST_PT


def test_cbc_empty_message() -> None:
    ciphertext = cbc_encrypt(b"", KEY, IV)
    assert len(ciphertext) == 16
    assert cbc_decrypt(ciphertext, KEY, IV) == b""


def test_cbc_short_message() -> None:
    message = "Alice → Bob".encode("utf-8")
    assert cbc_decrypt(cbc_encrypt(message, KEY, IV), KEY, IV) == message


def test_cbc_tamper_changes_plaintext() -> None:
    # Two full blocks plus padding: flipping C0 garbles P0 and flips bits in P1.
    # The padding block is unchanged, so unpadding still succeeds.
    message = b"aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb"
    ciphertext = bytearray(cbc_encrypt(message, KEY, IV))
    ciphertext[0] ^= 0x01
    recovered = cbc_decrypt(bytes(ciphertext), KEY, IV)
    assert recovered != message
    assert recovered[16:] != message[16:] or recovered[:16] != message[:16]


def test_cbc_relaxed_decrypt_after_broken_padding() -> None:
    ciphertext = bytearray(cbc_encrypt(b"hello", KEY, IV))
    ciphertext[-1] ^= 0x01
    recovered = cbc_decrypt(bytes(ciphertext), KEY, IV, strict=False)
    assert recovered
    try:
        cbc_decrypt(bytes(ciphertext), KEY, IV, strict=True)
        raise AssertionError("strict mode should fail")
    except ValueError:
        pass


def test_cbc_wrong_length() -> None:
    with pytest.raises(ValueError):
        cbc_decrypt(b"short", KEY, IV)


def test_align_cbc_ciphertext() -> None:
    from app.cryptography.utils import align_cbc_ciphertext

    aligned, extra = align_cbc_ciphertext(b"\x01" * 16)
    assert extra == 0
    assert aligned == b"\x01" * 16
    padded, extra = align_cbc_ciphertext(b"\xaa\xbb")
    assert extra == 14
    assert len(padded) == 16
    assert padded[:2] == b"\xaa\xbb"
    empty, extra = align_cbc_ciphertext(b"")
    assert extra == 16
    assert empty == b"\x00" * 16
