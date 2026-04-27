# SachCheck

SachCheck is a claim-level credibility analysis app that extracts factual claims from an article (or raw text), gathers supporting evidence, and streams transparent reasoning back to the UI.

## Tech stack

- Backend: Python 3.12, FastAPI, Pydantic v2, SSE, Anthropic SDK, httpx, BeautifulSoup
- Frontend: Vite, React 18, TypeScript, Tailwind CSS, Framer Motion
- Streaming: Server-Sent Events from backend to frontend

## Repository layout

```text
backend/
  data/            # Domain trust indexes and source data
  models/          # Pydantic schemas
  pipeline/        # Extraction, evidence, scoring, synthesis
  utils/           # Scraping and helpers
  main.py          # FastAPI app entrypoint
frontend/
  src/             # React app
```

## How it works

1. User submits an article URL or raw text.
2. Backend extracts atomic claims and named entities.
3. Evidence is gathered from multiple external sources in parallel.
4. A heuristic score is computed.
5. Final synthesis returns verdict + rationale.
6. Progress is streamed as SSE events to the frontend.

## API overview

### `POST /check`

Request:

```json
{ "input": "https://example.com/article or pasted text" }
```

Response:

```json
{ "check_id": "<uuid>" }
```

### `GET /check/{check_id}/stream`

SSE events emitted by the backend:

- `claim_extracted`
- `source_results`
- `verdict`
- `error` (if any)
- `done`

## Local setup

### Backend

```bash
cd backend
python -m venv .venv

# Linux/macOS/WSL
source .venv/bin/activate

# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
```

Set required variables in `backend/.env`:

- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_EXTRACT_MODEL` (optional)
- `ANTHROPIC_SYNTHESIS_MODEL` (optional)
- `GOOGLE_FC_API_KEY` (optional)
- `CLAIMBUSTER_API_KEY` (optional)
- `FRONTEND_ORIGIN` (optional, for custom CORS origin)

Run backend:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` with:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run frontend:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## Notes

- External source failures are isolated so one failing provider does not crash the entire run.
- Check state is ephemeral and cleaned up by a background TTL reaper.
- Do not commit `.env` files or local cache/build artifacts.
