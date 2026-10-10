import type { H3Event } from 'h3'
import { createError, defineEventHandler, getMethod, getQuery, readBody, setResponseHeader, setResponseStatus } from 'h3'
import { handleApi } from '../../../utils/apiRouter'
import { captureTokens, clearTokens, readAccessToken, readRefreshToken } from '../../../utils/tokenVault'

/**
 * ==================================================================
 *  CATCH-ALL /api/v1/**
 * ==================================================================
 *  Dua mode, satu path:
 *
 *  - `useMock = true`  → `handleApi`, mock bawaan (server/utils/mockApi)
 *  - `useMock = false` → proxy ke Laravel, token diambil dari cookie httpOnly
 *
 *  Browser TIDAK PERNAH memanggil Laravel secara langsung. Semua request lewat
 *  sini, sama origin, tanpa CORS, dan tanpa URL backend yang diketahui klien.
 *
 *  Yang dipegang file ini:
 *
 *  1. Token tidak pernah masuk ke browser (`server/utils/tokenVault.ts`)
 *  2. `POST /auth/refresh` otomatis saat Laravel menjawab 401 `token_expired`,
 *     lalu request diulang sekali — supaya 15 menit masa access token tidak
 *     berarti pengguna terlempar ke halaman login
 *  3. `unauthenticated` yang tidak bisa diperbaiki oleh refresh akan menghapus
 *     cookie token, supaya klien berhenti mencoba memakai token yang sudah mati
 *  4. Header yang bisa dipakai server untuk memalsukan permintaan (Host,
 *     Content-Length, Cookie, dan seluruh `X-Forwarded-*`) tidak diteruskan
 */

const NO_PASSTHROUGH = new Set([
  'host',
  'content-length',
  'cookie',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'authorization',
  'accept-encoding',
])

function forwardedHeaders(event: H3Event): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const [key, value] of Object.entries(event.headers)) {
    const lower = key.toLowerCase()
    if (NO_PASSTHROUGH.has(lower)) continue
    // Header proxy adalah instruksi dari klien. Meneruskannya tanpa penyaringan
    // memungkinkan klien-who pun menyamar sebagai reverse proxy di depan server.
    if (lower.startsWith('x-forwarded-')) continue
    if (lower === 'x-api-mock') continue
    if (typeof value === 'string') headers[key] = value
  }

  headers.accept = headers.accept ?? 'application/json'
  return headers
}

/** Bentuk respons Laravel yang dipakai FE: `{ message, code?, data }`. */
interface LaravelEnvelope {
  message?: string
  code?: string
  data?: unknown
  errors?: Record<string, string[]>
}

async function callLaravel(
  event: H3Event,
  path: string,
  method: string,
  body: unknown,
  accessToken: string | null,
): Promise<{ payload: unknown; status: number }> {
  const base = (useRuntimeConfig(event).apiBase as string).replace(/\/$/, '')
  const url = `${base}/api/v1${path}`

  const headers = forwardedHeaders(event)
  if (accessToken) headers.authorization = `Bearer ${accessToken}`

  const init: Parameters<typeof $fetch.raw>[1] = {
    method: method as 'GET',
    headers,
    // Timeout pendek: proxy yang menggantung lebih buruk daripada yang gagal
    // cepat, karena pengguna melihat spinner yang tidak berakhir.
    timeout: 15000,
  }

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['content-type'] = headers['content-type'] ?? 'application/json'
    init.body = body as Record<string, unknown>
  }

  try {
    const res = await $fetch.raw(url, init)
    return { payload: res._data, status: res.status }
  } catch (err: unknown) {
    // `$fetch` melempar untuk status 4xx/5xx, dan objek error-nya sudah
    // memuat body asli. Body itu diteruskan supaya kode galat dan `errors`
    // dari validasi Laravel tidak hilang di tengah.
    const anyErr = err as { response?: { _data?: unknown; status?: number }; status?: number; data?: unknown }
    if (anyErr?.response?._data !== undefined) {
      return { payload: anyErr.response._data, status: anyErr.response.status ?? 500 }
    }
    if (anyErr?.data !== undefined) {
      return { payload: anyErr.data, status: anyErr.status ?? 500 }
    }
    throw createError({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      data: {
        message: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.',
        code: 'http_error',
      },
    })
  }
}

/**
 * Meminta pasangan token baru dengan refresh token yang tersimpan.
 *
 * Mengembalikan `null` kalau tidak ada refresh token, atau kalau Laravel
 * menolak. Penolakan di sini berarti refresh token sudah dipakai — Laravel
 * me-*rotate* token setiap kali dipakai, jadi pemakaian ulang adalah tanda ada
 * salinan lain. Cookie lokal dibersihkan supaya klien berhenti mencoba.
 */
async function refreshTokens(
  event: H3Event,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const refreshToken = readRefreshToken(event)
  if (!refreshToken) return null

  const base = (useRuntimeConfig(event).apiBase as string).replace(/\/$/, '')
  const headers = forwardedHeaders(event)
  headers.authorization = `Bearer ${refreshToken}`
  headers['content-type'] = 'application/json'

  try {
    const res = await $fetch.raw(`${base}/api/v1/auth/refresh`, { method: 'POST', headers, timeout: 15000 })
    const payload = res._data as { data?: { access_token?: string; refresh_token?: string } }
    const access = payload?.data?.access_token
    const nextRefresh = payload?.data?.refresh_token
    if (typeof access !== 'string' || typeof nextRefresh !== 'string') return null

    captureTokens(event, payload)
    return { access_token: access, refresh_token: nextRefresh }
  } catch {
    clearTokens(event)
    return null
  }
}

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)

  if (config.public.useMock) {
    setResponseHeader(event, 'x-api-mock', 'true')
    return handleApi(event)
  }

  // `event.path` dipakai, bukan `getRequestURL()`, karena `apiRouter` memakainya
  // juga dan keduanya harus melihat path yang sama persis.
  const [rawPath = '/'] = (event.path || '/').split('?')
  const path = rawPath.replace(/^\/api\/v1/, '') || '/'
  const method = getMethod(event).toUpperCase()
  const query = getQuery(event)

  const queryString = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach(v => queryString.append(key, String(v)))
    else queryString.append(key, String(value))
  }
  const search = queryString.toString()

  const target = search ? `${path}?${search}` : path
  const body = method === 'GET' || method === 'HEAD' ? undefined : await safeBody(event)
  let accessToken = readAccessToken(event)

  // Percobaan pertama. Kalau `unauthenticated`, `login` dan `register` memang
  // tidak akan punya token — itu jawaban yang benar, bukan sesi yang rusak.
  let result = await callLaravel(event, target, method, body, accessToken)

  const envelope = result.payload as LaravelEnvelope | null
  const needsRefresh = result.status === 401 && envelope?.code === 'token_expired'

  if (needsRefresh && accessToken) {
    const refreshed = await refreshTokens(event)
    if (refreshed) {
      accessToken = refreshed.access_token
      result = await callLaravel(event, target, method, body, accessToken)
    }
  }

  const finalEnvelope = result.payload as LaravelEnvelope | null

  /*
   * Cookie dibersihkan di dua tempat, dan keduanya memang perlu.
   *
   * Logout yang sukses: Laravel sudah mencabut token, jadi jawabannya 200 dan
   * bukan 401. Kalau cookie tidak dihapus di sini, token mati tetap tinggal di
   * browser sampai request berikutnya datang — dan logout yang terlihat berhasil
   * padahal sesinya masih tersimpan di perangkat.
   *
   * 401 `unauthenticated`: token sudah tidak berlaku dan tidak bisa diperbaiki.
   */
  if ((method === 'POST' && path === '/auth/logout' && result.status < 300) ||
      (result.status === 401 && finalEnvelope?.code === 'unauthenticated')) {
    clearTokens(event)
  }

  // Login, register, dan refresh membawa pasangan token. Disimpan di cookie
  // httpOnly, dan TIDAK dikembalikan ke browser — klien hanya butuh `user`.
  const finalData = finalEnvelope?.data as Record<string, unknown> | undefined
  if (result.status < 300 && finalData && typeof finalData.access_token === 'string') {
    captureTokens(event, result.payload)
    delete finalData.access_token
    delete finalData.refresh_token
  }

  setResponseStatus(event, result.status)
  setResponseHeader(event, 'cache-control', 'no-store')

  /*
   * Respons diteruskan sebagai objek, bukan byte mentah.
   *
   * Alasannya `stripBackendUrl` di bawah: ia harus menulis ulang tautan
   * paginasi yang dibangun Laravel dari `APP_URL`, dan itu mustahil dilakukan
   * pada byte yang tidak pernah diurai.
   *
   * Yang dikorbankan karena pilihan ini: bentuk float. JavaScript hanya punya
   * satu tipe angka, jadi `100.0` dari backend tiba di klien sebagai `100`
   * setelah diurai lalu disusun ulang. Untuk klien JavaScript itu tidak
   * berbeda — keduanya angka yang sama. Yang bisa terganggu adalah klien yang
   * membaca spesifikasi dan memperlakukan tipe float sebagai pengaman
   * deserialisasi.
   *
   * Backend sudah memakai `JSON_PRESERVE_ZERO_FRACTION` (ADR-038) supaya
   * bentuknya benar bagi konsumen yang membaca respons secara langsung,
   * termasuk Swagger UI. Yang hilang di sini hanya lintas proxy.
   */
  return stripBackendUrl(result.payload)
})

/**
 * Mengubah URL backend di dalam payload menjadi path relatif.
 *
 * Laravel membangun tautan paginasi absolut dari `APP_URL`, jadi
 * `GET /users?page=2` datang membawa `links.next` seperti
 * `http://127.0.0.1:8000/api/v1/users?page=2`. Tanpa langkah ini URL internal
 * ada di respons yang sampai ke browser — persis yang dikomitmenkan proxy ini
 * untuk cegah, jadi memproxy-nya saja tidak cukup.
 *
 * Yang diganti hanya prefix yang persis. String lain tidak disentuh, dan
 * `base` selalu diakhiri `/` supaya `http://api.example.com` tidak ikut
 * mencabut `http://api.example.com.evil.test`.
 */
function stripBackendUrl(payload: unknown): unknown {
  const base = (useRuntimeConfig().apiBase as string).replace(/\/$/, '')
  if (!base) return payload

  const rewrite = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value.startsWith(base) ? value.slice(base.length) || '/' : value
    }
    if (Array.isArray(value)) return value.map(rewrite)
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>
      for (const key of Object.keys(record)) {
        record[key] = rewrite(record[key])
      }
    }
    return value
  }

  return rewrite(payload)
}

async function safeBody(event: H3Event): Promise<unknown> {
  try {
    return (await readBody(event)) ?? {}
  } catch {
    return {}
  }
}