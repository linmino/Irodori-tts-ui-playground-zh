# Irodori-TTS Unified Playground

獨立前後端版 Irodori-TTS playground。前端使用 React/Vite，後端使用 FastAPI，推理核心包住 `Aratako/Irodori-TTS` 的 `InferenceRuntime`，並提供 unified model lifecycle：同一時間只允許載入 `reference` 或 `voicedesign` 其中一個模型。

## 專案結構

```text
backend/
  app/
    main.py              # FastAPI routes
    runtime_manager.py   # 單模型 runtime 載入、卸載、生成
    schemas.py           # API schema
    history_store.py     # outputs metadata 與 job state
    presets.py           # emoji / voice presets / parameter notes
frontend/
  src/
    pages/Playground.tsx # 主 UI
    data/presets.ts      # 前端型別與 fallback data
outputs/                 # 生成音檔與 metadata，執行時自動建立
```

## 後端啟動

先安裝上游 Irodori-TTS 與本服務依賴，確保 Python 環境可以 import `irodori_tts`。

```bash
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir backend
```

若只要檢查 API metadata，沒有安裝 `irodori_tts` 也能啟動；但呼叫 `/api/v1/models/load` 會回傳明確錯誤。

## 前端啟動

```bash
cd frontend
npm install
npm run dev
```

Vite 會把 `/api` proxy 到 `http://127.0.0.1:8000`。

## 主要 API

- `GET /api/v1/health`
- `GET /api/v1/models`
- `POST /api/v1/models/load`
- `POST /api/v1/models/unload`
- `POST /api/v1/generations`
- `GET /api/v1/generations/{id}`
- `GET /api/v1/generations/{id}/audio/{index}`
- `GET /api/v1/history`
- `DELETE /api/v1/history/{id}`
- `GET /api/v1/presets`
- `POST /api/v1/tts.wav`

## 設計限制

- 第一版鎖定本機單人使用。
- 不提供登入、多人隔離或 rate limit。
- Base/reference 與 VoiceDesign 只允許同時載入一個模型。
- 歷史紀錄保存為 `outputs/{generation_id}/metadata.json` 與 WAV 檔。
