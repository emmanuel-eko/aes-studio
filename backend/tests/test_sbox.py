"""S-Box generation versus FIPS 197 Table 5 / Table 6."""

from app.cryptography.sbox import INV_SBOX, SBOX, inv_sbox_value, sbox_value


def test_sbox_known_entries() -> None:
    assert SBOX[0x00] == 0x63
    assert SBOX[0x01] == 0x7C
    assert SBOX[0x53] == 0xED
    assert SBOX[0xFF] == 0x16


def test_inv_sbox_known_entries() -> None:
    assert INV_SBOX[0x63] == 0x00
    assert INV_SBOX[0x7C] == 0x01
    assert INV_SBOX[0x16] == 0xFF


def test_sbox_is_permutation() -> None:
    assert sorted(SBOX) == list(range(256))
    assert sorted(INV_SBOX) == list(range(256))


def test_sbox_roundtrip() -> None:
    for value in range(256):
        assert inv_sbox_value(sbox_value(value)) == value
        assert INV_SBOX[SBOX[value]] == value
