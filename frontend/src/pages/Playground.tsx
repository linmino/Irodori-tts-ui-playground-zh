import {
  AlertCircle,
  BookOpen,
  Bot,
  CheckCircle2,
  Copy,
  Download,
  FileAudio,
  History,
  ListChecks,
  HelpCircle,
  Loader2,
  Mic2,
  Palette,
  Play,
  RotateCcw,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wand2,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EmojiPreset,
  fallbackPresets,
  Mode,
  ParameterNote,
  PresetsResponse,
  SampleText,
  VoicePreset
} from "../data/presets";

type RuntimeStatus = {
  active_mode: Mode | null;
  active_checkpoint: string | null;
  active_model_device: string | null;
  active_model_precision: string | null;
  generation_busy: boolean;
  load_busy: boolean;
};

type HealthResponse = {
  status: "ok";
  gpu_available: boolean;
  device_hint: string;
  runtime: RuntimeStatus;
};

type AudioArtifact = {
  index: number;
  filename: string;
  url: string;
};

type GenerationMetadata = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  mode: Mode;
  text: string;
  caption?: string | null;
  checkpoint?: string | null;
  created_at: string;
  completed_at?: string | null;
  error?: string | null;
  seed_used?: number | null;
  sample_rate?: number | null;
  duration_seconds?: number | null;
  elapsed_seconds?: number | null;
  rtf?: number | null;
  request: Record<string, unknown>;
  audios: AudioArtifact[];
};

type ReferenceForm = {
  text: string;
  checkpoint: string;
  noRef: boolean;
  numSteps: number;
  numCandidates: number;
  seed: string;
  cfgGuidanceMode: "independent" | "joint" | "alternating";
  cfgScaleText: number;
  cfgScaleSpeaker: number;
  cfgMinT: number;
  cfgMaxT: number;
  contextKvCache: boolean;
  speakerKvScale: string;
  speakerKvMinT: string;
  speakerKvMaxLayers: string;
};

type VoiceDesignForm = {
  text: string;
  caption: string;
  checkpoint: string;
  numSteps: number;
  numCandidates: number;
  seed: string;
  cfgGuidanceMode: "independent" | "joint" | "alternating";
  cfgScaleText: number;
  cfgScaleCaption: number;
  cfgMinT: number;
  cfgMaxT: number;
  contextKvCache: boolean;
  maxCaptionLen: string;
};

type BatchItemStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

type BatchItem = {
  id: string;
  index: number;
  text: string;
  status: BatchItemStatus;
  generation?: GenerationMetadata;
  error?: string;
};

const defaultReferenceForm: ReferenceForm = {
  text: "こんにちは、今日はとてもいい天気ですね 😊",
  checkpoint: "Aratako/Irodori-TTS-500M-v2",
  noRef: true,
  numSteps: 40,
  numCandidates: 1,
  seed: "",
  cfgGuidanceMode: "independent",
  cfgScaleText: 3,
  cfgScaleSpeaker: 5,
  cfgMinT: 0.5,
  cfgMaxT: 1,
  contextKvCache: true,
  speakerKvScale: "",
  speakerKvMinT: "0.9",
  speakerKvMaxLayers: ""
};

const defaultVoiceDesignForm: VoiceDesignForm = {
  text: "こんにちは、今日はとてもいい天気ですね 😊",
  caption: "落ち着いた女性の声で、近い距離感でやわらかく自然に読み上げてください。",
  checkpoint: "Aratako/Irodori-TTS-500M-v2-VoiceDesign",
  numSteps: 40,
  numCandidates: 1,
  seed: "",
  cfgGuidanceMode: "independent",
  cfgScaleText: 3,
  cfgScaleCaption: 3,
  cfgMinT: 0.5,
  cfgMaxT: 1,
  contextKvCache: true,
  maxCaptionLen: ""
};

const storageKey = "irodori-unified-playground-state";
const batchLimit = 50;

function readStoredState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as {
      mode?: Mode;
      reference?: Partial<ReferenceForm>;
      voicedesign?: Partial<VoiceDesignForm>;
    };
  } catch {
    return null;
  }
}

function numberOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function intOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number.parseInt(trimmed, 10);
}

function formatSeconds(value?: number | null) {
  return value == null ? "-" : `${value.toFixed(2)}s`;
}

function formatNumber(value?: number | null) {
  return value == null ? "-" : value.toFixed(2);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function audioDownloadUrl(item: GenerationMetadata, audio: AudioArtifact) {
  return `${audio.url}?t=${item.id}`;
}

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseBatchLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function statusLabel(status: BatchItemStatus) {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "生成中";
    case "completed":
      return "完成";
    case "failed":
      return "失敗";
    case "cancelled":
      return "已停止";
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      detail = await response.text();
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export function Playground() {
  const stored = readStoredState();
  const [mode, setMode] = useState<Mode>(stored?.mode ?? "reference");
  const [referenceForm, setReferenceForm] = useState<ReferenceForm>({
    ...defaultReferenceForm,
    ...stored?.reference
  });
  const [voiceForm, setVoiceForm] = useState<VoiceDesignForm>({
    ...defaultVoiceDesignForm,
    ...stored?.voicedesign
  });
  const [presets, setPresets] = useState<PresetsResponse>(fallbackPresets);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [history, setHistory] = useState<GenerationMetadata[]>([]);
  const [activeGeneration, setActiveGeneration] = useState<GenerationMetadata | null>(null);
  const [batchText, setBatchText] = useState("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [selectedBatchItemId, setSelectedBatchItemId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [playingBatchItemId, setPlayingBatchItemId] = useState<string | null>(null);
  const [referenceAudio, setReferenceAudio] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [notice, setNotice] = useState<string>("");
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const captionRef = useRef<HTMLTextAreaElement | null>(null);
  const batchStopRef = useRef(false);
  const batchAudioRef = useRef<HTMLAudioElement | null>(null);

  const form = mode === "reference" ? referenceForm : voiceForm;
  const runtime = health?.runtime;
  const activeLoaded = runtime?.active_mode === mode;
  const batchLines = useMemo(() => parseBatchLines(batchText), [batchText]);
  const selectedBatchItem = batchItems.find((item) => item.id === selectedBatchItemId) ?? null;
  const batchSummary = useMemo(() => {
    return batchItems.reduce(
      (summary, item) => {
        summary.total += 1;
        if (item.status === "completed") summary.completed += 1;
        if (item.status === "failed") summary.failed += 1;
        if (item.status === "cancelled") summary.cancelled += 1;
        summary.elapsed += item.generation?.elapsed_seconds ?? 0;
        return summary;
      },
      { total: 0, completed: 0, failed: 0, cancelled: 0, elapsed: 0 }
    );
  }, [batchItems]);
  const noteByName = useMemo(() => {
    return presets.parameter_notes.reduce<Record<string, ParameterNote>>((notes, note) => {
      notes[note.name] = note;
      return notes;
    }, {});
  }, [presets.parameter_notes]);

  const emojiGroups = useMemo(() => {
    return presets.emojis.reduce<Record<string, EmojiPreset[]>>((groups, emoji) => {
      groups[emoji.category] = groups[emoji.category] ?? [];
      groups[emoji.category].push(emoji);
      return groups;
    }, {});
  }, [presets.emojis]);

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await fetchJson<HealthResponse>("/api/v1/health"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetchJson<{ items: GenerationMetadata[] }>("/api/v1/history");
      setHistory(response.items);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    void fetchJson<PresetsResponse>("/api/v1/presets")
      .then(setPresets)
      .catch(() => setPresets(fallbackPresets));
    void refreshHealth();
    void refreshHistory();
    const timer = window.setInterval(refreshHealth, 3000);
    return () => window.clearInterval(timer);
  }, [refreshHealth, refreshHistory]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ mode, reference: referenceForm, voicedesign: voiceForm })
    );
  }, [mode, referenceForm, voiceForm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void generate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    return () => {
      batchAudioRef.current?.pause();
      batchAudioRef.current = null;
    };
  }, []);

  function updateReference(patch: Partial<ReferenceForm>) {
    setReferenceForm((current) => ({ ...current, ...patch }));
  }

  function updateVoiceDesign(patch: Partial<VoiceDesignForm>) {
    setVoiceForm((current) => ({ ...current, ...patch }));
  }

  function updateText(text: string) {
    if (mode === "reference") updateReference({ text });
    else updateVoiceDesign({ text });
  }

  function insertIntoTextarea(value: string, target: "text" | "caption" = "text") {
    const element = target === "caption" ? captionRef.current : textRef.current;
    if (!element) return;
    const source = target === "caption" ? voiceForm.caption : form.text;
    const start = element.selectionStart ?? source.length;
    const end = element.selectionEnd ?? source.length;
    const next = `${source.slice(0, start)}${value}${source.slice(end)}`;
    if (target === "caption") updateVoiceDesign({ caption: next });
    else updateText(next);
    window.requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + value.length, start + value.length);
    });
  }

  async function loadModel() {
    setLoadingModel(true);
    setNotice("");
    try {
      await fetchJson("/api/v1/models/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          checkpoint: form.checkpoint,
          model_device: "auto",
          model_precision: "auto",
          codec_device: "auto",
          codec_precision: "auto"
        })
      });
      await refreshHealth();
      setNotice("模型已載入。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingModel(false);
    }
  }

  async function unloadModel() {
    setLoadingModel(true);
    setNotice("");
    try {
      await fetchJson("/api/v1/models/unload", { method: "POST" });
      await refreshHealth();
      setNotice("模型已卸載。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingModel(false);
    }
  }

  function updateBatchItem(id: string, patch: Partial<BatchItem>) {
    setBatchItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function buildPayload(textOverride?: string) {
    if (mode === "reference") {
      return {
        mode,
        text: textOverride ?? referenceForm.text,
        no_ref: referenceForm.noRef,
        num_steps: referenceForm.numSteps,
        num_candidates: referenceForm.numCandidates,
        seed: intOrNull(referenceForm.seed),
        cfg_guidance_mode: referenceForm.cfgGuidanceMode,
        cfg_scale_text: referenceForm.cfgScaleText,
        cfg_scale_speaker: referenceForm.cfgScaleSpeaker,
        cfg_min_t: referenceForm.cfgMinT,
        cfg_max_t: referenceForm.cfgMaxT,
        context_kv_cache: referenceForm.contextKvCache,
        speaker_kv_scale: numberOrNull(referenceForm.speakerKvScale),
        speaker_kv_min_t: numberOrNull(referenceForm.speakerKvMinT),
        speaker_kv_max_layers: intOrNull(referenceForm.speakerKvMaxLayers)
      };
    }
    return {
      mode,
      text: textOverride ?? voiceForm.text,
      caption: voiceForm.caption,
      no_ref: true,
      num_steps: voiceForm.numSteps,
      num_candidates: voiceForm.numCandidates,
      seed: intOrNull(voiceForm.seed),
      cfg_guidance_mode: voiceForm.cfgGuidanceMode,
      cfg_scale_text: voiceForm.cfgScaleText,
      cfg_scale_caption: voiceForm.cfgScaleCaption,
      cfg_min_t: voiceForm.cfgMinT,
      cfg_max_t: voiceForm.cfgMaxT,
      context_kv_cache: voiceForm.contextKvCache,
      max_caption_len: intOrNull(voiceForm.maxCaptionLen)
    };
  }

  async function submitGeneration(payload: Record<string, unknown>, referenceFile = referenceAudio) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (payload.mode === "reference" && !payload.no_ref && referenceFile) {
      formData.append("reference_audio", referenceFile);
    }
    return fetchJson<{ id: string; status: string; url: string }>("/api/v1/generations", {
      method: "POST",
      body: formData
    });
  }

  async function generate() {
    setBusy(true);
    setNotice("");
    try {
      const payload = buildPayload();
      const job = await submitGeneration(payload);
      const completed = await pollGeneration(job.id);
      setActiveGeneration(completed);
      await refreshHistory();
      await refreshHealth();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function pollGeneration(id: string, onUpdate?: (metadata: GenerationMetadata) => void, syncActive = true) {
    for (;;) {
      const metadata = await fetchJson<GenerationMetadata>(`/api/v1/generations/${id}`);
      onUpdate?.(metadata);
      if (syncActive) setActiveGeneration(metadata);
      if (metadata.status === "completed") return metadata;
      if (metadata.status === "failed") throw new Error(metadata.error ?? "生成失敗。");
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }
  }

  async function runBatchItem(item: BatchItem, payload = buildPayload(item.text), referenceFile = referenceAudio) {
    updateBatchItem(item.id, { status: "running", error: undefined });
    setSelectedBatchItemId(item.id);
    const job = await submitGeneration(payload, referenceFile);
    const completed = await pollGeneration(job.id, (metadata) => {
      updateBatchItem(item.id, { generation: metadata, status: metadata.status === "completed" ? "completed" : "running" });
    }, false);
    updateBatchItem(item.id, { status: "completed", generation: completed, error: undefined });
    return completed;
  }

  async function startBatchGeneration() {
    if (batchRunning) return;
    const lines = parseBatchLines(batchText);
    if (lines.length === 0) {
      setNotice("請先輸入批量文字。");
      return;
    }
    if (lines.length > batchLimit) {
      setNotice(`批量生成上限為 ${batchLimit} 段，請先縮減文字。`);
      return;
    }
    if (!activeLoaded) {
      setNotice("請先載入目前模式的模型。");
      return;
    }

    const items = lines.map<BatchItem>((text, index) => ({
      id: createLocalId(),
      index: index + 1,
      text,
      status: "pending"
    }));
    const payloadById = new Map(items.map((item) => [item.id, buildPayload(item.text)]));
    const referenceFile = referenceAudio;

    batchStopRef.current = false;
    setBatchItems(items);
    setSelectedBatchItemId(items[0]?.id ?? null);
    setBatchRunning(true);
    setNotice("");

    try {
      for (const item of items) {
        if (batchStopRef.current) {
          setBatchItems((current) =>
            current.map((currentItem) =>
              currentItem.status === "pending" ? { ...currentItem, status: "cancelled" } : currentItem
            )
          );
          break;
        }
        try {
          await runBatchItem(item, payloadById.get(item.id), referenceFile);
        } catch (error) {
          updateBatchItem(item.id, {
            status: "failed",
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      await refreshHistory();
      await refreshHealth();
    } finally {
      setBatchRunning(false);
    }
  }

  function stopBatchGeneration() {
    batchStopRef.current = true;
    setNotice("已要求停止批量生成；目前這筆完成後就不會送出下一筆。");
  }

  function clearBatchResults() {
    batchAudioRef.current?.pause();
    batchAudioRef.current = null;
    setPlayingBatchItemId(null);
    setBatchItems([]);
    setSelectedBatchItemId(null);
  }

  async function retryBatchItem(item: BatchItem) {
    if (batchRunning || !activeLoaded) return;
    batchStopRef.current = false;
    setBatchRunning(true);
    setNotice("");
    try {
      await runBatchItem(item);
      await refreshHistory();
      await refreshHealth();
    } catch (error) {
      updateBatchItem(item.id, {
        status: "failed",
        generation: undefined,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBatchRunning(false);
    }
  }

  function playBatchItem(item: BatchItem) {
    const firstAudio = item.generation?.audios[0];
    if (!item.generation || !firstAudio) return;
    batchAudioRef.current?.pause();
    const audio = new Audio(audioDownloadUrl(item.generation, firstAudio));
    batchAudioRef.current = audio;
    setSelectedBatchItemId(item.id);
    setPlayingBatchItemId(item.id);
    audio.onended = () => setPlayingBatchItemId(null);
    audio.onpause = () => setPlayingBatchItemId((current) => (current === item.id ? null : current));
    void audio.play().catch((error) => {
      setPlayingBatchItemId(null);
      setNotice(error instanceof Error ? error.message : String(error));
    });
  }

  function applySample(sample: SampleText) {
    updateText(sample.text);
  }

  function applyVoicePreset(preset: VoicePreset) {
    updateVoiceDesign({ caption: preset.caption });
    setMode("voicedesign");
    window.requestAnimationFrame(() => captionRef.current?.focus());
  }

  async function copySettings() {
    await navigator.clipboard.writeText(JSON.stringify(buildPayload(), null, 2));
    setNotice("已複製目前參數。");
  }

  function restoreFromHistory(item: GenerationMetadata) {
    setMode(item.mode);
    const request = item.request as Record<string, unknown>;
    if (item.mode === "reference") {
      updateReference({
        text: item.text,
        noRef: Boolean(request.no_ref ?? true),
        numSteps: Number(request.num_steps ?? 40),
        numCandidates: Number(request.num_candidates ?? 1),
        seed: request.seed == null ? "" : String(request.seed),
        cfgGuidanceMode: (request.cfg_guidance_mode as ReferenceForm["cfgGuidanceMode"]) ?? "independent",
        cfgScaleText: Number(request.cfg_scale_text ?? 3),
        cfgScaleSpeaker: Number(request.cfg_scale_speaker ?? 5),
        cfgMinT: Number(request.cfg_min_t ?? 0.5),
        cfgMaxT: Number(request.cfg_max_t ?? 1)
      });
    } else {
      updateVoiceDesign({
        text: item.text,
        caption: item.caption ?? "",
        numSteps: Number(request.num_steps ?? 40),
        numCandidates: Number(request.num_candidates ?? 1),
        seed: request.seed == null ? "" : String(request.seed),
        cfgGuidanceMode: (request.cfg_guidance_mode as VoiceDesignForm["cfgGuidanceMode"]) ?? "independent",
        cfgScaleText: Number(request.cfg_scale_text ?? 3),
        cfgScaleCaption: Number(request.cfg_scale_caption ?? 3),
        cfgMinT: Number(request.cfg_min_t ?? 0.5),
        cfgMaxT: Number(request.cfg_max_t ?? 1)
      });
    }
  }

  async function deleteHistoryItem(id: string) {
    await fetchJson(`/api/v1/history/${id}`, { method: "DELETE" });
    await refreshHistory();
    if (activeGeneration?.id === id) setActiveGeneration(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>Irodori-TTS Unified Playground</h1>
            <p>Reference Voice 與 VoiceDesign 的單一入口</p>
          </div>
        </div>
        <div className="status-row">
          <StatusPill ok={Boolean(health?.gpu_available)} label={health?.gpu_available ? "GPU Ready" : "CPU / 未偵測 GPU"} />
          <StatusPill
            ok={runtime?.active_mode === "reference"}
            label={`Base ${runtime?.active_mode === "reference" ? "已載入" : "未載入"}`}
          />
          <StatusPill
            ok={runtime?.active_mode === "voicedesign"}
            accent="violet"
            label={`VoiceDesign ${runtime?.active_mode === "voicedesign" ? "已載入" : "未載入"}`}
          />
        </div>
      </header>

      {notice && (
        <div className="notice">
          <AlertCircle size={16} />
          <span>{notice}</span>
        </div>
      )}

      <nav className="playground-nav" aria-label="playground modes">
        <div className="mode-switch" aria-label="model mode switch">
          <TabButton active={mode === "reference"} icon={<Mic2 size={17} />} onClick={() => setMode("reference")}>
            通常版 / Reference Voice
          </TabButton>
          <TabButton active={mode === "voicedesign"} icon={<Wand2 size={17} />} onClick={() => setMode("voicedesign")}>
            VoiceDesign / Caption
          </TabButton>
        </div>
        <div className="jump-links" aria-label="page shortcuts">
          <a className="tab-link" href="#emoji">
            <Palette size={17} />
            Emoji Palette
          </a>
          <a className="tab-link" href="#history">
            <History size={17} />
            Samples
          </a>
          <a className="tab-link" href="#params">
            <BookOpen size={17} />
            參數指引
          </a>
        </div>
      </nav>

      <section className="workspace-grid">
        <div className="left-stack">
          <Panel title="模型設定" icon={<Settings size={18} />}>
            <FieldLabel label="模型 checkpoint" note={{ name: "模型 checkpoint", default: form.checkpoint, range: "HF repo id 或 .safetensors/.pt 路徑", note: "選擇要載入的 Irodori-TTS checkpoint。切換模型時會先卸載目前模型以節省 VRAM。" }} />
            <input
              className="text-input"
              value={form.checkpoint}
              onChange={(event) =>
                mode === "reference"
                  ? updateReference({ checkpoint: event.target.value })
                  : updateVoiceDesign({ checkpoint: event.target.value })
              }
            />
            <div className="runtime-box">
              <div>
                <strong>目前載入</strong>
                <span>{runtime?.active_mode ? `${runtime.active_mode} · ${runtime.active_model_device}` : "尚未載入"}</span>
              </div>
              <div className="segmented">
                <button className={activeLoaded ? "selected" : ""} disabled={loadingModel} onClick={() => void loadModel()}>
                  {loadingModel ? <Loader2 className="spin" size={16} /> : <Download size={16} />} 載入模型
                </button>
                <button disabled={loadingModel || !runtime?.active_mode} onClick={() => void unloadModel()}>
                  <XCircle size={16} /> 卸載
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="基本參數" icon={<SlidersHorizontal size={18} />}>
            <RangeField label="Num Steps" note={noteByName["Num Steps"]} min={1} max={120} value={form.numSteps} onChange={(value) => mode === "reference" ? updateReference({ numSteps: value }) : updateVoiceDesign({ numSteps: value })} />
            <RangeField label="Num Candidates" note={noteByName["Num Candidates"]} min={1} max={32} value={form.numCandidates} onChange={(value) => mode === "reference" ? updateReference({ numCandidates: value }) : updateVoiceDesign({ numCandidates: value })} />
            <InputField label="Seed" note={noteByName["Seed"]}>
              <input
                className="text-input"
                placeholder="空白 = 隨機"
                value={form.seed}
                onChange={(event) => mode === "reference" ? updateReference({ seed: event.target.value }) : updateVoiceDesign({ seed: event.target.value })}
              />
            </InputField>
            <InputField label="CFG Guidance Mode" note={noteByName["CFG Guidance Mode"]}>
              <select
                className="text-input"
                value={form.cfgGuidanceMode}
                onChange={(event) =>
                  mode === "reference"
                    ? updateReference({ cfgGuidanceMode: event.target.value as ReferenceForm["cfgGuidanceMode"] })
                    : updateVoiceDesign({ cfgGuidanceMode: event.target.value as VoiceDesignForm["cfgGuidanceMode"] })
                }
              >
                <option value="independent">independent</option>
                <option value="joint">joint</option>
                <option value="alternating">alternating</option>
              </select>
            </InputField>
            <RangeField label="CFG Scale Text" note={noteByName["CFG Scale Text"]} min={0} max={10} step={0.1} value={form.cfgScaleText} onChange={(value) => mode === "reference" ? updateReference({ cfgScaleText: value }) : updateVoiceDesign({ cfgScaleText: value })} />
            {mode === "reference" ? (
              <>
                <RangeField label="CFG Scale Speaker" note={noteByName["CFG Scale Speaker"]} min={0} max={10} step={0.1} value={referenceForm.cfgScaleSpeaker} onChange={(value) => updateReference({ cfgScaleSpeaker: value })} />
                <AdvancedReference form={referenceForm} update={updateReference} notes={noteByName} />
              </>
            ) : (
              <>
                <RangeField label="CFG Scale Caption" note={noteByName["CFG Scale Caption"]} min={0} max={10} step={0.1} value={voiceForm.cfgScaleCaption} onChange={(value) => updateVoiceDesign({ cfgScaleCaption: value })} />
                <AdvancedVoiceDesign form={voiceForm} update={updateVoiceDesign} notes={noteByName} />
              </>
            )}
          </Panel>
        </div>

        <div className="middle-stack">
          {mode === "voicedesign" && (
            <Panel title="Prompt Builder / 角色設定" icon={<Wand2 size={18} />} badge="僅 VoiceDesign 生效">
              <label className="field-label">角色語音 preset</label>
              <div className="preset-list">
                {presets.voice_presets.map((preset) => (
                  <button key={preset.id} className="preset-button" onClick={() => applyVoicePreset(preset)}>
                    <Star size={15} />
                    {preset.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={captionRef}
                className="caption-textarea"
                value={voiceForm.caption}
                onChange={(event) => updateVoiceDesign({ caption: event.target.value })}
                rows={4}
                placeholder="VoiceDesign caption / style prompt"
              />
            </Panel>
          )}

          {mode === "reference" && (
            <Panel title="Reference Audio" icon={<FileAudio size={18} />}>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={referenceForm.noRef}
                  onChange={(event) => updateReference({ noRef: event.target.checked })}
                />
                不使用 reference audio
              </label>
              <label className="file-drop">
                <Upload size={22} />
                <span>{referenceAudio ? referenceAudio.name : "拖放或點選上傳 WAV / FLAC / MP3"}</span>
                <input
                  type="file"
                  accept="audio/*"
                  disabled={referenceForm.noRef}
                  onChange={(event) => setReferenceAudio(event.target.files?.[0] ?? null)}
                />
              </label>
            </Panel>
          )}

          <Panel title="文本輸入" icon={<Bot size={18} />}>
            <textarea
              ref={textRef}
              value={form.text}
              onChange={(event) => updateText(event.target.value)}
              className="main-textarea"
              rows={5}
            />
            <div className="button-row">
              <button className="ghost-button" onClick={() => updateText("")}>
                <Trash2 size={16} /> 清空
              </button>
              <button className="ghost-button" onClick={() => applySample(presets.sample_texts[0])}>
                <Sparkles size={16} /> 插入測試句
              </button>
              <button className="primary-button" disabled={busy || !activeLoaded} onClick={() => void generate()}>
                {busy ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                Ctrl+Enter 生成
              </button>
            </div>
          </Panel>

          <Panel title="批量生成" icon={<ListChecks size={18} />} badge={`${batchLines.length}/${batchLimit}`}>
            <textarea
              value={batchText}
              onChange={(event) => setBatchText(event.target.value)}
              className="main-textarea batch-textarea"
              rows={6}
              placeholder="一行一段文字，空白行會自動忽略。"
            />
            <div className="batch-meta-row">
              <span>
                目前模式：{mode === "reference" ? "Reference Voice" : "VoiceDesign"} · 共 {batchLines.length} 段
              </span>
              {batchLines.length > batchLimit && <strong>超過 {batchLimit} 段上限</strong>}
            </div>
            <div className="button-row">
              <button
                className="primary-button"
                disabled={batchRunning || busy || !activeLoaded || batchLines.length === 0 || batchLines.length > batchLimit}
                onClick={() => void startBatchGeneration()}
              >
                {batchRunning ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                開始批量生成
              </button>
              <button className="ghost-button" disabled={!batchRunning} onClick={stopBatchGeneration}>
                <XCircle size={16} /> 停止
              </button>
              <button className="ghost-button" disabled={batchRunning || batchItems.length === 0} onClick={clearBatchResults}>
                <Trash2 size={16} /> 清空結果
              </button>
            </div>

            {batchItems.length > 0 && (
              <div className="batch-results">
                <div className="batch-summary">
                  <Metric label="總數" value={String(batchSummary.total)} />
                  <Metric label="完成" value={String(batchSummary.completed)} />
                  <Metric label="失敗" value={String(batchSummary.failed)} />
                  <Metric label="總耗時" value={formatSeconds(batchSummary.elapsed)} />
                </div>
                <div className="batch-result-layout">
                  <div className="batch-list" aria-label="批量生成結果">
                    {batchItems.map((item) => (
                      <BatchItemRow
                        item={item}
                        isSelected={item.id === selectedBatchItemId}
                        isPlaying={item.id === playingBatchItemId}
                        isBusy={batchRunning}
                        key={item.id}
                        onPlay={() => playBatchItem(item)}
                        onPreview={() => setSelectedBatchItemId(item.id)}
                        onRetry={() => void retryBatchItem(item)}
                      />
                    ))}
                  </div>
                  <BatchPreview item={selectedBatchItem} />
                </div>
              </div>
            )}
          </Panel>

          <Panel id="emoji" title="快速插入：Emoji / 語氣" icon={<Palette size={18} />}>
            <div className="emoji-groups">
              {Object.entries(emojiGroups).map(([category, items]) => (
                <div className="emoji-group" key={category}>
                  <div className="group-title">{category}</div>
                  <div className="emoji-grid">
                    {items.map((item) => (
                      <button
                        className="emoji-button"
                        key={`${item.emoji}-${item.zh}`}
                        aria-label={`${item.emoji} ${item.zh} / ${item.ja}`}
                        onClick={() => insertIntoTextarea(item.emoji)}
                      >
                        {item.emoji}
                        <span className="emoji-tooltip" role="tooltip">
                          <strong>{item.zh}</strong>
                          <span>{item.ja}</span>
                          <span>{item.en}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="right-stack">
          <Panel title="生成結果" icon={<Play size={18} />}>
            {!activeGeneration && <EmptyState text="生成完成後會在這裡顯示音訊、seed 與速度資訊。" />}
            {activeGeneration && (
              <GenerationResult generation={activeGeneration} />
            )}
          </Panel>

          <Panel id="history" title="最近生成歷史" icon={<History size={18} />}>
            <div className="history-list">
              {history.length === 0 && <EmptyState text="還沒有生成紀錄。" />}
              {history.map((item) => (
                <HistoryItem
                  item={item}
                  key={item.id}
                  onDelete={() => void deleteHistoryItem(item.id)}
                  onPlay={() => setActiveGeneration(item)}
                  onRestore={() => restoreFromHistory(item)}
                />
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <section className="lower-grid">
        <Panel title="Samples" icon={<Sparkles size={18} />}>
          <div className="sample-grid">
            {presets.sample_texts.map((sample) => (
              <button key={sample.id} className="sample-button" onClick={() => applySample(sample)}>
                <strong>{sample.label}</strong>
                <span>{sample.text}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel id="params" title="參數說明" icon={<BookOpen size={18} />}>
          <ParameterNotes notes={presets.parameter_notes} />
          <button className="ghost-button compact" onClick={() => void copySettings()}>
            <Copy size={16} /> 複製目前參數 JSON
          </button>
        </Panel>
      </section>
    </main>
  );
}

function HistoryItem({
  item,
  onDelete,
  onPlay,
  onRestore
}: {
  item: GenerationMetadata;
  onDelete: () => void;
  onPlay: () => void;
  onRestore: () => void;
}) {
  const firstAudio = item.audios[0];

  return (
    <div className="history-item">
      <button className="history-play" title="播放" onClick={onPlay}>
        <Play size={15} />
      </button>
      <div className="history-main">
        <strong>{item.text.slice(0, 28) || item.id}</strong>
        <span>
          {item.mode} · {formatSeconds(item.duration_seconds)} · RTF {formatNumber(item.rtf)} · Seed {item.seed_used ?? "-"}
        </span>
      </div>
      {firstAudio ? (
        <a className="icon-button" title={`下載 ${firstAudio.filename}`} href={audioDownloadUrl(item, firstAudio)} download={firstAudio.filename}>
          <Download size={15} />
        </a>
      ) : (
        <button className="icon-button" title="沒有可下載的音檔" disabled>
          <Download size={15} />
        </button>
      )}
      <button className="icon-button" title="套用設定" onClick={onRestore}>
        <RotateCcw size={15} />
      </button>
      <button className="icon-button danger" title="刪除" onClick={onDelete}>
        <Trash2 size={15} />
      </button>

      <details className="history-details">
        <summary>
          <SlidersHorizontal size={14} /> 詳情
        </summary>
        <dl className="history-detail-grid">
          <div>
            <dt>Seed</dt>
            <dd>{item.seed_used ?? "-"}</dd>
          </div>
          <div>
            <dt>RTF</dt>
            <dd>{formatNumber(item.rtf)}</dd>
          </div>
          <div>
            <dt>生成時間</dt>
            <dd>{formatSeconds(item.elapsed_seconds)}</dd>
          </div>
          <div>
            <dt>音長</dt>
            <dd>{formatSeconds(item.duration_seconds)}</dd>
          </div>
          <div>
            <dt>取樣率</dt>
            <dd>{item.sample_rate ? `${item.sample_rate} Hz` : "-"}</dd>
          </div>
          <div>
            <dt>建立時間</dt>
            <dd>{formatDateTime(item.created_at)}</dd>
          </div>
        </dl>
        {item.caption && <p className="history-caption">{item.caption}</p>}
        {item.audios.length > 0 && (
          <div className="history-downloads">
            {item.audios.map((audio) => (
              <a className="download-link compact" href={audioDownloadUrl(item, audio)} download={audio.filename} key={audio.index}>
                <Download size={15} /> Candidate {audio.index}
              </a>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

function BatchItemRow({
  item,
  isSelected,
  isPlaying,
  isBusy,
  onPlay,
  onPreview,
  onRetry
}: {
  item: BatchItem;
  isSelected: boolean;
  isPlaying: boolean;
  isBusy: boolean;
  onPlay: () => void;
  onPreview: () => void;
  onRetry: () => void;
}) {
  const generation = item.generation;
  const firstAudio = generation?.audios[0];
  const canUseAudio = item.status === "completed" && generation && firstAudio;
  const rowClass = ["batch-item", isSelected ? "selected" : "", isPlaying ? "playing" : "", item.status].filter(Boolean).join(" ");

  return (
    <div className={rowClass}>
      <div className="batch-index">{item.index}</div>
      <div className="batch-item-main">
        <div className="batch-item-topline">
          <span className={`batch-status ${item.status}`}>{statusLabel(item.status)}</span>
          <strong>{item.text}</strong>
        </div>
        <span className="batch-item-meta">
          Seed {generation?.seed_used ?? "-"} · 音長 {formatSeconds(generation?.duration_seconds)} · RTF {formatNumber(generation?.rtf)} · 耗時 {formatSeconds(generation?.elapsed_seconds)}
        </span>
        {item.error && <span className="batch-error">{item.error}</span>}
      </div>
      <div className="batch-actions">
        <button className="icon-button" title="播放第一個 candidate" disabled={!canUseAudio} onClick={onPlay}>
          <Play size={15} />
        </button>
        <button className="icon-button" title="預覽" disabled={!generation && item.status !== "running"} onClick={onPreview}>
          <SlidersHorizontal size={15} />
        </button>
        {canUseAudio ? (
          <a className="icon-button" title={`下載 ${firstAudio.filename}`} href={audioDownloadUrl(generation, firstAudio)} download={firstAudio.filename}>
            <Download size={15} />
          </a>
        ) : (
          <button className="icon-button" title="沒有可下載的音檔" disabled>
            <Download size={15} />
          </button>
        )}
        <button className="icon-button" title="重試此筆" disabled={isBusy || item.status === "running"} onClick={onRetry}>
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}

function BatchPreview({ item }: { item: BatchItem | null }) {
  if (!item) {
    return (
      <div className="batch-preview">
        <EmptyState text="選取一筆結果後會在這裡試聽。" />
      </div>
    );
  }

  return (
    <div className="batch-preview">
      <div className="batch-preview-header">
        <span>#{item.index}</span>
        <strong>{statusLabel(item.status)}</strong>
      </div>
      <p className="batch-preview-text">{item.text}</p>
      {item.error && <div className="batch-preview-error">{item.error}</div>}
      {item.generation ? (
        <GenerationResult generation={item.generation} />
      ) : (
        <EmptyState text={item.status === "pending" ? "這筆尚未開始生成。" : "等待後端回傳生成狀態。"} />
      )}
    </div>
  );
}

function StatusPill({ ok, label, accent = "green" }: { ok: boolean; label: string; accent?: "green" | "violet" }) {
  return (
    <div className={`status-pill ${ok ? "ok" : ""} ${accent}`}>
      {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      <span>{label}</span>
    </div>
  );
}

function TabButton({
  active,
  icon,
  children,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={`tab-button ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function Panel({
  id,
  title,
  icon,
  badge,
  children
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel" id={id}>
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
        {badge && <span className="panel-badge">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ label, note }: { label: string; note?: ParameterNote }) {
  return (
    <span className="label-with-help">
      <span>{label}</span>
      {note && <HelpTooltip label={label} note={note} />}
    </span>
  );
}

function HelpTooltip({ label, note }: { label: string; note: ParameterNote }) {
  return (
    <span className="tooltip-anchor" tabIndex={0} aria-label={`${label} 說明`}>
      <HelpCircle size={14} />
      <span className="tooltip-box">
        <strong>{note.name}</strong>
        <span>建議 / 範圍：{note.range}</span>
        <span>預設：{note.default}</span>
        <p>{note.note}</p>
      </span>
    </span>
  );
}

function InputField({
  label,
  note,
  children
}: {
  label: string;
  note?: ParameterNote;
  children: React.ReactNode;
}) {
  return (
    <label className="input-field">
      <span className="param-label">{label}</span>
      <span className="input-field-control">{children}</span>
      <span className="param-help-cell">{note && <HelpTooltip label={label} note={note} />}</span>
    </label>
  );
}

function RangeField({
  label,
  note,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  note?: ParameterNote;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span className="param-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <input className="number-input" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="param-help-cell">{note && <HelpTooltip label={label} note={note} />}</span>
    </label>
  );
}

function AdvancedReference({
  form,
  update,
  notes
}: {
  form: ReferenceForm;
  update: (patch: Partial<ReferenceForm>) => void;
  notes: Record<string, ParameterNote>;
}) {
  return (
    <details className="advanced-box">
      <summary>進階參數</summary>
      <RangeField label="CFG Min t" note={notes["CFG Min/Max t"]} min={0} max={1} step={0.01} value={form.cfgMinT} onChange={(value) => update({ cfgMinT: value })} />
      <RangeField label="CFG Max t" note={notes["CFG Min/Max t"]} min={0} max={1} step={0.01} value={form.cfgMaxT} onChange={(value) => update({ cfgMaxT: value })} />
      <label className="toggle-row">
        <input type="checkbox" checked={form.contextKvCache} onChange={(event) => update({ contextKvCache: event.target.checked })} />
        <FieldLabel label="Context KV Cache" note={notes["Context KV Cache"]} />
      </label>
      <div className="mini-grid">
        <div>
          <FieldLabel label="Speaker KV Scale" note={notes["Speaker KV Scale"]} />
          <input className="text-input" placeholder="Speaker KV Scale" value={form.speakerKvScale} onChange={(event) => update({ speakerKvScale: event.target.value })} />
        </div>
        <div>
          <FieldLabel label="Speaker KV Min t" note={{ name: "Speaker KV Min t", default: "0.9", range: "0-1", note: "控制 speaker K/V scaling 在 diffusion timestep 的啟用下限。" }} />
          <input className="text-input" placeholder="Speaker KV Min t" value={form.speakerKvMinT} onChange={(event) => update({ speakerKvMinT: event.target.value })} />
        </div>
        <input className="text-input" placeholder="Max Layers" value={form.speakerKvMaxLayers} onChange={(event) => update({ speakerKvMaxLayers: event.target.value })} />
      </div>
    </details>
  );
}

function AdvancedVoiceDesign({
  form,
  update,
  notes
}: {
  form: VoiceDesignForm;
  update: (patch: Partial<VoiceDesignForm>) => void;
  notes: Record<string, ParameterNote>;
}) {
  return (
    <details className="advanced-box">
      <summary>進階參數</summary>
      <RangeField label="CFG Min t" note={notes["CFG Min/Max t"]} min={0} max={1} step={0.01} value={form.cfgMinT} onChange={(value) => update({ cfgMinT: value })} />
      <RangeField label="CFG Max t" note={notes["CFG Min/Max t"]} min={0} max={1} step={0.01} value={form.cfgMaxT} onChange={(value) => update({ cfgMaxT: value })} />
      <label className="toggle-row">
        <input type="checkbox" checked={form.contextKvCache} onChange={(event) => update({ contextKvCache: event.target.checked })} />
        <FieldLabel label="Context KV Cache" note={notes["Context KV Cache"]} />
      </label>
      <FieldLabel label="Max Caption Len" note={{ name: "Max Caption Len", default: "checkpoint metadata", range: "正整數或空白", note: "限制 VoiceDesign caption token 長度。通常留空交給 checkpoint 設定。" }} />
      <input className="text-input" placeholder="Max Caption Len" value={form.maxCaptionLen} onChange={(event) => update({ maxCaptionLen: event.target.value })} />
    </details>
  );
}

function GenerationResult({ generation }: { generation: GenerationMetadata }) {
  if (generation.status !== "completed") {
    return (
      <div className="running-state">
        <Loader2 className="spin" size={22} />
        <span>{generation.status === "queued" ? "排隊中" : "生成中"}</span>
      </div>
    );
  }
  return (
    <div className="result-stack">
      <div className="metrics">
        <Metric label="時間" value={formatSeconds(generation.elapsed_seconds)} />
        <Metric label="音長" value={formatSeconds(generation.duration_seconds)} />
        <Metric label="RTF" value={formatNumber(generation.rtf)} />
        <Metric label="Seed" value={String(generation.seed_used ?? "-")} />
      </div>
      {generation.audios.map((audio) => (
        <AudioCard key={audio.index} generationId={generation.id} audio={audio} />
      ))}
    </div>
  );
}

function AudioCard({ generationId, audio }: { generationId: string; audio: AudioArtifact }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioUrl = `${audio.url}?t=${generationId}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const targetCanvas = canvas;
    const targetContext = context;
    let cancelled = false;

    async function drawWaveform() {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextCtor();
        const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const data = buffer.getChannelData(0);
        await audioContext.close();
        if (cancelled) return;
        const { width, height } = targetCanvas;
        targetContext.clearRect(0, 0, width, height);
        targetContext.fillStyle = "#ede9fe";
        targetContext.fillRect(0, 0, width, height);
        targetContext.fillStyle = "#7c3aed";
        const bars = 90;
        const step = Math.max(1, Math.floor(data.length / bars));
        for (let i = 0; i < bars; i += 1) {
          let peak = 0;
          for (let j = 0; j < step; j += 1) {
            peak = Math.max(peak, Math.abs(data[i * step + j] ?? 0));
          }
          const barHeight = Math.max(2, peak * height);
          const x = (i / bars) * width;
          targetContext.fillRect(x, (height - barHeight) / 2, width / bars - 2, barHeight);
        }
      } catch {
        const { width, height } = targetCanvas;
        targetContext.clearRect(0, 0, width, height);
        targetContext.fillStyle = "#f1f5f9";
        targetContext.fillRect(0, 0, width, height);
      }
    }

    void drawWaveform();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  return (
    <div className="audio-card">
      <div className="audio-title">Candidate {audio.index}</div>
      <canvas ref={canvasRef} width={520} height={72} />
      <audio controls src={audioUrl} />
      <a className="download-link" href={audioUrl} download={audio.filename}>
        <Download size={16} /> 下載 WAV
      </a>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ParameterNotes({ notes }: { notes: ParameterNote[] }) {
  return (
    <div className="param-list">
      {notes.map((note) => (
        <div className="param-note" key={note.name}>
          <strong>{note.name}</strong>
          <span>預設 {note.default} · {note.range}</span>
          <p>{note.note}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
