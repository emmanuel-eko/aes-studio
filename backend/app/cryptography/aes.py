"""AES-128 block cipher: 10 rounds, 128-bit key, 128-bit block.

Transformations follow FIPS 197. Inverse transforms are implemented
explicitly for decryption (InvSubBytes, InvShiftRows, InvMixColumns).
"""

from __future__ import annotations

from app.cryptography.gf256 import gf_mul
from app.cryptography.key_expansion import NR, expand_key
from app.cryptography.sbox import inv_sub_byte, sub_byte
from app.cryptography.traces import TraceCollector
from app.cryptography.utils import (
    BLOCK_SIZE,
    bytes_to_state,
    clone_state,
    require_bytes,
    state_to_bytes,
    state_to_hex,
    to_hex,
)


def sub_bytes(state: list[list[int]]) -> list[list[int]]:
    return [[sub_byte(byte) for byte in row] for row in state]


def inv_sub_bytes(state: list[list[int]]) -> list[list[int]]:
    return [[inv_sub_byte(byte) for byte in row] for row in state]


def shift_rows(state: list[list[int]]) -> list[list[int]]:
    return [
        state[0][:],
        state[1][1:] + state[1][:1],
        state[2][2:] + state[2][:2],
        state[3][3:] + state[3][:3],
    ]


def inv_shift_rows(state: list[list[int]]) -> list[list[int]]:
    return [
        state[0][:],
        state[1][-1:] + state[1][:-1],
        state[2][-2:] + state[2][:-2],
        state[3][-3:] + state[3][:-3],
    ]


def _mix_column(column: list[int]) -> list[int]:
    a0, a1, a2, a3 = column
    return [
        gf_mul(a0, 2) ^ gf_mul(a1, 3) ^ a2 ^ a3,
        a0 ^ gf_mul(a1, 2) ^ gf_mul(a2, 3) ^ a3,
        a0 ^ a1 ^ gf_mul(a2, 2) ^ gf_mul(a3, 3),
        gf_mul(a0, 3) ^ a1 ^ a2 ^ gf_mul(a3, 2),
    ]


def _inv_mix_column(column: list[int]) -> list[int]:
    a0, a1, a2, a3 = column
    return [
        gf_mul(a0, 0x0E) ^ gf_mul(a1, 0x0B) ^ gf_mul(a2, 0x0D) ^ gf_mul(a3, 0x09),
        gf_mul(a0, 0x09) ^ gf_mul(a1, 0x0E) ^ gf_mul(a2, 0x0B) ^ gf_mul(a3, 0x0D),
        gf_mul(a0, 0x0D) ^ gf_mul(a1, 0x09) ^ gf_mul(a2, 0x0E) ^ gf_mul(a3, 0x0B),
        gf_mul(a0, 0x0B) ^ gf_mul(a1, 0x0D) ^ gf_mul(a2, 0x09) ^ gf_mul(a3, 0x0E),
    ]


def mix_columns(state: list[list[int]]) -> list[list[int]]:
    mixed = clone_state(state)
    for col in range(4):
        column = [state[row][col] for row in range(4)]
        result = _mix_column(column)
        for row in range(4):
            mixed[row][col] = result[row]
    return mixed


def inv_mix_columns(state: list[list[int]]) -> list[list[int]]:
    mixed = clone_state(state)
    for col in range(4):
        column = [state[row][col] for row in range(4)]
        result = _inv_mix_column(column)
        for row in range(4):
            mixed[row][col] = result[row]
    return mixed


def add_round_key(state: list[list[int]], round_key: bytes) -> list[list[int]]:
    key_state = bytes_to_state(require_bytes("round_key", round_key, BLOCK_SIZE))
    return [[state[r][c] ^ key_state[r][c] for c in range(4)] for r in range(4)]


def _trace_round(block_index: int | None, round_number: int | None) -> bool:
    """Expand every round of the first block so the studio can animate them.

    Later blocks stay summarized by the mode (CBC, CTR, GCM). ``round_number``
    is accepted for every round of AES-128 (0 through Nr).
    """
    if block_index not in (None, 0):
        return False
    if round_number is None:
        return True
    return 0 <= round_number <= NR


def _record(
    trace: TraceCollector | None,
    *,
    operation: str,
    title: str,
    explanation: str,
    code_ref: str,
    phase: str,
    before: list[list[int]],
    after: list[list[int]],
    round_number: int | None,
    block_index: int | None,
    intermediates: dict | None = None,
    glossary: list[str] | None = None,
) -> None:
    if trace is None or not _trace_round(block_index, round_number):
        return
    payload = intermediates or {}
    payload = {
        **payload,
        "before_hex": to_hex(state_to_bytes(before)),
        "after_hex": to_hex(state_to_bytes(after)),
    }
    trace.add(
        operation=operation,
        title=title,
        explanation=explanation,
        code_ref=code_ref,
        phase=phase,
        round_number=round_number,
        block_index=block_index,
        state_before=state_to_hex(before),
        state_after=state_to_hex(after),
        intermediates=payload,
        glossary=glossary or [],
    )


def encrypt_block(
    block: bytes,
    key: bytes,
    trace: TraceCollector | None = None,
    *,
    phase: str = "encrypt",
    block_index: int | None = None,
    expand: bool = True,
    round_keys: list[bytes] | None = None,
) -> bytes:
    """Encrypt a single 16-byte block with AES-128."""
    block = require_bytes("block", block, BLOCK_SIZE)
    if round_keys is None:
        if not expand:
            raise ValueError("round_keys required when expand is False")
        round_keys = expand_key(key, trace if phase == "encrypt" else None)
    elif len(round_keys) != NR + 1:
        raise ValueError("AES-128 expects 11 round keys")

    state = bytes_to_state(block)
    _record(
        trace,
        operation="AES.input",
        title="État initial du bloc",
        explanation="Le bloc de 16 octets est écrit en colonne dans la matrice 4×4 d'AES.",
        code_ref="aes.py:bytes_to_state",
        phase=phase,
        before=state,
        after=state,
        round_number=0,
        block_index=block_index,
        glossary=["aes", "block-cipher"],
    )

    before = state
    state = add_round_key(state, round_keys[0])
    _record(
        trace,
        operation="AddRoundKey",
        title="Tour 0 — AddRoundKey",
        explanation="XOR de l'état avec la première clé de tour (la clé originale).",
        code_ref="aes.py:add_round_key",
        phase=phase,
        before=before,
        after=state,
        round_number=0,
        block_index=block_index,
        intermediates={"round_key": to_hex(round_keys[0])},
        glossary=["addroundkey", "xor"],
    )

    for rnd in range(1, NR):
        before = state
        state = sub_bytes(state)
        _record(
            trace,
            operation="SubBytes",
            title=f"Tour {rnd} — SubBytes",
            explanation="Chaque octet est remplacé par l'entrée correspondante de la S-Box.",
            code_ref="aes.py:sub_bytes",
            phase=phase,
            before=before,
            after=state,
            round_number=rnd,
            block_index=block_index,
            glossary=["subbytes", "sbox", "gf256"],
        )

        before = state
        state = shift_rows(state)
        _record(
            trace,
            operation="ShiftRows",
            title=f"Tour {rnd} — ShiftRows",
            explanation="La ligne r est tournée de r positions vers la gauche.",
            code_ref="aes.py:shift_rows",
            phase=phase,
            before=before,
            after=state,
            round_number=rnd,
            block_index=block_index,
            glossary=["shiftrows"],
        )

        before = state
        state = mix_columns(state)
        _record(
            trace,
            operation="MixColumns",
            title=f"Tour {rnd} — MixColumns",
            explanation=(
                "Chaque colonne est multipliée, dans GF(2^8), par le polynôme "
                "fixe 03x³ + 01x² + 01x + 02."
            ),
            code_ref="aes.py:mix_columns",
            phase=phase,
            before=before,
            after=state,
            round_number=rnd,
            block_index=block_index,
            glossary=["mixcolumns", "gf256"],
        )

        before = state
        state = add_round_key(state, round_keys[rnd])
        _record(
            trace,
            operation="AddRoundKey",
            title=f"Tour {rnd} — AddRoundKey",
            explanation="XOR de l'état avec la clé de tour courante.",
            code_ref="aes.py:add_round_key",
            phase=phase,
            before=before,
            after=state,
            round_number=rnd,
            block_index=block_index,
            intermediates={"round_key": to_hex(round_keys[rnd])},
            glossary=["addroundkey", "xor"],
        )

    before = state
    state = sub_bytes(state)
    _record(
        trace,
        operation="SubBytes",
        title="Tour 10 — SubBytes",
        explanation="Dernier SubBytes : le dernier tour n'applique pas MixColumns.",
        code_ref="aes.py:sub_bytes",
        phase=phase,
        before=before,
        after=state,
        round_number=NR,
        block_index=block_index,
        glossary=["subbytes", "sbox"],
    )

    before = state
    state = shift_rows(state)
    _record(
        trace,
        operation="ShiftRows",
        title="Tour 10 — ShiftRows",
        explanation="Dernier ShiftRows avant le XOR final avec la clé.",
        code_ref="aes.py:shift_rows",
        phase=phase,
        before=before,
        after=state,
        round_number=NR,
        block_index=block_index,
        glossary=["shiftrows"],
    )

    before = state
    state = add_round_key(state, round_keys[NR])
    _record(
        trace,
        operation="AddRoundKey",
        title="Tour 10 — AddRoundKey",
        explanation="XOR final : le bloc chiffré est l'état après la dernière clé de tour.",
        code_ref="aes.py:add_round_key",
        phase=phase,
        before=before,
        after=state,
        round_number=NR,
        block_index=block_index,
        intermediates={"round_key": to_hex(round_keys[NR])},
        glossary=["addroundkey"],
    )
    return state_to_bytes(state)


def decrypt_block(
    block: bytes,
    key: bytes,
    trace: TraceCollector | None = None,
    *,
    phase: str = "decrypt",
    block_index: int | None = None,
    round_keys: list[bytes] | None = None,
    detail_rounds: bool = False,
) -> bytes:
    """Decrypt a single 16-byte block with AES-128.

    ``detail_rounds`` records every inverse step (used by AES without a mode).
    Modes keep a short summary so their own story stays readable.
    """
    block = require_bytes("block", block, BLOCK_SIZE)
    if round_keys is None:
        round_keys = expand_key(key)
    elif len(round_keys) != NR + 1:
        raise ValueError("AES-128 expects 11 round keys")

    state = bytes_to_state(block)
    start = clone_state(state)

    def note(
        operation: str,
        title: str,
        explanation: str,
        before: list[list[int]],
        after: list[list[int]],
        rnd: int,
        glossary: list[str],
        intermediates: dict | None = None,
    ) -> None:
        if not detail_rounds:
            return
        _record(
            trace,
            operation=operation,
            title=title,
            explanation=explanation,
            code_ref="aes.py:decrypt_block",
            phase=phase,
            before=before,
            after=after,
            round_number=rnd,
            block_index=block_index,
            intermediates=intermediates,
            glossary=glossary,
        )

    if detail_rounds:
        note(
            "AES.input",
            "État chiffré du bloc",
            "Le déchiffrement rejoue les tours à l'envers, en commençant par la dernière clé.",
            state,
            state,
            NR,
            ["aes", "block-cipher"],
        )
    elif trace is not None and block_index in (None, 0):
        _record(
            trace,
            operation="AES.input",
            title="État chiffré du bloc",
            explanation=(
                "Le déchiffrement applique les dix tours inverses. "
                "Seule l'arrivée et le résultat sont visualisés ici."
            ),
            code_ref="aes.py:decrypt_block",
            phase=phase,
            before=state,
            after=state,
            round_number=0,
            block_index=block_index,
            glossary=["aes", "block-cipher"],
        )

    before = state
    state = add_round_key(state, round_keys[NR])
    note(
        "AddRoundKey",
        "Tour 10 — AddRoundKey",
        "Le déchiffrement commence par le XOR avec la dernière clé de tour.",
        before,
        state,
        NR,
        ["addroundkey", "xor"],
        {"round_key": to_hex(round_keys[NR])},
    )

    before = state
    state = inv_shift_rows(state)
    note(
        "InvShiftRows",
        "Tour 10 — InvShiftRows",
        "La ligne r est tournée de r positions vers la droite, pour annuler ShiftRows.",
        before,
        state,
        NR,
        ["shiftrows"],
    )

    before = state
    state = inv_sub_bytes(state)
    note(
        "InvSubBytes",
        "Tour 10 — InvSubBytes",
        "Chaque octet passe par la S-box inverse.",
        before,
        state,
        NR,
        ["subbytes", "sbox"],
    )

    for rnd in range(NR - 1, 0, -1):
        before = state
        state = add_round_key(state, round_keys[rnd])
        note(
            "AddRoundKey",
            f"Tour {rnd} — AddRoundKey",
            "XOR avec la clé de ce tour, avant d'inverser MixColumns.",
            before,
            state,
            rnd,
            ["addroundkey", "xor"],
            {"round_key": to_hex(round_keys[rnd])},
        )

        before = state
        state = inv_mix_columns(state)
        note(
            "InvMixColumns",
            f"Tour {rnd} — InvMixColumns",
            "Chaque colonne est multipliée par la matrice inverse de MixColumns.",
            before,
            state,
            rnd,
            ["mixcolumns", "gf256"],
        )

        before = state
        state = inv_shift_rows(state)
        note(
            "InvShiftRows",
            f"Tour {rnd} — InvShiftRows",
            "La ligne r revient de r positions vers la droite.",
            before,
            state,
            rnd,
            ["shiftrows"],
        )

        before = state
        state = inv_sub_bytes(state)
        note(
            "InvSubBytes",
            f"Tour {rnd} — InvSubBytes",
            "Chaque octet passe par la S-box inverse.",
            before,
            state,
            rnd,
            ["subbytes", "sbox"],
        )

    before = state
    state = add_round_key(state, round_keys[0])
    note(
        "AddRoundKey",
        "Tour 0 — AddRoundKey",
        "Dernier XOR avec la clé originale : l'état redevient le bloc clair.",
        before,
        state,
        0,
        ["addroundkey", "xor"],
        {"round_key": to_hex(round_keys[0])},
    )
    if not detail_rounds and trace is not None and block_index in (None, 0):
        trace.add(
            operation="AES.decrypt_summary",
            title="Déchiffrement AES — résultat",
            explanation=(
                "Les tours inverses 10 à 0 ont été calculés. "
                "La simulation détaillée ne reprend que le premier tour du chiffrement."
            ),
            code_ref="aes.py:decrypt_block",
            phase=phase,
            round_number=0,
            block_index=block_index,
            state_before=state_to_hex(start),
            state_after=state_to_hex(state),
            intermediates={
                "before_hex": to_hex(state_to_bytes(start)),
                "after_hex": to_hex(state_to_bytes(state)),
            },
            glossary=["aes"],
        )
    return state_to_bytes(state)
