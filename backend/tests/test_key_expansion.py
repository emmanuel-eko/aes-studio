"""Key expansion versus FIPS 197 Appendix A.1 (AES-128)."""

from app.cryptography.key_expansion import expand_key

CIPHER_KEY = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")

# FIPS 197 Appendix A.1 — 11 round keys
ROUND_KEYS = [
    "2b7e151628aed2a6abf7158809cf4f3c",
    "a0fafe1788542cb123a339392a6c7605",
    "f2c295f27a96b9435935807a7359f67f",
    "3d80477d4716fe3e1e237e446d7a883b",
    "ef44a541a8525b7fb671253bdb0bad00",
    "d4d1c6f87c839d87caf2b8bc11f915bc",
    "6d88a37a110b3efddbf98641ca0093fd",
    "4e54f70e5f5fc9f384a64fb24ea6dc4f",
    "ead27321b58dbad2312bf5607f8d292f",
    "ac7766f319fadc2128d12941575c006e",
    "d014f9a8c9ee2589e13f0cc8b6630ca6",
]


def test_fips197_appendix_a1() -> None:
    keys = expand_key(CIPHER_KEY)
    assert len(keys) == 11
    assert [k.hex() for k in keys] == ROUND_KEYS
