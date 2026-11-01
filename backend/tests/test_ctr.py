"""AES-CTR versus NIST SP 800-38A F.5.1."""

from app.cryptography.ctr import ctr_crypt, increment_counter

KEY = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")
COUNTER0 = bytes.fromhex("f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff")
NIST_PT = bytes.fromhex(
    "6bc1bee22e409f96e93d7e117393172a"
    "ae2d8a571e03ac9c9eb76fac45af8e51"
    "30c81c46a35ce411e5fbc1191a0a52ef"
    "f69f2445df4f9b17ad2b417be66c3710"
)
NIST_CT = bytes.fromhex(
    "874d6191b620e3261bef6864990db6ce"
    "9806f66b7970fdff8617187bb9fffdff"
    "5ae4df3edbd5d35e5b4f09020db03eab"
    "1e031dda2fbe03d1792170a0f3009cee"
)


def test_nist_sp800_38a_f51() -> None:
    assert ctr_crypt(NIST_PT, KEY, COUNTER0) == NIST_CT


def test_ctr_decrypt_is_same_function() -> None:
    assert ctr_crypt(NIST_CT, KEY, COUNTER0) == NIST_PT


def test_ctr_empty() -> None:
    assert ctr_crypt(b"", KEY, COUNTER0) == b""


def test_ctr_partial_block() -> None:
    message = b"hello"
    cipher = ctr_crypt(message, KEY, COUNTER0)
    assert len(cipher) == 5
    assert ctr_crypt(cipher, KEY, COUNTER0) == message


def test_ctr_bit_flip_is_local() -> None:
    message = b"0123456789abcdefHELLO"
    cipher = bytearray(ctr_crypt(message, KEY, COUNTER0))
    cipher[0] ^= 0x01
    recovered = ctr_crypt(bytes(cipher), KEY, COUNTER0)
    assert recovered[0] == message[0] ^ 0x01
    assert recovered[1:] == message[1:]


def test_increment_wraps_128_bit() -> None:
    assert increment_counter(b"\xff" * 16) == b"\x00" * 16
