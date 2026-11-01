"""AES-128-CBC with PKCS#7 padding.

Each plaintext block is XOR-ed with the previous ciphertext (or the IV)
before AES encryption. Decryption reverses the chain.
"""

from __future__ import annotations

from app.cryptography.aes import decrypt_block, encrypt_block
from app.cryptography.key_expansion import expand_key
from app.cryptography.padding import pkcs7_pad, pkcs7_unpad
from app.cryptography.traces import TraceCollector
from app.cryptography.utils import (
    BLOCK_SIZE,
    bytes_to_state,
    hex_chunks,
    require_bytes,
    state_to_hex,
    to_hex,
    xor_bytes,
)


def cbc_encrypt(
    plaintext: bytes,
    key: bytes,
    iv: bytes,
    trace: TraceCollector | None = None,
) -> bytes:
    key = require_bytes("key", key, BLOCK_SIZE)
    iv = require_bytes("iv", iv, BLOCK_SIZE)
    padded = pkcs7_pad(plaintext)
    round_keys = expand_key(key, trace)

    if trace is not None:
        trace.add(
            operation="CBC.pad",
            title="Découpage et padding PKCS#7",
            explanation=(
                "CBC exige des blocs de 16 octets. PKCS#7 ajoute n octets de valeur n, "
                "y compris un bloc entier si le message est déjà aligné."
            ),
            code_ref="padding.py:pkcs7_pad",
            phase="mode_cbc",
            intermediates={
                "plaintext_hex": to_hex(plaintext),
                "padded_hex": to_hex(padded),
                "pad_len": padded[-1],
                "blocks": hex_chunks(padded),
                "iv": to_hex(iv),
            },
            glossary=["padding", "cbc", "iv", "block-cipher"],
        )

    ciphertext = b""
    previous = iv
    block_count = len(padded) // BLOCK_SIZE
    for index in range(block_count):
        block = padded[index * BLOCK_SIZE : (index + 1) * BLOCK_SIZE]
        xored = xor_bytes(block, previous)
        if trace is not None:
            trace.add(
                operation="CBC.xor",
                title=f"Bloc {index} — XOR avec le chaînon précédent",
                explanation=(
                    "Le bloc clair est XOR-é avec l'IV (premier bloc) ou le chiffré précédent. "
                    "C'est ce chaînage qui lie les blocs entre eux."
                ),
                code_ref="cbc.py:cbc_encrypt",
                phase="mode_cbc",
                block_index=index,
                state_before=state_to_hex(bytes_to_state(block)),
                state_after=state_to_hex(bytes_to_state(xored)),
                intermediates={
                    "plaintext_block": to_hex(block),
                    "chaining_value": to_hex(previous),
                    "xor_input": to_hex(xored),
                },
                glossary=["xor", "cbc", "iv"],
            )
        encrypted = encrypt_block(
            xored,
            key,
            trace,
            phase="encrypt",
            block_index=index,
            expand=False,
            round_keys=round_keys,
        )
        if trace is not None:
            trace.add(
                operation="CBC.output",
                title=f"Bloc {index} — texte chiffré",
                explanation="Le résultat AES devient le chaînon du bloc suivant.",
                code_ref="cbc.py:cbc_encrypt",
                phase="mode_cbc",
                block_index=index,
                state_before=state_to_hex(bytes_to_state(xored)),
                state_after=state_to_hex(bytes_to_state(encrypted)),
                intermediates={"ciphertext_block": to_hex(encrypted)},
                glossary=["cbc"],
            )
        ciphertext += encrypted
        previous = encrypted
    return ciphertext


def cbc_decrypt(
    ciphertext: bytes,
    key: bytes,
    iv: bytes,
    trace: TraceCollector | None = None,
    *,
    strict: bool = True,
) -> bytes:
    key = require_bytes("key", key, BLOCK_SIZE)
    iv = require_bytes("iv", iv, BLOCK_SIZE)
    ciphertext = require_bytes("ciphertext", ciphertext)
    if not ciphertext or len(ciphertext) % BLOCK_SIZE != 0:
        raise ValueError("CBC ciphertext length must be a positive multiple of 16")

    round_keys = expand_key(key, trace)
    if trace is not None:
        trace.add(
            operation="CBC.input",
            title="Réception du texte chiffré",
            explanation="Bob applique AES inverse sur chaque bloc, puis XOR avec le chaînon précédent.",
            code_ref="cbc.py:cbc_decrypt",
            phase="mode_cbc",
            intermediates={"ciphertext_hex": to_hex(ciphertext), "iv": to_hex(iv)},
            glossary=["cbc", "iv"],
        )

    plaintext_padded = b""
    previous = iv
    block_count = len(ciphertext) // BLOCK_SIZE
    for index in range(block_count):
        block = ciphertext[index * BLOCK_SIZE : (index + 1) * BLOCK_SIZE]
        decrypted = decrypt_block(
            block,
            key,
            trace,
            phase="decrypt",
            block_index=index,
            round_keys=round_keys,
        )
        plain_block = xor_bytes(decrypted, previous)
        if trace is not None:
            trace.add(
                operation="CBC.xor",
                title=f"Bloc {index} — XOR après déchiffrement AES",
                explanation=(
                    "Le XOR avec l'IV ou le chiffré précédent récupère le clair. "
                    "Modifier un bloc chiffré altère ce bloc et le suivant."
                ),
                code_ref="cbc.py:cbc_decrypt",
                phase="mode_cbc",
                block_index=index,
                state_before=state_to_hex(bytes_to_state(decrypted)),
                state_after=state_to_hex(bytes_to_state(plain_block)),
                intermediates={
                    "aes_output": to_hex(decrypted),
                    "chaining_value": to_hex(previous),
                    "plaintext_block": to_hex(plain_block),
                },
                glossary=["xor", "cbc", "ciphertext-tampering"],
            )
        plaintext_padded += plain_block
        previous = block

    try:
        plaintext = pkcs7_unpad(plaintext_padded)
    except ValueError as exc:
        if trace is not None:
            trace.add(
                operation="CBC.padding_error",
                title="Padding invalide — le clair est tout de même restitué",
                explanation=(
                    "CBC n'authentifie pas. Bob peut encore déchiffrer : le résultat "
                    "est souvent illisible, mais aucun tag n'arrête le processus. "
                    "Les octets obtenus après AES et XOR sont donc montrés."
                ),
                code_ref="padding.py:pkcs7_unpad",
                phase="mode_cbc",
                intermediates={
                    "padded_hex": to_hex(plaintext_padded),
                    "error": str(exc),
                    "strict": strict,
                },
                glossary=["padding", "ciphertext-tampering", "integrity"],
            )
        if strict:
            raise
        return plaintext_padded

    if trace is not None:
        trace.add(
            operation="CBC.unpad",
            title="Retrait du padding PKCS#7",
            explanation="Les octets de padding sont retirés pour retrouver le message original.",
            code_ref="padding.py:pkcs7_unpad",
            phase="mode_cbc",
            intermediates={
                "padded_hex": to_hex(plaintext_padded),
                "plaintext_hex": to_hex(plaintext),
            },
            glossary=["padding"],
        )
    return plaintext
