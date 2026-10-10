import { createError, getMethod, type H3Event } from 'h3'
import * as auth from './mockApi/auth'
import * as rides from './mockApi/rides'
import * as admin from './mockApi/admin'

/**
 * ============================================================
 *  MOCK ROUTER — cermin 1:1 dari routes/api.php Laravel
 * ============================================================
 *  Cara pakai:
 *   - Frontend memanggil /api/v1/... (sama persis dengan Laravel)
 *   - Saat backend Laravel aktif: set NUXT_PUBLIC_USE_MOCK=false
 *     lalu file ini boleh dihapus tanpa mengubah kode frontend.
 *  Format: "METHOD /path/:param"
 * ========================================================= */

type Handler = (event: H3Event) => Promise<unknown> | unknown

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
}

function route(method: string, path: string, handler: Handler): Route {
  const keys: string[] = []
  const pattern = new RegExp(
    `^${path
      .split('/')
      .map(seg => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1))
          return '([^/]+)'
        }
        if (seg === '**') return '.*'
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      })
      .join('/')}$`,
  )
  return { method, pattern, keys, handler }
}

const routes: Route[] = [
  /* ---------- AUTH ---------- */
  route('POST', '/api/v1/auth/register', auth.register),
  route('POST', '/api/v1/auth/login', auth.login),
  route('POST', '/api/v1/auth/otp/verify', auth.verifyOtp),
  route('POST', '/api/v1/auth/otp/request', auth.requestOtp),
  route('POST', '/api/v1/auth/logout', auth.logout),
  route('GET', '/api/v1/auth/me', auth.me),
  // TODO backend: BE tidak punya `auth/sessions`. Token Sanctum tidak punya
  // endpoint "daftar sesi", jadi layar ini akan hilang saat mock dimatikan.
  route('GET', '/api/v1/auth/sessions', auth.sessions),


  /* ---------- USERS ---------- */
  // Cerminan `Route::apiResource('users', ...)` + Aturan UserPolicy: daftar dan
  // hapus admin saja, ubah boleh admin atau pemilik akunnya sendiri.
  route('GET', '/api/v1/users', admin.listUsers),
  route('POST', '/api/v1/users', admin.storeUser),
  route('GET', '/api/v1/users/:user', admin.showUser),
  route('PUT', '/api/v1/users/:user', admin.updateUser),
  route('PATCH', '/api/v1/users/:user', admin.updateUser),
  route('DELETE', '/api/v1/users/:user', admin.deleteUser),

  /* ---------- ME ---------- */
  route('GET', '/api/v1/me/summary', auth.homeSummary),

  /* ---------- FARES ---------- */
  route('POST', '/api/v1/fares/quote', rides.quoteFare),

  /* ---------- RIDES ---------- */
  route('GET', '/api/v1/rides', rides.listRides),
  route('POST', '/api/v1/rides', rides.createRide),
  route('GET', '/api/v1/rides/:ride', rides.showRide),
  route('GET', '/api/v1/rides/:ride/route', rides.rideRoute),
  route('POST', '/api/v1/rides/:ride/cancel', rides.cancelRide),
  route('POST', '/api/v1/rides/:ride/rating', rides.rateRide),
  route('POST', '/api/v1/rides/:ride/assign', rides.assignDriver),

  /* ---------- DRIVER ---------- */
  route('GET', '/api/v1/drivers', rides.listDrivers),
  route('GET', '/api/v1/drivers/nearby', rides.nearbyDrivers),
  route('PATCH', '/api/v1/drivers/me', rides.updateMyDriverProfile),
  route('PUT', '/api/v1/driver/profile/availability', rides.setDriverAvailability),
  route('PUT', '/api/v1/driver/profile/location', rides.updateDriverLocation),
  route('GET', '/api/v1/drivers/me/earnings', rides.myEarnings),
  route('GET', '/api/v1/driver/rides/nearby', rides.listNearbyRides),
  // TODO backend: BE tidak punya endpoint penolakan tawaran. Yang ada hanya
  // `POST /rides/{ride}/accept`; driver yang menolak berarti tidak menekan apa pun.
  // Sampai endpointnya dibangun, aksi "tolak" di FE hanya berarti permintaan itu
  // hilang dari daftar terdekat — bukan dikirim ke Laravel yang tidak menerimanya.
  route('POST', '/api/v1/drivers/jobs/:ride/reject', rides.rejectJob),
  route('POST', '/api/v1/rides/:ride/accept', rides.acceptJob),
  route('GET', '/api/v1/drivers/:driver', rides.showDriver),
  route('POST', '/api/v1/rides/:ride/arrive', rides.markArrived),
  route('POST', '/api/v1/rides/:ride/start', rides.startRide),
  route('POST', '/api/v1/rides/:ride/complete', rides.completeRide),

  /* ---------- CHAT ---------- */
  route('GET', '/api/v1/conversations', rides.listConversations),
  route('POST', '/api/v1/conversations', rides.createConversation),
  route('GET', '/api/v1/conversations/:conversation', rides.showConversation),
  route('GET', '/api/v1/messages/:conversation', rides.listMessages),
  route('POST', '/api/v1/conversations/:conversation/messages', rides.sendMessage),
  route('POST', '/api/v1/conversations/:conversation/read', rides.markRead),

  /* ---------- NOTIFICATIONS ---------- */
  route('GET', '/api/v1/notifications', rides.listNotifications),
  route('POST', '/api/v1/notifications/read-all', rides.readAllNotifications),
  route('POST', '/api/v1/notifications/:notification/read', rides.readNotification),

  /* ---------- PAYMENTS ---------- */
  route('GET', '/api/v1/payments/qris', rides.qrisConfig),
  route('GET', '/api/v1/payments', rides.listPayments),
  route('POST', '/api/v1/payments', rides.createPayment),
  route('POST', '/api/v1/payments/webhook', rides.paymentWebhook),
  route('POST', '/api/v1/payments/:payment/webhook', rides.paymentWebhook),

  /* ---------- ADMIN ---------- */
  route('GET', '/api/v1/admin/stats', admin.stats),
  route('GET', '/api/v1/admin/activity', admin.adminActivity),
  route('GET', '/api/v1/admin/charts/daily', admin.chartDaily),
  route('GET', '/api/v1/admin/charts/vehicle-type', admin.chartVehicleType),
  route('GET', '/api/v1/admin/top-drivers', admin.topDrivers),
  route('GET', '/api/v1/admin/rides', admin.adminListRides),
  // TODO backend: tidak ada padanan di BE. Backend sengaja memakai satu endpoint
  // per transisi (`accept`/`arrive`/`start`/`complete`/`cancel`) supaya tidak ada
  // jalan pintas yang bisa melompati langkah, dan administrator pun tidak boleh
  // Designated status seenhack. Layar edit status admin ikut hilang, bukan
  // dikirim ke Laravel yang tidak akan menerimanya.
  route('PATCH', '/api/v1/admin/rides/:ride', admin.adminUpdateRide),
  route('GET', '/api/v1/admin/payments', admin.adminListPayments),
  route('GET', '/api/v1/admin/reports', admin.adminReports),
  route('PATCH', '/api/v1/admin/drivers/:driver', admin.adminUpdateDriver),
  route('POST', '/api/v1/admin/drivers/:driver/verify', admin.verifyDriver),
  route('GET', '/api/v1/admin/settings', admin.getSettings),
  route('PUT', '/api/v1/admin/settings', admin.updateSettings),
]

export function handleApi(event: H3Event): unknown | undefined {
  const method = getMethod(event)
  const path = (event.path || '').split('?')[0]!.replace(/\/+$/, '') || '/'
  if (!path.startsWith('/api/v1')) return undefined

  let pathMatched = false
  for (const r of routes) {
    const m = r.pattern.exec(path)
    if (!m) continue
    pathMatched = true
    if (r.method !== method) continue

    r.keys.forEach((key, i) => {
      event.context.params = { ...(event.context.params ?? {}), [key]: decodeURIComponent(m[i + 1]!) }
    })
    return r.handler(event)
  }

  if (pathMatched) {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  throw createError({ statusCode: 404, data: { message: `Endpoint ${method} ${path} tidak ditemukan.` } })
}
