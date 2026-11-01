"""Serve the exact Python sources executed by the engine."""

from __future__ import annotations

import ast
import io
import zipfile
from pathlib import Path

from app.models.schemas import SourceContentResponse, SourceFile

ROOT = Path(__file__).resolve().parents[1]
CRYPTO = ROOT / "cryptography"
TESTS = ROOT.parents[1] / "tests"

CATALOG: list[dict[str, str]] = [
    {"id": "aes", "category": "AES", "title": "Chiffrement et déchiffrement de bloc", "path": "aes.py"},
    {"id": "key_expansion", "category": "Key Expansion", "title": "Expansion de clé AES-128", "path": "key_expansion.py"},
    {"id": "sbox", "category": "SubBytes", "title": "S-Box et S-Box inverse", "path": "sbox.py"},
    {"id": "gf256", "category": "SubBytes", "title": "Corps fini GF(2^8)", "path": "gf256.py"},
    {"id": "shiftrows", "category": "ShiftRows", "title": "ShiftRows / InvShiftRows (dans aes.py)", "path": "aes.py"},
    {"id": "mixcolumns", "category": "MixColumns", "title": "MixColumns / InvMixColumns (dans aes.py)", "path": "aes.py"},
    {"id": "addroundkey", "category": "AddRoundKey", "title": "AddRoundKey (dans aes.py)", "path": "aes.py"},
    {"id": "cbc", "category": "CBC", "title": "Mode CBC et chaînage", "path": "cbc.py"},
    {"id": "ctr", "category": "CTR", "title": "Mode CTR et flux de clés", "path": "ctr.py"},
    {"id": "gcm", "category": "GCM", "title": "Mode GCM authentifié", "path": "gcm.py"},
    {"id": "ghash", "category": "GHASH", "title": "GHASH et GF(2^128)", "path": "ghash.py"},
    {"id": "padding", "category": "Fonctions auxiliaires", "title": "Padding PKCS#7", "path": "padding.py"},
    {"id": "utils", "category": "Fonctions auxiliaires", "title": "Octets, hex, matrices", "path": "utils.py"},
    {"id": "traces", "category": "Fonctions auxiliaires", "title": "Collecteur de traces", "path": "traces.py"},
    {"id": "test_aes", "category": "Tests", "title": "Vecteurs AES FIPS 197", "path": "tests/test_aes.py"},
    {"id": "test_key_expansion", "category": "Tests", "title": "Vecteurs expansion de clé", "path": "tests/test_key_expansion.py"},
    {"id": "test_sbox", "category": "Tests", "title": "Tests S-Box", "path": "tests/test_sbox.py"},
    {"id": "test_cbc", "category": "Tests", "title": "Vecteurs CBC NIST", "path": "tests/test_cbc.py"},
    {"id": "test_ctr", "category": "Tests", "title": "Vecteurs CTR NIST", "path": "tests/test_ctr.py"},
    {"id": "test_gcm", "category": "Tests", "title": "Vecteurs GCM NIST", "path": "tests/test_gcm.py"},
    {"id": "test_ghash", "category": "Tests", "title": "Tests GHASH", "path": "tests/test_ghash.py"},
    {"id": "test_padding", "category": "Tests", "title": "Tests PKCS#7", "path": "tests/test_padding.py"},
]


def _resolve(rel: str) -> Path:
    if rel.startswith("tests/"):
        return TESTS / rel.split("/", 1)[1]
    return CRYPTO / rel


def _functions(path: Path) -> list[str]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError):
        return []
    return [node.name for node in tree.body if isinstance(node, ast.FunctionDef)]


def list_sources() -> list[SourceFile]:
    files = []
    for item in CATALOG:
        path = _resolve(item["path"])
        files.append(
            SourceFile(
                id=item["id"],
                category=item["category"],
                title=item["title"],
                path=item["path"],
                functions=_functions(path) if path.exists() else [],
            )
        )
    return files


def read_source(file_id: str) -> SourceContentResponse:
    item = next((row for row in CATALOG if row["id"] == file_id), None)
    if item is None:
        raise FileNotFoundError(file_id)
    path = _resolve(item["path"])
    content = path.read_text(encoding="utf-8")
    return SourceContentResponse(
        id=item["id"],
        category=item["category"],
        title=item["title"],
        path=item["path"],
        content=content,
    )


def engine_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(CRYPTO.rglob("*.py")):
            archive.write(path, arcname=f"cryptography/{path.relative_to(CRYPTO)}")
        for path in sorted(TESTS.glob("test_*.py")):
            archive.write(path, arcname=f"tests/{path.name}")
    return buffer.getvalue()


def source_for_ref(code_ref: str) -> str | None:
    filename = code_ref.split(":")[0]
    stem = Path(filename).stem
    if any(item["id"] == stem for item in CATALOG):
        return stem
    return "aes"
