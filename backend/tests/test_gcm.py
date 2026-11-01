"""AES-GCM versus NIST SP 800-38D test cases (96-bit IVs)."""

import pytest

from app.cryptography.aes import encrypt_block
from app.cryptography.gcm import AuthenticationError, gcm_decrypt, gcm_encrypt
from app.cryptography.ghash import ghash


# Test Case 1
TC1_KEY = bytes.fromhex("00000000000000000000000000000000")
TC1_IV = bytes.fromhex("000000000000000000000000")
TC1_TAG = bytes.fromhex("58e2fccefa7e3061367f1d57a4e7455a")

# Test Case 2
TC2_PT = bytes.fromhex("00000000000000000000000000000000")
TC2_CT = bytes.fromhex("0388dace60b6a392f328c2b971b2fe78")
TC2_TAG = bytes.fromhex("ab6e47d42cec13bdf53a67b21257bddf")

# Test Case 3
TC3_KEY = bytes.fromhex("feffe9928665731c6d6a8f9467308308")
TC3_IV = bytes.fromhex("cafebabefacedbaddecaf888")
TC3_PT = bytes.fromhex(
    "d9313225f88406e5a55909c5aff5269a"
    "86a7a9531534f7da2e4c303d8a318a72"
    "1c3c0c95956809532fcf0e2449a6b525"
    "b16aedf5aa0de657ba637b391aafd255"
)
TC3_CT = bytes.fromhex(
    "42831ec2217774244b7221b784d0d49c"
    "e3aa212f2c02a4e035c17e2329aca12e"
    "21d514b25466931c7d8f6a5aac84aa05"
    "1ba30b396a0aac973d58e091473f5985"
)
TC3_TAG = bytes.fromhex("4d5c2af327cd64a62cf35abd2ba6fab4")

# Test Case 4
TC4_AAD = bytes.fromhex("feedfacedeadbeeffeedfacedeadbeefabaddad2")
TC4_PT = bytes.fromhex(
    "d9313225f88406e5a55909c5aff5269a"
    "86a7a9531534f7da2e4c303d8a318a72"
    "1c3c0c95956809532fcf0e2449a6b525"
    "b16aedf5aa0de657ba637b39"
)
TC4_CT = bytes.fromhex(
    "42831ec2217774244b7221b784d0d49c"
    "e3aa212f2c02a4e035c17e2329aca12e"
    "21d514b25466931c7d8f6a5aac84aa05"
    "1ba30b396a0aac973d58e091"
)
TC4_TAG = bytes.fromhex("5bc94fbc3221a5db94fae95ae7121a47")


def test_case1_empty() -> None:
    ct, tag, _ = gcm_encrypt(b"", TC1_KEY, TC1_IV, b"")
    assert ct == b""
    assert tag == TC1_TAG
    assert gcm_decrypt(ct, tag, TC1_KEY, TC1_IV, b"") == b""


def test_case2() -> None:
    ct, tag, _ = gcm_encrypt(TC2_PT, TC1_KEY, TC1_IV, b"")
    assert ct == TC2_CT
    assert tag == TC2_TAG
    assert gcm_decrypt(ct, tag, TC1_KEY, TC1_IV, b"") == TC2_PT


def test_case3() -> None:
    ct, tag, extras = gcm_encrypt(TC3_PT, TC3_KEY, TC3_IV, b"")
    assert ct == TC3_CT
    assert tag == TC3_TAG
    assert extras["H"] == encrypt_block(b"\x00" * 16, TC3_KEY)
    assert gcm_decrypt(ct, tag, TC3_KEY, TC3_IV, b"") == TC3_PT


def test_case4_with_aad() -> None:
    ct, tag, _ = gcm_encrypt(TC4_PT, TC3_KEY, TC3_IV, TC4_AAD)
    assert ct == TC4_CT
    assert tag == TC4_TAG
    assert gcm_decrypt(ct, tag, TC3_KEY, TC3_IV, TC4_AAD) == TC4_PT


def test_wrong_tag_rejected() -> None:
    ct, tag, _ = gcm_encrypt(b"secret", TC1_KEY, TC1_IV, b"")
    bad = bytes([tag[0] ^ 1]) + tag[1:]
    with pytest.raises(AuthenticationError):
        gcm_decrypt(ct, bad, TC1_KEY, TC1_IV, b"")


def test_ciphertext_tamper_rejected() -> None:
    ct, tag, _ = gcm_encrypt(b"secret-message!!", TC1_KEY, TC1_IV, b"meta")
    tampered = bytes([ct[0] ^ 1]) + ct[1:]
    with pytest.raises(AuthenticationError):
        gcm_decrypt(tampered, tag, TC1_KEY, TC1_IV, b"meta")


def test_aad_tamper_rejected() -> None:
    ct, tag, _ = gcm_encrypt(b"secret", TC1_KEY, TC1_IV, b"header")
    with pytest.raises(AuthenticationError):
        gcm_decrypt(ct, tag, TC1_KEY, TC1_IV, b"HEADER")


def test_invalid_nonce_length() -> None:
    with pytest.raises(ValueError):
        gcm_encrypt(b"x", TC1_KEY, b"\x00" * 8, b"")


def test_ghash_zero_inputs() -> None:
    h = encrypt_block(b"\x00" * 16, TC1_KEY)
    assert h.hex() == "66e94bd4ef8a2c3b884cfa59ca342b2e"
    # GHASH of empty AAD and empty C is H * len_block(0||0) = H * 0 = 0
    assert ghash(h, b"", b"") == bytes(16)
