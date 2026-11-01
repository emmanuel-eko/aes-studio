from app.cryptography.padding import pkcs7_pad, pkcs7_unpad


def test_empty_message_becomes_full_block() -> None:
    padded = pkcs7_pad(b"")
    assert padded == bytes([16] * 16)
    assert pkcs7_unpad(padded) == b""


def test_aligned_message_adds_full_block() -> None:
    data = b"A" * 16
    padded = pkcs7_pad(data)
    assert len(padded) == 32
    assert padded[-16:] == bytes([16] * 16)
    assert pkcs7_unpad(padded) == data


def test_partial_block() -> None:
    data = b"hello"
    padded = pkcs7_pad(data)
    assert padded[-1] == 11
    assert pkcs7_unpad(padded) == data


def test_invalid_padding() -> None:
    try:
        pkcs7_unpad(b"\x00" * 16)
        raise AssertionError("expected failure")
    except ValueError:
        pass
