"""Byte, hex, binary and AES-state helpers."""

from __future__ import annotations


BLOCK_SIZE = 16
KEY_SIZE = 16


def require_bytes(name: str, value: bytes, length: int | None = None) -> bytes:
    if not isinstance(value, (bytes, bytearray)):
        raise TypeError(f"{name} must be bytes")
    data = bytes(value)
    if length is not None and len(data) != length:
        raise ValueError(f"{name} must be exactly {length} bytes, got {len(data)}")
    return data


def xor_bytes(left: bytes, right: bytes) -> bytes:
    if len(left) != len(right):
        raise ValueError("XOR operands must have the same length")
    return bytes(a ^ b for a, b in zip(left, right))


def to_hex(data: bytes) -> str:
    return data.hex()


def to_bin(data: bytes) -> str:
    return " ".join(f"{byte:08b}" for byte in data)


def hex_to_bytes(value: str, *, name: str = "value") -> bytes:
    cleaned = value.strip().replace(" ", "").replace(":", "").lower()
    if cleaned.startswith("0x"):
        cleaned = cleaned[2:]
    if any(ch not in "0123456789abcdef" for ch in cleaned):
        raise ValueError(f"{name} is not valid hexadecimal")
    if len(cleaned) % 2 != 0:
        cleaned += "0"
    return bytes.fromhex(cleaned)


def align_cbc_ciphertext(data: bytes) -> tuple[bytes, int]:
    """Pad with 0x00 so CBC can attempt a decrypt after insertions/deletions."""
    if not data:
        return b"\x00" * BLOCK_SIZE, BLOCK_SIZE
    remainder = len(data) % BLOCK_SIZE
    if remainder == 0:
        return data, 0
    extra = BLOCK_SIZE - remainder
    return data + b"\x00" * extra, extra


def bytes_to_state(block: bytes) -> list[list[int]]:
    """Map 16 bytes to the AES 4×4 state (column-major, FIPS 197)."""
    block = require_bytes("block", block, BLOCK_SIZE)
    return [[block[row + 4 * col] for col in range(4)] for row in range(4)]


def state_to_bytes(state: list[list[int]]) -> bytes:
    out = bytearray(BLOCK_SIZE)
    for col in range(4):
        for row in range(4):
            out[row + 4 * col] = state[row][col]
    return bytes(out)


def clone_state(state: list[list[int]]) -> list[list[int]]:
    return [row[:] for row in state]


def state_to_hex(state: list[list[int]]) -> list[list[str]]:
    return [[f"{byte:02x}" for byte in row] for row in state]


def hex_chunks(data: bytes, size: int = 16) -> list[str]:
    return [data[i : i + size].hex() for i in range(0, len(data), size)]


def utf8_bytes(text: str) -> bytes:
    return text.encode("utf-8")


def try_utf8(data: bytes) -> str | None:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def display_text(data: bytes) -> str:
    """Always show what the bytes became: UTF-8 when valid, else every octet."""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return "".join(
            chr(byte) if 32 <= byte <= 126 or byte >= 160 else f"\\x{byte:02x}"
            for byte in data
        )
