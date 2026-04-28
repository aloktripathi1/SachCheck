# SachCheck

**AI-powered, claim-level fact verification for articles *and* images.**
Paste an article URL, raw text, or upload a screenshot — SachCheck extracts every factual claim, cross-references four independent sources in parallel, detects manipulation signals, and streams transparent verdicts back in real time.

---

## Features

| Mode | Input | What it does |
|---|---|---|
| **Article / URL** | News URL or pasted text | Extracts claims → evidence → heuristic score → Claude synthesis |
| **Image Check** | Screenshot, WhatsApp forward, tweet, poster | OCR → claim extraction → manipulation signals → verdict |

### Image Check supports
- WhatsApp / Telegram forwarded misinformation
- Tweet / X post screenshots
- Instagram & Facebook post screenshots
- Viral infographics and political posters
- Newspaper clippings and article headline photos
- Fake "official notice" images

---

## How it works

### Article pipeline
```
Article / URL
     │
     ▼
┌─────────────────────┐
│  Claude Haiku       │  Extracts atomic claims + named entities
└──────────┬──────────┘
           │  parallel evidence gathering
     ┌─────┴──────┬──────────────┬──────────────┐
     ▼            ▼              ▼               ▼
Google FC    Wikipedia       GDELT         ClaimBuster
     └─────┬──────┴──────────────┴──────────────┘
           │  heuristic scoring (11 signals)
           ▼
┌─────────────────────┐
│  Claude Sonnet      │  Synthesises verdict + rationale
└──────────┬──────────┘
           │  SSE stream
           ▼
      React UI
```

### Image pipeline
```
Uploaded image
     │
     ▼
┌─────────────────┐
│  Pillow         │  Resize · sharpen · contrast · crop whitespace
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tesseract OCR  │  Free, multilingual (en + hi)
│  ↓ fallback     │
│  Claude Vision  │  Used only when confidence < 55 %
└────────┬────────┘
         │  extracted text
         ▼
┌─────────────────┐
│  Claude Haiku   │  Atomic claim extraction
└────────┬────────┘
         │  parallel evidence + 9 signal detectors
     ┌───┴────┬──────────────┬──────────┐
     ▼        ▼              ▼          ▼
Google FC  Wikipedia      GDELT     Manipulation
                                     Signals
     └───┬────┴──────────────┴──────────┘
         │
         ▼
┌─────────────────┐
│  Claude Sonnet  │  Final verdict + reasoning
└────────┬────────┘
         │  SSE stream
         ▼
    React UI
```

**9 manipulation signals detected:**
excessive caps · urgency language · "forward this" prompts · no source attribution ·
fake authority claims · missing date · emotional manipulation · satire indicators · trusted outlet mention

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, httpx, BeautifulSoup |
| AI | Anthropic Claude (Haiku for extraction, Sonnet for synthesis, Haiku Vision for OCR fallback) |
| OCR | Tesseract (free, primary) → Claude Vision (fallback) |
| Image processing | Pillow |
| Evidence | Google Fact Check API, Wikipedia, GDELT, ClaimBuster |
| Streaming | Server-Sent Events (SSE) |
| Frontend | Vite, React 18, TypeScript, Tailwind CSS v3, Framer Motion |
| Fonts | Space Grotesk (headings), Inter (body) |

---

## Cost per check

| Check type | Typical cost |
|---|---|
| Article (text/URL) | ~$0.006 |
| Image — Tesseract OCR path | ~$0.004 |
| Image — Claude Vision OCR fallback | ~$0.010 |

---

## Repository layout

```
SachCheck/
├── backend/
│   ├── data/               # Domain trust indexes (Iffy Index, MBFC)
│   ├── models/
│   │   ├── schemas.py      # Article pipeline Pydantic models
│   │   └── image_schemas.py # Image pipeline models + SSE event types
│   ├── pipeline/
│   │   ├── extractor.py        # Claude Haiku claim extraction
│   │   ├── evidence.py         # Google FC · Wikipedia · GDELT · ClaimBuster
│   │   ├── scorer.py           # 11-signal heuristic scorer
│   │   ├── synthesizer.py      # Claude Sonnet verdict synthesis
│   │   ├── image_preprocessing.py  # Pillow image enhancement
│   │   ├── image_ocr.py            # Tesseract + Claude Vision OCR
│   │   ├── image_signals.py        # 9 manipulation signal detectors
│   │   └── image_pipeline.py       # Full image pipeline orchestrator
│   ├── utils/
│   │   └── scraper.py      # URL scraping helper
│   ├── main.py             # FastAPI app + all SSE endpoints
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx          # Responsive nav with mobile menu
│   │   │   ├── HeroSection.tsx
│   │   │   ├── FeaturesSection.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── InputPanel.tsx      # Article input + recent checks
│   │   │   ├── ClaimCard.tsx
│   │   │   ├── ArticleScoreCard.tsx
│   │   │   ├── PipelineVisualizer.tsx
│   │   │   ├── ImageUpload.tsx         # Drag+drop · paste · camera
│   │   │   └── ImageResultsPanel.tsx   # Image verdict UI
│   │   ├── hooks/
│   │   │   ├── useAnalysis.ts      # Article SSE hook
│   │   │   ├── useImageAnalysis.ts # Image SSE hook
│   │   │   └── useRecentChecks.ts  # localStorage recent history
│   │   ├── lib/
│   │   │   ├── api.ts              # fetch wrappers for both pipelines
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── AnalyzePage.tsx
│   │   │   └── ImageCheckPage.tsx  # Image fact-check page
│   │   └── types/index.ts          # Shared TypeScript types
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## Local setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)
- **Tesseract OCR binary** (for free image OCR)

### Install Tesseract (one-time, system-level)

```bash
# Ubuntu / Debian / WSL
sudo apt-get install -y tesseract-ocr tesseract-ocr-hin

# macOS
brew install tesseract

# Windows
# Download installer from https://github.com/UB-Mannheim/tesseract/wiki
```

> If Tesseract is not installed, SachCheck automatically falls back to Claude Vision for OCR — no configuration needed.

---

### Backend

```bash
cd backend
python -m venv .venv

# Linux / macOS / WSL
source .venv/bin/activate

# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `ANTHROPIC_EXTRACT_MODEL` | optional | Defaults to `claude-haiku-4-5-20251001` |
| `ANTHROPIC_SYNTHESIS_MODEL` | optional | Defaults to `claude-sonnet-4-6` |
| `GOOGLE_FC_API_KEY` | optional | Enables Google Fact Check source |
| `CLAIMBUSTER_API_KEY` | optional | Enables ClaimBuster source |
| `FRONTEND_ORIGIN` | optional | CORS origin, default `http://localhost:5173` |

Start the backend:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Verify:

```bash
curl http://127.0.0.1:8000/health
```

---

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # or create frontend/.env manually
```

`frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API reference

### Article pipeline

#### `POST /check`
```json
{ "input": "https://example.com/article  OR  pasted article text" }
```
Returns `{ "check_id": "<uuid>" }`

#### `GET /check/{check_id}/stream`

| Event | Payload |
|---|---|
| `claim_extracted` | `{ id, text, entities }` |
| `source_results` | `{ source_health, stream_token? }` |
| `verdict` | `{ article_verdict, disclaimer }` |
| `done` | `{ status }` |
| `error` | `{ message }` |

---

### Image pipeline

#### `POST /image-check`
Multipart form upload — field name: `file`. Accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/bmp`. Max size: 10 MB.

Returns `{ "check_id": "<uuid>" }`

#### `GET /image-check/{check_id}/stream`

| Event | Payload |
|---|---|
| `preprocessing` | `{ message }` |
| `ocr_running` | `{ message }` |
| `ocr_complete` | `{ ocr: { text, confidence, language, method, word_count } }` |
| `extracting` | `{ message }` |
| `claim_found` | `{ claim: { id, text, entity? } }` |
| `gathering` | `{ message }` |
| `evidence_ready` | `{ evidence_summary }` |
| `signals` | `{ message }` |
| `signals_ready` | `{ signals: [...], signal_score }` |
| `synthesizing` | `{ message }` |
| `verdict` | `{ verdict: { verdict_label, overall_score, band, confidence, reasoning, safer_context, extracted_text, ocr_confidence, ocr_language, extracted_claims, manipulation_signals, signal_score, evidence_summary } }` |
| `done` | `{ status }` |
| `error` | `{ message }` |

---

## Deployment

### Railway / Render (backend)

```bash
# Start command
uvicorn main:app --host 0.0.0.0 --port $PORT

# Build command (include tesseract)
apt-get install -y tesseract-ocr tesseract-ocr-hin && pip install -r requirements.txt
```

Set all env vars from `.env.example` in the platform dashboard.

### Vercel (frontend)

```bash
cd frontend
npm run build   # outputs to dist/
```

Set `VITE_API_URL` to your Railway/Render backend URL in Vercel environment variables.

---

## Notes

- Evidence source failures are isolated — one failing provider never crashes the pipeline.
- Check state is ephemeral; a background TTL reaper cleans up stale checks automatically.
- Images are never stored — processed in-flight and discarded immediately.
- Never commit `.env` files. The `.gitignore` allows only `.env.example` files.

---

## License

[MIT](LICENSE)
