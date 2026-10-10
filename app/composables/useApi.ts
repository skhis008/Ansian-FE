/**
 * HTTP client tunggal untuk seluruh aplikasi.
 *
 * SEMUA request memakai path relatif `/api/v1/...` — selalu origin yang sama,
 * tidak pernah langsung ke Laravel. Alasannya dua:
 *
 * 1. Token tinggal di cookie httpOnly milik server (`server/utils/tokenVault.ts`).
 *    Kalau klien yang memegang token, token itu bisa dicuri skrip yang masuk
 *    lewat XSS, dan aplikasi ini punya input bebas dari pengguna.
 * 2. URL backend tidak perlu diketahui browser, jadi tidak ada CORS dan tidak
 *    ada URL internal yang bocor ke whoever membuka devtools.
 *
 * Route catch-all di `server/routes/api/v1/[...slug].ts` yang memutuskan:
 * mock atau Laravel, menempelkan header `Authorization`, dan me-refresh token
 * sendiri saat 401 `token_expired`. Klien tidak perlu tahu salah satu pun.
 */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  signal?: AbortSignal
  /** Jangan lempar error (untuk polling) */
  silent?: boolean
}

export class ApiError extends Error {
  status: number
  /** Kode stabil dari backend. Cabang di `code`, JANGAN di `message`. */
  code: string | null
  errors: Record<string, string[]>

  constructor(message: string, status: number, errors: Record<string, string[]> = {}, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.code = code
  }

  /** Pesan per-field untuk form (Laravel validation errors) */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.errors).map(([k, v]) => [k, v[0] ?? '']))
  }
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  let url = `/api/v1${path}`
  if (query) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue
      qs.append(k, String(v))
    }
    const s = qs.toString()
    if (s) url += `?${s}`
  }
  return url
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal, silent } = options

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const url = buildUrl(path, query)

  /*
   * SSR: `useRequestFetch()` meneruskan header permintaan yang masuk ke server,
   * termasuk `cookie`. Header itu HARUS diteruskan lewat cara ini.
   *
   * Menyalinnya secara manual (`headers.Cookie = useRequestHeaders(...)`) tidak
   * bekerja: fetch internal Nitro membuang header `cookie` yang disetel manual,
   * jadi route catch-all menerima permintaan tanpa token, `/auth/me` menjawab
   * 401, dan semua halaman berstatus login dialihkan ke `/login` — padahal
   * cookie token-nya ada dan masih sah.
   */
  if (import.meta.server) {
    try {
      return await useRequestFetch()<T>(url, {
        method,
        body: body as Record<string, unknown> | undefined,
        signal,
        credentials: 'include',
        headers,
      })
    } catch (err: unknown) {
      if (silent) return undefined as T
      throw normalizeError(err, silent)
    }
  }

  try {
    const response = await $fetch.raw<T>(url, {
      method,
      body: body as Record<string, unknown> | undefined,
      signal,
      credentials: 'include',
      headers,
    })
    return response._data as T
  } catch (err: unknown) {
    if (silent) return undefined as T
    throw normalizeError(err, silent)
  }
}

function normalizeError(err: unknown, silent?: boolean): ApiError {
  if (err && typeof err === 'object') {
    const anyErr = err as {
      statusCode?: number
      status?: number
      statusMessage?: string
      message?: string
      data?: { message?: string; code?: string; errors?: Record<string, string[]>; statusMessage?: string }
    }
    const status = anyErr.statusCode ?? anyErr.status ?? 500
    const message =
      anyErr.data?.message ??
      (anyErr.statusMessage && anyErr.statusMessage !== 'Unprocessable Entity' ? anyErr.statusMessage : undefined) ??
      anyErr.message ??
      (silent ? '' : 'Terjadi kesalahan jaringan. Coba lagi.')
    return new ApiError(message, status, anyErr.data?.errors ?? {}, anyErr.data?.code ?? null)
  }
  return new ApiError('Terjadi kesalahan yang tidak diketahui.', 500)
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query'], opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'GET', query, ...opts }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'POST', body, ...opts }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'PUT', body, ...opts }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'PATCH', body, ...opts }),
  delete: <T>(path: string, opts?: RequestOptions) => apiRequest<T>(path, { method: 'DELETE', ...opts }),
}