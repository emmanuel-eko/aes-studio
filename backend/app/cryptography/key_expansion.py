"""AES-128 key expansion (Nk=4, Nr=10, Nb=4).

Produces 11 round keys of 16 bytes (44 words) from a 16-byte cipher key.
"""

from __future__ import annotations

from app.cryptography.gf256 import rcon_byte
from app.cryptography.sbox import sub_byte
from app.cryptography.traces import TraceCollector
from app.cryptography.utils import KEY_SIZE, require_bytes, to_hex


NK = 4
NB = 4
NR = 10
WORD_COUNT = NB * (NR + 1)


def rot_word(word: bytes) -> bytes:
    if len(word) != 4:
        raise ValueError("RotWord expects a 4-byte word")
    return word[1:] + word[:1]


def sub_word(word: bytes) -> bytes:
    if len(word) != 4:
        raise ValueError("SubWord expects a 4-byte word")
    return bytes(sub_byte(b) for b in word)


def expand_key(key: bytes, trace: TraceCollector | None = None) -> list[bytes]:
    """Return the 11 AES-128 round keys as 16-byte blocks."""
    key = require_bytes("key", key, KEY_SIZE)
    words: list[bytes] = [key[i : i + 4] for i in range(0, KEY_SIZE, 4)]

    if trace is not None:
        trace.add(
            operation="KeyExpansion.input",
            title="Clé de chiffrement",
            explanation=(
                "AES-128 part d'une clé de 16 octets (4 mots). "
                "L'expansion fabrique 44 mots, soit 11 clés de tour."
            ),
            code_ref="key_expansion.py:expand_key",
            phase="key_expansion",
            intermediates={"key_hex": to_hex(key), "words": [to_hex(w) for w in words]},
            glossary=["aes", "key-expansion"],
        )

    for i in range(NK, WORD_COUNT):
        temp = words[i - 1]
        used_rot = False
        rcon_hex = None
        before_xor = temp
        if i % NK == 0:
            rotated = rot_word(temp)
            substituted = sub_word(rotated)
            rcon = bytes([rcon_byte(i // NK), 0, 0, 0])
            temp = bytes(a ^ b for a, b in zip(substituted, rcon))
            used_rot = True
            rcon_hex = to_hex(rcon)
            before_xor = temp
        word = bytes(a ^ b for a, b in zip(words[i - NK], temp))
        words.append(word)
        if trace is not None and used_rot and i == NK:
            trace.add(
                operation="KeyExpansion.core",
                title="Premier mot dérivé — RotWord, SubWord, Rcon",
                explanation=(
                    "Le premier tour d'expansion suffit à voir le mécanisme : "
                    "RotWord, SubWord, XOR avec Rcon, puis XOR avec w[i-4]. "
                    "Les mots suivants sont calculés mais non détaillés."
                ),
                code_ref="key_expansion.py:expand_key",
                phase="key_expansion",
                intermediates={
                    "i": i,
                    "rot_word": to_hex(rot_word(words[i - 1])),
                    "sub_word": to_hex(sub_word(rot_word(words[i - 1]))),
                    "rcon": rcon_hex,
                    "temp_after_rcon": to_hex(before_xor),
                    "w_im4": to_hex(words[i - NK]),
                    "w_i": to_hex(word),
                },
                glossary=["key-expansion", "sbox"],
            )

    round_keys = [b"".join(words[4 * r : 4 * r + 4]) for r in range(NR + 1)]
    if trace is not None:
        trace.add(
            operation="KeyExpansion.schedule",
            title="Planning des clés de tour",
            explanation="Les 44 mots sont regroupés en 11 clés de 16 octets, une par AddRoundKey.",
            code_ref="key_expansion.py:expand_key",
            phase="key_expansion",
            intermediates={
                "round_keys": [to_hex(rk) for rk in round_keys],
            },
            glossary=["key-expansion", "addroundkey"],
        )
    return round_keys
