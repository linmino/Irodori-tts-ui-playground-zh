from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


ModelMode = Literal["reference", "voicedesign"]
GuidanceMode = Literal["independent", "joint", "alternating"]
JobStatus = Literal["queued", "running", "completed", "failed"]


class ModelConfig(BaseModel):
    mode: ModelMode
    label: str
    checkpoint: str
    description: str
    loaded: bool = False


class RuntimeStatus(BaseModel):
    active_mode: ModelMode | None = None
    active_checkpoint: str | None = None
    active_model_device: str | None = None
    active_model_precision: str | None = None
    generation_busy: bool = False
    load_busy: bool = False


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    gpu_available: bool
    device_hint: str
    runtime: RuntimeStatus


class LoadModelRequest(BaseModel):
    mode: ModelMode
    checkpoint: str | None = None
    model_device: str = "auto"
    model_precision: str = "auto"
    codec_device: str = "auto"
    codec_precision: str = "auto"
    enable_watermark: bool = False


class LoadModelResponse(BaseModel):
    status: str
    runtime: RuntimeStatus


class GenerationRequest(BaseModel):
    mode: ModelMode
    text: str = Field(min_length=1)
    caption: str | None = None
    no_ref: bool = True
    num_steps: int = Field(default=40, ge=1, le=120)
    num_candidates: int = Field(default=1, ge=1, le=32)
    seed: int | None = None
    cfg_guidance_mode: GuidanceMode = "independent"
    cfg_scale_text: float = Field(default=3.0, ge=0.0, le=10.0)
    cfg_scale_speaker: float = Field(default=5.0, ge=0.0, le=10.0)
    cfg_scale_caption: float = Field(default=3.0, ge=0.0, le=10.0)
    cfg_scale: float | None = Field(default=None, ge=0.0, le=20.0)
    cfg_min_t: float = Field(default=0.5, ge=0.0, le=1.0)
    cfg_max_t: float = Field(default=1.0, ge=0.0, le=1.0)
    context_kv_cache: bool = True
    truncation_factor: float | None = Field(default=None, ge=0.0, le=10.0)
    rescale_k: float | None = Field(default=None, ge=0.0, le=10.0)
    rescale_sigma: float | None = Field(default=None, ge=0.0, le=10.0)
    speaker_kv_scale: float | None = Field(default=None, ge=0.0, le=10.0)
    speaker_kv_min_t: float | None = Field(default=0.9, ge=0.0, le=1.0)
    speaker_kv_max_layers: int | None = Field(default=None, ge=1)
    max_text_len: int | None = Field(default=None, ge=1)
    max_caption_len: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_mode_specific_fields(self) -> "GenerationRequest":
        self.text = self.text.strip()
        if not self.text:
            raise ValueError("text is required")
        if self.cfg_min_t > self.cfg_max_t:
            raise ValueError("cfg_min_t must be <= cfg_max_t")
        if (self.rescale_k is None) != (self.rescale_sigma is None):
            raise ValueError("rescale_k and rescale_sigma must be provided together")
        if self.mode == "voicedesign":
            self.no_ref = True
            if self.caption is not None:
                self.caption = self.caption.strip() or None
        return self


class AudioArtifact(BaseModel):
    index: int
    filename: str
    url: str


class GenerationMetadata(BaseModel):
    id: str
    status: JobStatus
    mode: ModelMode
    text: str
    caption: str | None = None
    checkpoint: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    error: str | None = None
    seed_used: int | None = None
    sample_rate: int | None = None
    duration_seconds: float | None = None
    elapsed_seconds: float | None = None
    rtf: float | None = None
    num_candidates: int = 0
    request: dict[str, Any] = Field(default_factory=dict)
    messages: list[str] = Field(default_factory=list)
    timings: list[tuple[str, float]] = Field(default_factory=list)
    audios: list[AudioArtifact] = Field(default_factory=list)


class GenerationJobResponse(BaseModel):
    id: str
    status: JobStatus
    url: str


class HistoryResponse(BaseModel):
    items: list[GenerationMetadata]


class PresetsResponse(BaseModel):
    emojis: list[dict[str, Any]]
    voice_presets: list[dict[str, str]]
    sample_texts: list[dict[str, str]]
    parameter_notes: list[dict[str, str]]
