from __future__ import annotations

import json
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .schemas import GenerationMetadata


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, GenerationMetadata] = {}
        self._lock = threading.Lock()

    def create(self, request: dict[str, Any]) -> GenerationMetadata:
        job_id = uuid4().hex
        metadata = GenerationMetadata(
            id=job_id,
            status="queued",
            mode=request["mode"],
            text=request["text"],
            caption=request.get("caption"),
            created_at=utc_now(),
            request=request,
        )
        with self._lock:
            self._jobs[job_id] = metadata
        return metadata

    def get(self, job_id: str) -> GenerationMetadata | None:
        with self._lock:
            return self._jobs.get(job_id)

    def set_running(self, job_id: str) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].status = "running"

    def set_completed(self, metadata: GenerationMetadata) -> None:
        metadata.status = "completed"
        metadata.completed_at = metadata.completed_at or utc_now()
        with self._lock:
            self._jobs[metadata.id] = metadata

    def set_failed(self, job_id: str, error: str) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].status = "failed"
                self._jobs[job_id].error = error
                self._jobs[job_id].completed_at = utc_now()


class HistoryStore:
    def __init__(self, outputs_dir: Path) -> None:
        self.outputs_dir = outputs_dir
        self.outputs_dir.mkdir(parents=True, exist_ok=True)

    def generation_dir(self, generation_id: str) -> Path:
        return self.outputs_dir / generation_id

    def prepare_generation_dir(self, generation_id: str) -> Path:
        path = self.generation_dir(generation_id)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def metadata_path(self, generation_id: str) -> Path:
        return self.generation_dir(generation_id) / "metadata.json"

    def save_metadata(self, metadata: GenerationMetadata) -> None:
        path = self.metadata_path(metadata.id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(metadata.model_dump_json(indent=2), encoding="utf-8")

    def load_metadata(self, generation_id: str) -> GenerationMetadata | None:
        path = self.metadata_path(generation_id)
        if not path.exists():
            return None
        try:
            return GenerationMetadata.model_validate_json(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, ValueError):
            return None

    def list_history(self, limit: int = 50) -> list[GenerationMetadata]:
        items: list[GenerationMetadata] = []
        for path in self.outputs_dir.glob("*/metadata.json"):
            metadata = self.load_metadata(path.parent.name)
            if metadata is not None and metadata.status == "completed":
                items.append(metadata)
        items.sort(key=lambda item: item.completed_at or item.created_at, reverse=True)
        return items[:limit]

    def delete(self, generation_id: str) -> bool:
        path = self.generation_dir(generation_id).resolve()
        root = self.outputs_dir.resolve()
        if root not in path.parents and path != root:
            raise ValueError("refusing to delete outside outputs directory")
        if not path.exists():
            return False
        shutil.rmtree(path)
        return True
