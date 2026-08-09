// ── PaperTrail API client (static export → talks to the API service) ──────────────

const RAW_API = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Normalize the API base URL — the build env var carries the bare subdomain. */
export const API_BASE: string = (() => {
  const v = RAW_API.trim().replace(/\/+$/, '');
  if (!v) return '';
  return v.startsWith('http') ? v : `https://${v}`;
})();

export function apiConfigured(): boolean {
  return API_BASE.length > 0;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('pt_token');
}

export function setToken(token: string): void {
  window.localStorage.setItem('pt_token', token);
}

export function clearToken(): void {
  window.localStorage.removeItem('pt_token');
}

export function getUser(): { id: string; username: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('pt_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; username: string };
  } catch {
    return null;
  }
}

export function setUser(user: { id: string; username: string }): void {
  window.localStorage.setItem('pt_user', JSON.stringify(user));
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the PaperTrail API. Check the network or API configuration.');
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

// ── Types ────────────────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  created_at: string;
  document_count?: string;
  ready_count?: string;
}

export interface DocumentRow {
  id: string;
  collection_id: string;
  filename: string;
  mime_type: string;
  size_bytes: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  error: string | null;
  page_count: number | null;
  char_count: number | null;
  created_at: string;
}

export interface SearchHit {
  id: string;
  documentId: string;
  title: string;
  page: number | null;
  chunkIndex: number;
  text: string;
  highlighted: string;
}

export interface ChatSource {
  documentId: string;
  title: string;
  page: number | null;
  text: string;
}

export interface ChatResponse {
  question: string;
  answer: string;
  sources: ChatSource[];
  mode: 'llm' | 'extractive';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
