from __future__ import annotations

import gc
import time
import threading
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from huggingface_hub import hf_hub_download

from .history_store import HistoryStore, utc_now
from .presets import DEFAULT_MODELS
from .schemas import AudioArtifact, GenerationMetadata, GenerationRequest, LoadModelRequest, RuntimeStatus


CODEC_REPO = "Aratako/Semantic-DACVAE-Japanese-32dim"
FIXED_SECONDS = 30.0


class RuntimeManager:
    def __init__(self) -> None:
        self._runtime: Any | None = None
        self._active_mode: str | None = None
        self._active_checkpoint: str | None = None
        self._active_model_device: str | None = None
        self._active_model_precision: str | None = None
        self._load_lock = threading.Lock()
        self._generation_lock = threading.Lock()

    def status(self) -> RuntimeStatus:
        return RuntimeStatus(
            active_mode=self._active_mode,  # type: ignore[arg-type]
            active_checkpoint=self._active_checkpoint,
            active_model_device=self._active_model_device,
            active_model_precision=self._active_model_precision,
            generation_busy=self._generation_lock.locked(),
            load_busy=self._load_lock.locked(),
        )

    def gpu_available(self) -> bool:
        try:
            import torch

            return bool(torch.cuda.is_available())
        except ImportError:
            return False

    def default_device(self) -> str:
        if self.gpu_available():
            return "cuda"
        try:
            import torch

            if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
                return "mps"
        except ImportError:
            pass
        return "cpu"

    def list_models(self) -> list[dict[str, Any]]:
        return [
            {
                "mode": mode,
                "label": config["label"],
                "checkpoint": config["checkpoint"],
                "description": config["description"],
                "loaded": self._active_mode == mode,
            }
            for mode, config in DEFAULT_MODELS.items()
        ]

    def load(self, request: LoadModelRequest) -> RuntimeStatus:
        if not self._load_lock.acquire(blocking=False):
            raise HTTPException(status_code=409, detail="A model load/unload operation is already running.")
        try:
            checkpoint = request.checkpoint or DEFAULT_MODELS[request.mode]["checkpoint"]
            model_device = self._resolve_auto(request.model_device)
            codec_device = self._resolve_auto(request.codec_device)
            model_precision = self._resolve_precision(request.model_precision, model_device)
            codec_precision = self._resolve_precision(request.codec_precision, codec_device)

            same_runtime = (
                self._runtime is not None
                and self._active_mode == request.mode
                and self._active_checkpoint == checkpoint
                and self._active_model_device == model_device
                and self._active_model_precision == model_precision
            )
            if same_runtime:
                return self.status()

            self.unload()
            try:
                from irodori_tts.inference_runtime import InferenceRuntime, RuntimeKey
            except ImportError as exc:
                raise HTTPException(
                    status_code=500,
                    detail="Cannot import irodori_tts. Install Aratako/Irodori-TTS in the backend environment.",
                ) from exc

            resolved_checkpoint = self._resolve_checkpoint(checkpoint)
            runtime_key = RuntimeKey(
                checkpoint=resolved_checkpoint,
                model_device=model_device,
                codec_repo=CODEC_REPO,
                model_precision=model_precision,
                codec_device=codec_device,
                codec_precision=codec_precision,
                enable_watermark=bool(request.enable_watermark),
                compile_model=False,
                compile_dynamic=False,
            )
            self._runtime = InferenceRuntime.from_key(runtime_key)
            self._active_mode = request.mode
            self._active_checkpoint = checkpoint
            self._active_model_device = model_device
            self._active_model_precision = model_precision
            return self.status()
        finally:
            self._load_lock.release()

    def unload(self) -> RuntimeStatus:
        self._runtime = None
        self._active_mode = None
        self._active_checkpoint = None
        self._active_model_device = None
        self._active_model_precision = None
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        return self.status()

    def synthesize(
        self,
        generation_id: str,
        request: GenerationRequest,
        history_store: HistoryStore,
        reference_audio_path: Path | None = None,
    ) -> GenerationMetadata:
        if self._runtime is None:
            raise HTTPException(status_code=503, detail="Model is not loaded.")
        if self._active_mode != request.mode:
            raise HTTPException(
                status_code=409,
                detail=f"Loaded model mode is {self._active_mode}; requested {request.mode}. Load the target model first.",
            )
        if not self._generation_lock.acquire(blocking=False):
            raise HTTPException(status_code=409, detail="Another generation is already running.")
        try:
            try:
                from irodori_tts.inference_runtime import SamplingRequest, save_wav
            except ImportError as exc:
                raise HTTPException(status_code=500, detail="Cannot import irodori_tts inference helpers.") from exc

            t0 = time.time()
            messages: list[str] = []

            def log_fn(message: str) -> None:
                messages.append(message)

            no_ref = request.no_ref or request.mode == "voicedesign" or reference_audio_path is None
            result = self._runtime.synthesize(
                SamplingRequest(
                    text=request.text,
                    caption=request.caption if request.mode == "voicedesign" else None,
                    ref_wav=None if no_ref else str(reference_audio_path),
                    ref_latent=None,
                    no_ref=bool(no_ref),
                    ref_normalize_db=-16.0,
                    ref_ensure_max=True,
                    num_candidates=request.num_candidates,
                    decode_mode="sequential",
                    seconds=FIXED_SECONDS,
                    max_ref_seconds=30.0,
                    max_text_len=request.max_text_len,
                    max_caption_len=request.max_caption_len,
                    num_steps=request.num_steps,
                    seed=request.seed,
                    cfg_guidance_mode=request.cfg_guidance_mode,
                    cfg_scale_text=request.cfg_scale_text,
                    cfg_scale_speaker=0.0 if request.mode == "voicedesign" else request.cfg_scale_speaker,
                    cfg_scale_caption=request.cfg_scale_caption,
                    cfg_scale=request.cfg_scale,
                    cfg_min_t=request.cfg_min_t,
                    cfg_max_t=request.cfg_max_t,
                    truncation_factor=request.truncation_factor,
                    rescale_k=request.rescale_k,
                    rescale_sigma=request.rescale_sigma,
                    context_kv_cache=request.context_kv_cache,
                    speaker_kv_scale=None if request.mode == "voicedesign" else request.speaker_kv_scale,
                    speaker_kv_min_t=None if request.mode == "voicedesign" else request.speaker_kv_min_t,
                    speaker_kv_max_layers=None if request.mode == "voicedesign" else request.speaker_kv_max_layers,
                    trim_tail=True,
                    tail_window_size=20,
                    tail_std_threshold=0.05,
                    tail_mean_threshold=0.1,
                ),
                log_fn=log_fn,
            )
            elapsed = time.time() - t0
            out_dir = history_store.prepare_generation_dir(generation_id)
            audios: list[AudioArtifact] = []
            total_duration = 0.0
            for index, audio in enumerate(result.audios, start=1):
                filename = f"audio_{index:03d}.wav"
                output_path = out_dir / filename
                save_wav(output_path, audio.float(), result.sample_rate)
                duration = float(audio.shape[-1] / result.sample_rate)
                total_duration = max(total_duration, duration)
                audios.append(
                    AudioArtifact(
                        index=index,
                        filename=filename,
                        url=f"/api/v1/generations/{generation_id}/audio/{index}",
                    )
                )

            metadata = GenerationMetadata(
                id=generation_id,
                status="completed",
                mode=request.mode,
                text=request.text,
                caption=request.caption,
                checkpoint=self._active_checkpoint,
                created_at=utc_now(),
                completed_at=utc_now(),
                seed_used=getattr(result, "used_seed", request.seed),
                sample_rate=result.sample_rate,
                duration_seconds=total_duration,
                elapsed_seconds=elapsed,
                rtf=(total_duration / elapsed) if elapsed > 0 else None,
                num_candidates=len(audios),
                request=request.model_dump(),
                messages=messages + list(getattr(result, "messages", [])),
                timings=list(getattr(result, "stage_timings", [])),
                audios=audios,
            )
            history_store.save_metadata(metadata)
            return metadata
        finally:
            self._generation_lock.release()

    def _resolve_auto(self, value: str) -> str:
        return self.default_device() if value == "auto" else value

    def _resolve_precision(self, value: str, device: str) -> str:
        if value != "auto":
            return value
        if device == "cuda":
            try:
                import torch

                return "bf16" if torch.cuda.is_bf16_supported() else "fp32"
            except ImportError:
                return "fp32"
        return "fp32"

    def _resolve_checkpoint(self, checkpoint: str) -> str:
        path = Path(checkpoint)
        if path.suffix.lower() in {".pt", ".safetensors"}:
            return str(path)
        return hf_hub_download(repo_id=checkpoint, filename="model.safetensors")
