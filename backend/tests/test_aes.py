"""AES-128 block cipher versus FIPS 197 test vectors."""

from app.cryptography.aes import (
    add_round_key,
    decrypt_block,
    encrypt_block,
    inv_mix_columns,
    inv_shift_rows,
    inv_sub_bytes,
    mix_columns,
    shift_rows,
    sub_bytes,
)
from app.cryptography.utils import bytes_to_state, state_to_bytes


# FIPS 197 Appendix B
APPENDIX_B_KEY = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")
APPENDIX_B_PT = bytes.fromhex("3243f6a8885a308d313198a2e0370734")
APPENDIX_B_CT = bytes.fromhex("3925841d02dc09fbdc118597196a0b32")

# FIPS 197 Appendix C.1
APPENDIX_C_KEY = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
APPENDIX_C_PT = bytes.fromhex("00112233445566778899aabbccddeeff")
APPENDIX_C_CT = bytes.fromhex("69c4e0d86a7b0430d8cdb78070b4c55a")


def test_encrypt_appendix_b() -> None:
    assert encrypt_block(APPENDIX_B_PT, APPENDIX_B_KEY) == APPENDIX_B_CT


def test_decrypt_appendix_b() -> None:
    assert decrypt_block(APPENDIX_B_CT, APPENDIX_B_KEY) == APPENDIX_B_PT


def test_encrypt_appendix_c1() -> None:
    assert encrypt_block(APPENDIX_C_PT, APPENDIX_C_KEY) == APPENDIX_C_CT


def test_decrypt_appendix_c1() -> None:
    assert decrypt_block(APPENDIX_C_CT, APPENDIX_C_KEY) == APPENDIX_C_PT


def test_roundtrip_random_like() -> None:
    key = bytes(range(16))
    block = bytes(range(16, 32))
    assert decrypt_block(encrypt_block(block, key), key) == block


def test_inverse_transforms() -> None:
    state = bytes_to_state(bytes(range(16)))
    assert inv_sub_bytes(sub_bytes(state)) == state
    assert inv_shift_rows(shift_rows(state)) == state
    assert inv_mix_columns(mix_columns(state)) == state
    key = bytes(range(16))
    assert add_round_key(add_round_key(state, key), key) == state


def test_trace_covers_every_round() -> None:
    from app.cryptography.traces import TraceCollector

    trace = TraceCollector()
    encrypt_block(APPENDIX_C_PT, APPENDIX_C_KEY, trace)
    titles = [step["title"] for step in trace.steps]
    assert any(title.startswith("Tour 1 — SubBytes") for title in titles)
    assert any(title.startswith("Tour 5 — MixColumns") for title in titles)
    assert any(title.startswith("Tour 5 — ShiftRows") for title in titles)
    assert any(title.startswith("Tour 10 — SubBytes") for title in titles)
    assert any(title.startswith("Tour 10 — AddRoundKey") for title in titles)
    assert not any(title.startswith("Tour 10 — MixColumns") for title in titles)
    assert not any("non détaillés" in title for title in titles)
    final = [
        step
        for step in trace.steps
        if step["operation"] == "AddRoundKey" and step["round_number"] == 10
    ][-1]
    assert final["intermediates"]["after_hex"] == APPENDIX_C_CT.hex()
    assert final["state_after"][0][0] == "69"


def test_state_layout_column_major() -> None:
    block = bytes(range(16))
    state = bytes_to_state(block)
    assert state[0][0] == 0x00
    assert state[1][0] == 0x01
    assert state[0][1] == 0x04
    assert state_to_bytes(state) == block
