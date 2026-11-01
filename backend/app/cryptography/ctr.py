"""AES-128-CTR.

The counter blocks are encrypted with AES; the resulting keystream is XOR-ed
with the plaintext. Encryption and decryption are the same operation.
No PKCS#7 padding is applied.
"""

from __future__ import annotations

from app.cryptography.aes import encrypt_block
from app.cryptography.key_expansion import expand_key
from app.cryptography.traces import TraceCollector
from app.cryptography.utils import (
    BLOCK_SIZE,
    bytes_to_state,
    require_bytes,
    state_to_hex,
    to_hex,
    xor_bytes,
)


def increment_counter(counter: bytes) -> bytes:
    """Increment the full 128-bit counter (big-endian)."""
    counter = require_bytes("counter", counter, BLOCK_SIZE)
    value = int.from_bytes(counter, "big") + 1
    return (value % (1 << 128)).to_bytes(BLOCK_SIZE, "big")


def _keystream_block(
    counter: bytes,
    key: bytes,
    round_keys: list[bytes],
    trace: TraceCollector | None,
    index: int,
    phase: str,
) -> bytes:
    if trace is not None:
        trace.add(
            operation="CTR.counter",
            title=f"Bloc {index} — compteur",
            explanation="Le compteur est un bloc de 16 octets. AES le chiffre pour produire 16 octets de flux.",
            code_ref="ctr.py:increment_counter",
            phase=phase,
            block_index=index,
            state_before=state_to_hex(bytes_to_state(counter)),
            state_after=state_to_hex(bytes_to_state(counter)),
            intermediates={"counter": to_hex(counter)},
            glossary=["ctr", "nonce"],
        )
    keystream = encrypt_block(
        counter,
        key,
        trace,
        phase="encrypt",
        block_index=index,
        expand=False,
        round_keys=round_keys,
    )
    if trace is not None:
        trace.add(
            operation="CTR.keystream",
            title=f"Bloc {index} — flux de clés",
            explanation="Le flux est indépendant du message : les blocs CTR peuvent être calculés en parallèle.",
            code_ref="ctr.py:ctr_crypt",
            phase=phase,
            block_index=index,
            state_before=state_to_hex(bytes_to_state(counter)),
            state_after=state_to_hex(bytes_to_state(keystream)),
            intermediates={"keystream": to_hex(keystream)},
            glossary=["ctr"],
        )
    return keystream


def ctr_crypt(
    data: bytes,
    key: bytes,
    counter0: bytes,
    trace: TraceCollector | None = None,
    *,
    phase: str = "mode_ctr",
) -> bytes:
    """Encrypt or decrypt with AES-CTR (same function)."""
    key = require_bytes("key", key, BLOCK_SIZE)
    counter = require_bytes("counter", counter0, BLOCK_SIZE)
    data = require_bytes("data", data)
    round_keys = expand_key(key, trace)

    if trace is not None:
        trace.add(
            operation="CTR.start",
            title="Initialisation du compteur",
            explanation=(
                "CTR ne remplit pas le message. Le dernier bloc incomplet est simplement "
                "XOR-é avec le préfixe du flux. Chiffrement et déchiffrement sont identiques."
            ),
            code_ref="ctr.py:ctr_crypt",
            phase=phase,
            intermediates={
                "counter0": to_hex(counter),
                "length": len(data),
            },
            glossary=["ctr", "nonce", "mode"],
        )

    output = bytearray()
    offset = 0
    index = 0
    while offset < len(data):
        chunk = data[offset : offset + BLOCK_SIZE]
        keystream = _keystream_block(counter, key, round_keys, trace, index, phase)
        used = keystream[: len(chunk)]
        mixed = xor_bytes(chunk, used)
        if trace is not None:
            trace.add(
                operation="CTR.xor",
                title=f"Bloc {index} — XOR avec le flux",
                explanation=(
                    "Le XOR mélange le clair (ou le chiffré) et le flux. "
                    "Inverser un bit du chiffré inverse le même bit du clair : "
                    "CTR n'authentifie pas."
                ),
                code_ref="ctr.py:ctr_crypt",
                phase=phase,
                block_index=index,
                intermediates={
                    "input": to_hex(chunk),
                    "keystream": to_hex(used),
                    "output": to_hex(mixed),
                    "truncated": len(chunk) < BLOCK_SIZE,
                },
                glossary=["xor", "ctr", "ciphertext-tampering"],
            )
        output.extend(mixed)
        counter = increment_counter(counter)
        offset += BLOCK_SIZE
        index += 1
    return bytes(output)
