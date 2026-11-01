"""REST API for the AES Studio frontend."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models.schemas import (
    DecryptRequest,
    EncryptRequest,
    GenerateParamsRequest,
    GenerateParamsResponse,
    GlossaryTerm,
    HealthResponse,
    KeyExpansionRequest,
    SessionResponse,
    SourceContentResponse,
    SourceListResponse,
    TraceStep,
)
from app.services.crypto_service import (
    CryptoError,
    decrypt_session,
    encrypt_session,
    expand_key_steps,
    generate_params,
)
from app.services.glossary import all_terms
from app.services.source_service import engine_zip, list_sources, read_source

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        engine="homegrown-aes-128",
        notice=(
            "Moteur pédagogique local. Ne pas utiliser pour protéger des données réelles."
        ),
    )


@router.post("/params/generate", response_model=GenerateParamsResponse)
def params_generate(req: GenerateParamsRequest) -> GenerateParamsResponse:
    return generate_params(req.mode)


@router.post("/key-expansion", response_model=list[TraceStep])
def key_expansion(req: KeyExpansionRequest) -> list[TraceStep]:
    try:
        return [TraceStep(**step) for step in expand_key_steps(req.key_hex)]
    except (CryptoError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/session/encrypt", response_model=SessionResponse)
def session_encrypt(req: EncryptRequest) -> SessionResponse:
    try:
        return encrypt_session(req)
    except CryptoError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc), "kind": exc.kind}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/session/decrypt", response_model=SessionResponse)
def session_decrypt(req: DecryptRequest) -> SessionResponse:
    try:
        return decrypt_session(req)
    except CryptoError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc), "kind": exc.kind}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/source", response_model=SourceListResponse)
def source_index() -> SourceListResponse:
    return SourceListResponse(files=list_sources())


@router.get("/source/archive.zip")
def source_archive() -> Response:
    return Response(
        content=engine_zip(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=aes-studio-engine.zip"},
    )


@router.get("/source/{file_id}", response_model=SourceContentResponse)
def source_file(file_id: str) -> SourceContentResponse:
    try:
        return read_source(file_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Fichier introuvable") from exc


@router.get("/source/{file_id}/download")
def source_download(file_id: str) -> Response:
    try:
        item = read_source(file_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Fichier introuvable") from exc
    filename = item.path.split("/")[-1]
    return Response(
        content=item.content.encode("utf-8"),
        media_type="text/x-python",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/glossary", response_model=list[GlossaryTerm])
def glossary() -> list[GlossaryTerm]:
    return all_terms()
