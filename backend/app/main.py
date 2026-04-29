from __future__ import annotations

import json
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from .history_store import HistoryStore, JobStore
from .presets import build_presets_response
from .runtime_manager import RuntimeManager
from .schemas import (
    GenerationJobResponse,
    GenerationMetadata,
    GenerationRequest,
    HealthResponse,
    HistoryResponse,
    LoadModelRequest,
    LoadModelResponse,
    ModelConfig,
    PresetsResponse,
)


ROOT_DIR = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = ROOT_DIR / "outputs"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

app = FastAPI(title="Irodori-TTS Unified Playground API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

runtime_manager = RuntimeManager()
history_store = HistoryStore(OUTPUTS_DIR)
job_store = JobStore()
executor = ThreadPoolExecutor(max_workers=1)


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    device = runtime_manager.default_device()
    return HealthResponse(
        gpu_available=runtime_manager.gpu_available(),
        device_hint=device,
        runtime=runtime_manager.status(),
    )


@app.get("/api/v1/models", response_model=list[ModelConfig])
def models() -> list[ModelConfig]:
    return [ModelConfig.model_validate(item) for item in runtime_manager.list_models()]


@app.post("/api/v1/models/load", response_model=LoadModelResponse)
def load_model(request: LoadModelRequest) -> LoadModelResponse:
    status = runtime_manager.load(request)
    return LoadModelResponse(status="loaded", runtime=status)


@app.post("/api/v1/models/unload", response_model=LoadModelResponse)
def unload_model() -> LoadModelResponse:
    status = runtime_manager.unload()
    return LoadModelResponse(status="unloaded", runtime=status)


@app.get("/api/v1/presets", response_model=PresetsResponse)
def presets() -> PresetsResponse:
    return PresetsResponse.model_validate(build_presets_response())


@app.get("/api/v1/history", response_model=HistoryResponse)
def history(limit: int = 50) -> HistoryResponse:
    return HistoryResponse(items=history_store.list_history(limit=limit))


@app.delete("/api/v1/history/{generation_id}")
def delete_history(generation_id: str) -> dict[str, bool]:
    deleted = history_store.delete(generation_id)
    return {"deleted": deleted}


@app.post("/api/v1/generations", response_model=GenerationJobResponse)
async def create_generation(request: Request) -> GenerationJobResponse:
    generation_request, reference_path = await _parse_generation_request(request)
    job = job_store.create(generation_request.model_dump())
    if reference_path is not None:
        out_dir = history_store.prepare_generation_dir(job.id)
        suffix = reference_path.suffix or ".wav"
        stored_reference = out_dir / f"reference{suffix}"
        shutil.move(str(reference_path), stored_reference)
        reference_path = stored_reference

    def run_job() -> None:
        job_store.set_running(job.id)
        try:
            metadata = runtime_manager.synthesize(
                generation_id=job.id,
                request=generation_request,
                history_store=history_store,
                reference_audio_path=reference_path,
            )
            job_store.set_completed(metadata)
        except Exception as exc:  # noqa: BLE001 - surfaced through job status
            job_store.set_failed(job.id, str(exc))

    executor.submit(run_job)
    return GenerationJobResponse(id=job.id, status="queued", url=f"/api/v1/generations/{job.id}")


@app.get("/api/v1/generations/{generation_id}", response_model=GenerationMetadata)
def get_generation(generation_id: str) -> GenerationMetadata:
    in_memory = job_store.get(generation_id)
    if in_memory is not None and in_memory.status != "completed":
        return in_memory
    metadata = history_store.load_metadata(generation_id) or in_memory
    if metadata is None:
        raise HTTPException(status_code=404, detail="Generation not found.")
    return metadata


@app.get("/api/v1/generations/{generation_id}/audio/{index}")
def get_generation_audio(generation_id: str, index: int) -> FileResponse:
    path = history_store.generation_dir(generation_id) / f"audio_{index:03d}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found.")
    return FileResponse(path, media_type="audio/wav", filename=path.name)


@app.post("/api/v1/tts.wav")
async def tts_wav(request: Request) -> Response:
    generation_request, reference_path = await _parse_generation_request(request)
    job = job_store.create(generation_request.model_dump())
    if reference_path is not None:
        out_dir = history_store.prepare_generation_dir(job.id)
        suffix = reference_path.suffix or ".wav"
        stored_reference = out_dir / f"reference{suffix}"
        shutil.move(str(reference_path), stored_reference)
        reference_path = stored_reference
    metadata = runtime_manager.synthesize(job.id, generation_request, history_store, reference_path)
    job_store.set_completed(metadata)
    if not metadata.audios:
        raise HTTPException(status_code=500, detail="No audio generated.")
    path = history_store.generation_dir(job.id) / metadata.audios[0].filename
    headers = {
        "X-Generation-Id": job.id,
        "X-TTS-Duration": f"{metadata.duration_seconds or 0:.2f}",
        "X-TTS-Elapsed": f"{metadata.elapsed_seconds or 0:.2f}",
        "X-TTS-RTF": f"{metadata.rtf or 0:.2f}",
    }
    return FileResponse(path, media_type="audio/wav", filename=path.name, headers=headers)


async def _parse_generation_request(request: Request) -> tuple[GenerationRequest, Path | None]:
    content_type = request.headers.get("content-type", "")
    reference_path: Path | None = None
    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            payload_raw = form.get("payload")
            if payload_raw is None:
                raise HTTPException(status_code=422, detail="multipart payload field is required.")
            payload = json.loads(str(payload_raw))
            upload = form.get("reference_audio")
            if upload is not None and hasattr(upload, "filename") and upload.filename:
                suffix = Path(upload.filename).suffix or ".wav"
                tmp_dir = OUTPUTS_DIR / "_uploads"
                tmp_dir.mkdir(parents=True, exist_ok=True)
                reference_path = tmp_dir / f"{Path(upload.filename).stem}_{id(upload)}{suffix}"
                with reference_path.open("wb") as handle:
                    while chunk := await upload.read(1024 * 1024):
                        handle.write(chunk)
        else:
            payload = await request.json()
        return GenerationRequest.model_validate(payload), reference_path
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Invalid JSON payload.") from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
