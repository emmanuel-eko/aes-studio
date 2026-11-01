"""GHASH field arithmetic sanity checks."""

from app.cryptography.ghash import gf128_mul, ghash


def test_mul_by_zero() -> None:
    x = bytes.fromhex("66e94bd4ef8a2c3b884cfa59ca342b2e")
    assert gf128_mul(x, bytes(16)) == bytes(16)
    assert gf128_mul(bytes(16), x) == bytes(16)


def test_mul_by_one() -> None:
    one = (1).to_bytes(16, "big")
    x = bytes.fromhex("80000000000000000000000000000000")
    # 1 as integer is the rightmost bit — not the field '1' in NIST bit order.
    # Field element with only the MSB set is x^0 in NIST's bit-serial convention.
    field_one = bytes.fromhex("80000000000000000000000000000000")
    y = bytes.fromhex("0123456789abcdef0123456789abcdef")
    assert gf128_mul(field_one, y) == y
    assert gf128_mul(y, field_one) == y
    assert one != field_one or x == field_one


def test_ghash_length_block_only() -> None:
    h = bytes.fromhex("66e94bd4ef8a2c3b884cfa59ca342b2e")
    result = ghash(h, b"", b"")
    assert result == bytes(16)
