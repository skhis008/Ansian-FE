import type { H3Event } from 'h3'
import { deleteCookie, getCookie, getHeader, getRequestURL, setCookie } from 'h3'

/**
 * Penyimpanan token di sisi server.
 *
 * Token Laravel tidak pernah masuk ke browser. `useApi` di klien memanggil
 * `/api/v1/*` di origin yang sama, route catch-all membacanya dari sini,
 * menempelkan header `Authorization`, lalu meneruskan ke Laravel.
 *
 * Alasannya satu: token di `localStorage` bisa dibaca skrip apa pun yang
 * berhasil masuk lewat XSS, dan aplikasi ini punya input bebas dari pengguna
 * (alamat jemput, chat, komentar penilaian). Dengan token berhenti di server,
 * skrip yang disuntik masih bisa mengirim request, tapi tidak bisa mengambil token.
 *
 * Dua token disimpan terpisah karena umurnya berbeda: access berumur pendek dan
 * dipakai setiap request, refresh berumur panjang dan hanya boleh menyentuh
 * `POST /auth/refresh`. Kalau keduanya disatukan, refresh token ikut terkirim ke
 * setiap endpoint, sehingga keduanya sama habitat di depan server yang salah dan
 * tidak bisa dicabut sendiri — persis yang
 * `config/tokens.php` BE coba cegah dengan ability `access` dan `refresh`.
 */

const ACCESS_COOKIE = 'ans_at'
const REFRESH_COOKIE = 'ans_rt'
const MAX_AGE_DAYS = 30

/**
 * `Secure` cookie hanya boleh dipasang di origin yang benar-benar HTTPS.
 *
 * Menentukannya dari `NODE_ENV` adalah kesalahan: build produksi tetap bisa
 * dijalankan di atas http://127.0.0.1 saat pengembangan, dan `NODE_ENV`
 * sudah `production` di sana. Akibatnya cookie bertanda `Secure` tidak dikirim
 * browser sama sekali — gejalanya login "berhasil" tapi setiap request
 * berikutnya `unauthenticated`, dan penyebabnya tidak kelihatan dari mana pun.
 *
 * Yang benar adalah menanyakan scheme request-nya. `X-Forwarded-Proto` dibaca
 * lebih dulu karena di belakang reverse proxy, HTTPS diteruskan sebagai header,
 * dan header itu hanya dipercaya bila request memang datang lewat proxy.
 */
function isSecure(event: H3Event): boolean {
  const forwarded = getHeader(event, 'x-forwarded-proto')
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim() === 'https'
  }

  return getRequestURL(event).protocol === 'https:'
}

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export function readAccessToken(event: H3Event): string | null {
  return getCookie(event, ACCESS_COOKIE) ?? null
}

export function readRefreshToken(event: H3Event): string | null {
  return getCookie(event, REFRESH_COOKIE) ?? null
}

/**
 * Menyimpan pasangan token hasil login, refresh, atau registrasi.
 *
 * `path` HARUS `/`, bukan `/api`. Ini sempat disempitkan dan akibatnya merusak
 * SSR: cookie hanya terkirim ke `/api/*`, sehingga request browser ke `/admin`
 * atau `/customer` tiba tanpa cookie sama sekali. Waktu SSR merender halaman
 * itu, server tidak punya apa pun untuk diteruskan ke route catch-all,
 * `/auth/me` menjawab 401, dan semua halaman berstatus login terlempar ke
 * `/login` — padahal cookie token-nya ada dan masih sah. Gejalanya seperti
 * session hilang, padahal penyebabnya cookie yang tidak pernah dikirim.
 *
 * `path=/` tidak melemahkan apa pun di sini: cookie-nya tetap `httpOnly` (tidak
 * terbaca JavaScript) dan tetap sebatas origin (tidak terkirim ke domain lain).
 */
export function writeTokens(event: H3Event, tokens: TokenPair): void {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure(event),
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  }

  setCookie(event, ACCESS_COOKIE, tokens.access_token, options)
  setCookie(event, REFRESH_COOKIE, tokens.refresh_token, options)
}

/**
 * Menghapus kedua token. Dipanggil saat logout, dan saat refresh ditolak karena
 * refresh token sudah dipakai — memakai token yang sudah di-*rotate* berarti ada
 * salinan yang dipakai orang lain, jadi sesi lokal harus dibersihkan supaya
 * klien tidak mencoba memakai token yang sudah tidak berlaku.
 */
export function clearTokens(event: H3Event): void {
  // Path harus sama persis dengan saat cookie ditulis. Browser mencocokkan
  // cookie untuk dihapus berdasarkan nama + path + domain, jadi `deleteCookie`
  // dengan path yang berbeda diam-diam tidak menghapus apa pun — dan cookie
  // yang tertinggal berarti "logout" tidak benar-benar mengakhiri sesi.
  deleteCookie(event, ACCESS_COOKIE, { path: '/' })
  deleteCookie(event, REFRESH_COOKIE, { path: '/' })
}

/**
 * Membaca pasangan token dari respons Laravel dan menyimpannya.
 *
 * Mengembalikan `true` kalau pasangan itu memang ada. Pemanggil memakai nilai
 * ini untuk membedakan "ini respons login" dari "ini respons biasa", karena
 * banyak endpoint sah yang tidak membawa token.
 */
export function captureTokens(event: H3Event, payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false
  const data = (payload as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return false

  const candidate = data as Partial<TokenPair>
  if (typeof candidate.access_token !== 'string' || typeof candidate.refresh_token !== 'string') return false

  writeTokens(event, { access_token: candidate.access_token, refresh_token: candidate.refresh_token })
  return true
}