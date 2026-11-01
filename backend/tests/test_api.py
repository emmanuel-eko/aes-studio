"""HTTP API tests against the real AES engine."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

KEY = "2b7e151628aed2a6abf7158809cf4f3c"
IV = "000102030405060708090a0b0c0d0e0f"
COUNTER = "f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"
GCM_KEY = "00000000000000000000000000000000"
GCM_NONCE = "000000000000000000000000"


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["engine"] == "homegrown-aes-128"


def test_generate_params_lengths() -> None:
    for mode, field, size in (
        ("CBC", "iv_hex", 32),
        ("CTR", "counter_hex", 32),
        ("GCM", "nonce_hex", 24),
    ):
        response = client.post("/api/params/generate", json={"mode": mode})
        body = response.json()
        assert response.status_code == 200
        assert len(body["key_hex"]) == 32
        assert len(body[field]) == size


def test_encrypt_decrypt_cbc_roundtrip() -> None:
    enc = client.post(
        "/api/session/encrypt",
        json={
            "plaintext": "Rendez-vous à 18h",
            "mode": "CBC",
            "key_hex": KEY,
            "iv_hex": IV,
        },
    )
    assert enc.status_code == 200
    cipher = enc.json()["ciphertext_hex"]
    assert enc.json()["steps"]
    dec = client.post(
        "/api/session/decrypt",
        json={
            "ciphertext_hex": cipher,
            "mode": "CBC",
            "key_hex": KEY,
            "iv_hex": IV,
            "actor": "bob",
        },
    )
    assert dec.status_code == 200
    assert dec.json()["plaintext"] == "Rendez-vous à 18h"


def test_ctr_no_padding_length() -> None:
    message = "abc"
    enc = client.post(
        "/api/session/encrypt",
        json={
            "plaintext": message,
            "mode": "CTR",
            "key_hex": KEY,
            "counter_hex": COUNTER,
        },
    )
    assert enc.status_code == 200
    assert len(enc.json()["ciphertext_hex"]) == 6


def test_gcm_rejects_tamper() -> None:
    enc = client.post(
        "/api/session/encrypt",
        json={
            "plaintext": "secret",
            "mode": "GCM",
            "key_hex": GCM_KEY,
            "nonce_hex": GCM_NONCE,
            "aad": "from-alice",
        },
    )
    assert enc.status_code == 200
    cipher = bytearray.fromhex(enc.json()["ciphertext_hex"])
    cipher[0] ^= 1
    dec = client.post(
        "/api/session/decrypt",
        json={
            "ciphertext_hex": cipher.hex(),
            "mode": "GCM",
            "key_hex": GCM_KEY,
            "nonce_hex": GCM_NONCE,
            "tag_hex": enc.json()["tag_hex"],
            "aad": "from-alice",
            "actor": "bob",
        },
    )
    body = dec.json()
    assert body["ok"] is False
    assert body["authenticated"] is False
    assert body["plaintext"] is None


def test_cbc_tamper_still_decrypts() -> None:
    enc = client.post(
        "/api/session/encrypt",
        json={"plaintext": "secret-message!!", "mode": "CBC", "key_hex": KEY, "iv_hex": IV},
    )
    cipher = bytearray.fromhex(enc.json()["ciphertext_hex"])
    cipher[0] ^= 0x01
    dec = client.post(
        "/api/session/decrypt",
        json={
            "ciphertext_hex": cipher.hex(),
            "mode": "CBC",
            "key_hex": KEY,
            "iv_hex": IV,
            "actor": "bob",
        },
    )
    body = dec.json()
    assert dec.status_code == 200
    assert body["recovered_text"]
    assert body["plaintext_hex"]
    assert body["recovered_text"] != "secret-message!!"


def test_ctr_tamper_still_decrypts() -> None:
    enc = client.post(
        "/api/session/encrypt",
        json={"plaintext": "ABCDEFGH", "mode": "CTR", "key_hex": KEY, "counter_hex": COUNTER},
    )
    cipher = bytearray.fromhex(enc.json()["ciphertext_hex"])
    cipher[0] ^= 0x01
    dec = client.post(
        "/api/session/decrypt",
        json={
            "ciphertext_hex": cipher.hex(),
            "mode": "CTR",
            "key_hex": KEY,
            "counter_hex": COUNTER,
            "actor": "bob",
        },
    )
    body = dec.json()
    assert body["ok"] is True
    assert body["recovered_text"]
    assert body["recovered_text"] != "ABCDEFGH"


def test_gcm_nonce_reuse_rejected() -> None:
    payload = {
        "plaintext": "once",
        "mode": "GCM",
        "key_hex": "11111111111111111111111111111111",
        "nonce_hex": "aaaaaaaaaaaaaaaaaaaaaaaa",
    }
    assert client.post("/api/session/encrypt", json=payload).status_code == 200
    second = client.post("/api/session/encrypt", json=payload)
    assert second.status_code == 400


def test_bad_key_rejected() -> None:
    response = client.post(
        "/api/session/encrypt",
        json={"plaintext": "x", "mode": "CBC", "key_hex": "00", "iv_hex": IV},
    )
    assert response.status_code == 400


def test_source_matches_disk() -> None:
    listing = client.get("/api/source")
    assert listing.status_code == 200
    aes = client.get("/api/source/aes")
    assert "def encrypt_block" in aes.json()["content"]
    assert "def shift_rows" in aes.json()["content"]


def test_source_zip() -> None:
    response = client.get("/api/source/archive.zip")
    assert response.status_code == 200
    assert response.content[:2] == b"PK"


def test_glossary_not_empty() -> None:
    response = client.get("/api/glossary")
    assert len(response.json()) >= 16


def test_bob_decrypts_with_wrong_key() -> None:
    enc = client.post(
        "/api/session/encrypt",
        json={"plaintext": "secret pedagogique", "mode": "CBC", "key_hex": KEY, "iv_hex": IV},
    )
    cipher = enc.json()["ciphertext_hex"]
    dec = client.post(
        "/api/session/decrypt",
        json={
            "ciphertext_hex": cipher,
            "mode": "CBC",
            "key_hex": "000102030405060708090a0b0c0d0e0f",
            "iv_hex": IV,
            "actor": "bob",
        },
    )
    body = dec.json()
    assert dec.status_code == 200
    assert body["ok"] is True
    assert body["plaintext"]
    assert body["plaintext"] != "secret pedagogique"
    assert body["recovered_text"] == body["plaintext"]
    assert body["used_key_hex"] == "000102030405060708090a0b0c0d0e0f"


def test_gcm_wrong_key_rejects() -> None:
    enc = client.post(
        "/api/session/encrypt",
        json={
            "plaintext": "secret",
            "mode": "GCM",
            "key_hex": GCM_KEY,
            "nonce_hex": "010101010101010101010101",
        },
    )
    dec = client.post(
        "/api/session/decrypt",
        json={
            "ciphertext_hex": enc.json()["ciphertext_hex"],
            "mode": "GCM",
            "key_hex": KEY,
            "nonce_hex": "010101010101010101010101",
            "tag_hex": enc.json()["tag_hex"],
            "actor": "bob",
        },
    )
    body = dec.json()
    assert body["authenticated"] is False
    assert body["plaintext"] is None


def test_bob_can_shorten_ciphertext() -> None:
    enc = client.post(
        "/api/session/encrypt",
        json={"plaintext": "message plus long que seize", "mode": "CBC", "key_hex": KEY, "iv_hex": IV},
    )
    shortened = enc.json()["ciphertext_hex"][:-4]
    dec = client.post(
        "/api/session/decrypt",
        json={
            "ciphertext_hex": shortened,
            "mode": "CBC",
            "key_hex": KEY,
            "iv_hex": IV,
            "actor": "bob",
        },
    )
    body = dec.json()
    assert dec.status_code == 200
    assert body["recovered_text"] is not None
    assert any("multiple de 16" in warning for warning in body["warnings"])
