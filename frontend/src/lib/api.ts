const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

export async function createCheck(input: string): Promise<string> {
  const res = await fetch(`${API_BASE}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error((detail as { detail?: string }).detail ?? `API error ${res.status}`)
  }
  const { check_id } = (await res.json()) as { check_id: string }
  return check_id
}

export function openStream(checkId: string): EventSource {
  return new EventSource(`${API_BASE}/check/${checkId}/stream`)
}

export async function createImageCheck(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/image-check`, { method: 'POST', body: form })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error((detail as { detail?: string }).detail ?? `API error ${res.status}`)
  }
  const { check_id } = (await res.json()) as { check_id: string }
  return check_id
}

export function openImageStream(checkId: string): EventSource {
  return new EventSource(`${API_BASE}/image-check/${checkId}/stream`)
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}
