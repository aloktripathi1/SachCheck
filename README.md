# SachCheck

**AI-powered, claim-level fact verification.** Paste an article URL or raw text — SachCheck extracts every factual claim, cross-references four independent sources in parallel, and streams transparent verdicts back in real time.

---

## How it works

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
           │  heuristic scoring
           ▼
┌─────────────────────┐
│  Claude Sonnet      │  Synthesises verdict + rationale
└──────────┬──────────┘
           │  SSE stream
           ▼
      React UI
```

Each step is streamed as an SSE event so the UI updates progressively — no polling, no waiting for the full pipeline to finish.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, httpx, BeautifulSoup |
| AI | Anthropic Claude (Haiku for extraction, Sonnet for synthesis) |
| Evidence | Google Fact Check API, Wikipedia, GDELT, ClaimBuster |
| Streaming | Server-Sent Events (SSE) |
| Frontend | Vite, React 18, TypeScript, Tailwind CSS v3, Framer Motion |
| Fonts | Space Grotesk (headings), Inter (body) |

---

## Repository layout

```
SachCheck/
├── backend/
│   ├── data/           # Domain trust indexes and source weights
│   ├── models/         # Pydantic request/response schemas
│   ├── pipeline/       # Extraction → evidence → scoring → synthesis
│   ├── utils/          # URL scraping and shared helpers
│   ├── main.py         # FastAPI app + SSE endpoints
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/ # UI components (ClaimCard, InputPanel, …)
│   │   ├── hooks/      # useAnalysis (SSE), useRecentChecks
│   │   ├── lib/        # api.ts, utils, mock data
│   │   ├── pages/      # AnalyzePage, LandingPage
│   │   └── types/      # Shared TypeScript types
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

Edit `backend/.env` and fill in the required values:

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

Verify it's up:

```bash
curl http://127.0.0.1:8000/health
```

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

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API reference

### `POST /check`

Submit an article for analysis.

**Request**
```json
{ "input": "https://example.com/article  OR  pasted article text" }
```

**Response**
```json
{ "check_id": "550e8400-e29b-41d4-a716-446655440000" }
```

### `GET /check/{check_id}/stream`

SSE stream of analysis events.

| Event | Payload |
|---|---|
| `claim_extracted` | `{ id, text, entities }` |
| `source_results` | `{ claim_id, sources: [...] }` |
| `verdict` | `{ claim_id, verdict, rationale, score }` |
| `done` | `{ article_score, signals_fired }` |
| `error` | `{ message }` |

---

## Notes

- Evidence source failures are isolated — one failing provider never crashes the pipeline.
- Check state is ephemeral; a background TTL reaper cleans up stale checks automatically.
- Never commit `.env` files. The `.gitignore` tracks `.env.example` files only.

---

## License

[MIT](LICENSE)
