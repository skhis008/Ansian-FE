import type { H3Event } from 'h3'
import { createError, getQuery, getRouterParam, setResponseStatus } from 'h3'
import type {
  DashboardStats,
  DriverProfile,
  Payment,
  RevenueByVehicleType,
  SystemSetting,
  TopDriver,
  User,
} from '#shared/types'
import {
  authUser,
  db,
  delay,
  emailRule,
  findOr404,
  minRule,
  paginate,
  queryList,
  readPayload,
  resource,
  requireRole,
  validate,
} from '../api'
import {
  buildChartSeries,
  driverById,
  nowIso,
  paymentsForRide,
  rideWithRelations,
  userById,
} from './db'

/** GET /api/v1/admin/stats */
export async function stats(event: H3Event) {
  requireRole(event, 'admin')
  const rides = db.rides
  const today = new Date().toISOString().slice(0, 10)
  const ridesToday = rides.filter(r => r.created_at.slice(0, 10) === today)
  const completed = rides.filter(r => r.status === 'completed')
  const cancelled = rides.filter(r => isRideCancelled(r.status))
  // Hanya perjalanan selesai. Perjalanan yang dibatalkan pernah punya harga di
  // kalkulator, tapi uangnya tidak pernah berpindah — sama seperti aturan di
  // `AdminDashboardController` sisi backend (ADR-038).
  const gmv = completed.reduce((a, r) => a + r.fare, 0)
  // Mock tidak menyimpan jumlah penilaian per driver, jadi semua yang punya
  // rating ikut dihitung. Backend menghitung hanya yang `rating_count > 0`.
  const rated = db.drivers.filter(d => d.rating > 0)

  const payload: DashboardStats = {
    total_rides: rides.length,
    rides_in_period: ridesToday.length,
    total_users: db.users.length,
    customers: db.users.filter(u => u.role === 'user').length,
    drivers: db.users.filter(u => u.role === 'driver').length,
    online_drivers: db.drivers.filter(d => d.status !== 'offline').length,
    active_rides: rides.filter(r => isRideActive(r.status)).length,
    gmv_in_period: ridesToday.filter(r => r.status === 'completed').reduce((a, r) => a + r.fare, 0),
    average_fare: completed.length ? Math.round(gmv / completed.length) : 0,
    completion_rate: rides.length ? Number(((completed.length / rides.length) * 100).toFixed(1)) : 0,
    cancellation_rate: rides.length ? Number(((cancelled.length / rides.length) * 100).toFixed(1)) : 0,
    average_driver_rating: Number(((rated.reduce((a, d) => a + d.rating, 0) / (rated.length || 1)).toFixed(2))),
    rides_change_pct: 0,
    gmv_change_pct: 0,
  }
  return resource(payload)
}

/**
 * GET /api/v1/admin/charts/daily?days=14
 *
 * Backend menyajikan satu deret harian, bukan dua: grafik perjalanan dan grafik
 * GMV membaca titik yang sama. Endpoint `charts/revenue` versi lama tidak
 * diteruskan: isinya persentase pendapatan platform yang tidak ada di sistem ini.
 */
export async function chartDaily(event: H3Event) {
  requireRole(event, 'admin')
  const days = Math.min(90, Number(getQuery(event).days) || 14)
  return resource(buildChartSeries(days))
}

/** GET /api/v1/admin/charts/vehicle-type */
function revenueByVehicleType(): RevenueByVehicleType[] {
  const completed = db.rides.filter(r => r.status === 'completed')
  const total = completed.reduce((a, r) => a + r.fare, 0) || 1
  const types: RevenueByVehicleType[] = [
    { vehicle_type: 'motorcycle', label: 'Motor', rides: 0, gmv: 0, percentage: 0 },
  ]
  for (const r of completed) {
    if (!r.driver_id) continue
    const d = db.drivers.find(x => x.id === r.driver_id)
    if (!d) continue
    const t = types.find(x => x.vehicle_type === d.vehicle_type)
    if (!t) continue
    t.rides += 1
    t.gmv += r.fare
  }
  for (const t of types) t.percentage = Number(((t.gmv / total) * 100).toFixed(1))
  return types
}

/** GET /api/v1/admin/charts/vehicle-type */
export async function chartVehicleType(event: H3Event) {
  requireRole(event, 'admin')
  return resource(revenueByVehicleType())
}

/** GET /api/v1/admin/top-drivers */
export async function topDrivers(event: H3Event) {
  requireRole(event, 'admin')
  const list: TopDriver[] = db.drivers
    .map(d => driverById(d.id)!)
    .sort((a, b) => b.total_rides - a.total_rides)
    .slice(0, 8)
    .map(d => ({
      id: d.id,
      name: d.user.name,
      avatar_url: d.user.avatar_url,
      vehicle_plate: d.vehicle_plate,
      total_rides: d.total_rides,
      gmv: d.earnings_month,
      collected_cash: d.earnings_month,
    }))
  return resource(list)
}

/**
 * Cerminan `Route::apiResource('users', UserController::class)` beserta
 * `App\Policies\UserPolicy`. Tiga aturan di policy itu yang ikut disalin di sini,
 * karena menyalin endpoint tanpa aturan yang sama berarti mock lebih longgar
 * dari backend — dan yang longgar justru yang dipakai selama mock masih hidup.
 *
 * - `viewAny`: daftar user hanya untuk admin
 * - `update`: admin boleh semua field, user biasa hanya akunnya sendiri
 * - `delete`: admin saja, dan tidak boleh akun sendiri
 */

/** GET /api/v1/users */
export async function listUsers(event: H3Event) {
  requireRole(event, 'admin')
  const list = queryList(db.users, event, {
    search: ['name', 'email', 'phone'],
    filters: {
      role: (u, v) => u.role === v,
      status: (u, v) => u.status === v,
    },
    sort: { created_at: 'desc', name: 'asc' },
  })
  const page = paginate(list, event, 15)
  return { data: page.data, links: page.links, meta: page.meta }
}

/** POST /api/v1/users */
export async function storeUser(event: H3Event) {
  requireRole(event, 'admin')
  const body = await readPayload(event)
  validate(body, {
    name: (v: unknown) => (typeof v === 'string' && v.trim().length >= 3 ? null : 'Nama minimal 3 karakter.'),
    email: emailRule(),
    password: minRule(8, 'Password'),
  })
  const email = String(body.email).trim().toLowerCase()
  if (db.users.some(u => u.email.toLowerCase() === email)) {
    throw createError({
      statusCode: 422,
      data: { message: 'Email sudah terdaftar.', errors: { email: ['Email sudah terdaftar.'] } },
    })
  }
  db.counters.user += 1
  const user: User = {
    id: db.counters.user,
    name: String(body.name).trim(),
    email,
    phone: body.phone ? String(body.phone) : '',
    role: (['user', 'driver', 'admin'].includes(String(body.role)) ? body.role : 'user') as User['role'],
    avatar_url: null,
    status: 'active',
    rating: null,
    rating_count: 0,
    email_verified_at: nowIso(),
    phone_verified_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  }
  db.users.push(user)
  db.passwords.set(email, String(body.password))
  setResponseStatus(event, 201)
  return resource(user, { message: 'Pengguna berhasil dibuat.' })
}

/** GET /api/v1/users/{user} */
export async function showUser(event: H3Event) {
  const actor = authUser(event)
  const id = Number(getRouterParam(event, 'user'))
  // `UserPolicy::view` — admin siapa pun, selain itu hanya dirinya sendiri.
  if (actor.role !== 'admin' && actor.id !== id) {
    throw createError({ statusCode: 403, data: { message: 'Anda tidak punya akses ke resource ini.' } })
  }
  const user = findOr404(userById(id), 'Pengguna tidak ditemukan.')
  const rides = db.rides.filter(r => r.customer_id === id)
  const profile = db.drivers.find(d => d.user_id === id)
  return resource({
    ...user,
    driver: profile ?? null,
    stats: {
      total_rides: rides.length,
      completed_rides: rides.filter(r => r.status === 'completed').length,
      total_spent: rides.filter(r => r.status === 'completed').reduce((a, r) => a + r.fare, 0),
    },
    rides: rides.slice(0, 10).map(rideWithRelations),
  })
}

/** PUT|PATCH /api/v1/users/{user} */
export async function updateUser(event: H3Event) {
  const actor = authUser(event)
  const id = Number(getRouterParam(event, 'user'))
  // `UserPolicy::update` — admin boleh semua, user biasa hanya dirinya sendiri.
  if (actor.role !== 'admin' && actor.id !== id) {
    throw createError({ statusCode: 403, data: { message: 'Anda tidak punya akses ke resource ini.' } })
  }
  const user = findOr404(userById(id), 'Pengguna tidak ditemukan.')
  const body = await readPayload(event)
  const isAdmin = actor.role === 'admin'

  // `role` DITOLAK untuk bukan admin, bukan diabaikan diam-diam. Mengabaikannya
  // berarti permintaan yang ditolak terlihat berhasil, dan itu jebakan yang
  // tidak ada orang yang sadari.
  if (body.role !== undefined && !isAdmin) {
    throw createError({
      statusCode: 422,
      data: { message: 'Field role tidak boleh diubah.', errors: { role: ['Field role tidak boleh diubah.'] } },
    })
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length < 3) {
      throw createError({ statusCode: 422, data: { message: 'Nama minimal 3 karakter.', errors: { name: ['Nama minimal 3 karakter.'] } } })
    }
    user.name = name
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase()
    if (db.users.some(u => u.id !== id && u.email.toLowerCase() === email)) {
      throw createError({ statusCode: 422, data: { message: 'Email sudah terdaftar.', errors: { email: ['Email sudah terdaftar.'] } } })
    }
    user.email = email
  }
  if (body.phone !== undefined) user.phone = String(body.phone)

  /**
   * Password. BE menerima `password` + `password_confirmation` tanpa meminta
   * `current_password`, jadi siapa pun yang memegang token bisa mengganti
   * password orang lain. Mock sengaja lebih ketat: `current_password` wajib
   * untuk mengganti password milik sendiri, dan admin wajib juga mengetik
   * password akun yang ia ubah.
   *
   * Lebih ketat dari backend bukan bertentangan dengan `UserPolicy` — policy
   * itu mengatur *siapa* boleh, sedangkan ini mengatur *dengan bukti apa*.
   */
  if (body.password !== undefined) {
    const next = String(body.password)
    if (next.length < 8) {
      throw createError({
        statusCode: 422,
        data: { message: 'Password baru minimal 8 karakter.', errors: { password: ['Password baru minimal 8 karakter.'] } },
      })
    }
    if (body.password_confirmation !== undefined && String(body.password_confirmation) !== next) {
      throw createError({
        statusCode: 422,
        data: { message: 'Konfirmasi password tidak cocok.', errors: { password_confirmation: ['Konfirmasi password tidak cocok.'] } },
      })
    }
    const stored = db.passwords.get(user.email) ?? 'password'
    if (String(body.current_password ?? '') !== stored) {
      throw createError({
        statusCode: 422,
        data: { message: 'Password saat ini salah.', errors: { current_password: ['Password saat ini salah.'] } },
      })
    }
    db.passwords.set(user.email, next)
  }

  if (isAdmin && body.role !== undefined) {
    if (['user', 'driver', 'admin'].includes(String(body.role))) user.role = body.role
  }
  if (isAdmin && body.status !== undefined) {
    if (['active', 'pending', 'suspended'].includes(String(body.status))) user.status = body.status
  }
  user.updated_at = nowIso()
  return resource(user, { message: 'Pengguna berhasil diperbarui.' })
}

/** DELETE /api/v1/users/{user} */
export async function deleteUser(event: H3Event) {
  const actor = requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'user'))
  // `UserPolicy::delete` — admin saja, dan tidak boleh akun sendiri.
  if (id === actor.id) {
    throw createError({ statusCode: 422, data: { message: 'Tidak bisa menghapus akun sendiri.' } })
  }
  const idx = db.users.findIndex(u => u.id === id)
  if (idx === -1) throw createError({ statusCode: 404, data: { message: 'Pengguna tidak ditemukan.' } })
  const [removed] = db.users.splice(idx, 1)
  return resource(removed, { message: 'Pengguna dihapus.' })
}

/** GET /api/v1/admin/rides */
export async function adminListRides(event: H3Event) {
  requireRole(event, 'admin')
  const list = queryList(db.rides, event, {
    search: ['ride_code'],
    filters: {
      status: (r, v) => r.status === v,
      payment_status: (r, v) => r.payment_status === v,
      payment_method: (r, v) => r.payment_method === v,
    },
    sort: { created_at: 'desc', fare: 'desc' },
  })
  const page = paginate(list.map(rideWithRelations), event, 15)
  return { data: page.data, links: page.links, meta: page.meta }
}

/** PATCH /api/v1/admin/rides/{ride} */
export async function adminUpdateRide(event: H3Event) {
  requireRole(event, 'admin')
  const ride = findOr404(db.rides.find(r => r.id === Number(getRouterParam(event, 'ride'))), 'Perjalanan tidak ditemukan.')
  const admin = requireRole(event, 'admin')
  const body = await readPayload(event)
  if (body.status && (RIDE_STATUSES as readonly string[]).includes(String(body.status))) {
    pushHistory(ride, body.status as RideStatus, 'system', admin.id, 'Diubah oleh admin')
  }
  return resource(rideWithRelations(ride), { message: 'Perjalanan diperbarui.' })
}

/** PATCH /api/v1/admin/drivers/:driver */
export async function adminUpdateDriver(event: H3Event) {
  requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'driver'))
  const driver = findOr404(
    db.drivers.find(d => d.id === id),
    'Driver tidak ditemukan.',
  )
  const body = await readPayload(event)

  if (body.status && ['offline', 'idle', 'busy'].includes(body.status)) {
    driver.status = body.status
  }
  if (body.user_status && ['active', 'pending', 'suspended'].includes(body.user_status)) {
    const user = db.users.find(u => u.id === driver.user_id)
    if (user) user.status = body.user_status
  }
  if (body.vehicle && typeof body.vehicle === 'object') {
    const v = body.vehicle as Record<string, unknown>
    if (v.vehicle_type && ['motorcycle'].includes(String(v.vehicle_type))) {
      driver.vehicle_type = v.vehicle_type as DriverProfile['vehicle_type']
    }
    if (v.vehicle_plate) driver.vehicle_plate = String(v.vehicle_plate)
    if (v.vehicle_color) driver.vehicle_color = String(v.vehicle_color)
    if (v.vehicle_model) driver.vehicle_model = String(v.vehicle_model)
  }
  if (body.student_id) driver.student_id = String(body.student_id)
  if (body.campus) driver.campus = String(body.campus)
  if (body.study_program) driver.study_program = String(body.study_program)

  return resource(driverById(driver.id)!, { message: 'Data driver diperbarui.' })
}

/** POST /api/v1/admin/drivers/{driver}/verify — verifikasi status mahasiswa */
export async function verifyDriver(event: H3Event) {
  requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'driver'))
  const driver = findOr404(
    db.drivers.find(d => d.id === id),
    'Driver tidak ditemukan.',
  )
  const body = await readPayload(event)
  if (!['verified', 'rejected', 'pending'].includes(String(body.verification))) {
    throw createError({ statusCode: 422, data: { message: 'Status verifikasi tidak valid.' } })
  }
  driver.verification = body.verification as DriverProfile['verification']
  const user = db.users.find(u => u.id === driver.user_id)
  if (user) user.updated_at = nowIso()
  const label = driver.verification === 'verified' ? 'Terverifikasi' : driver.verification === 'rejected' ? 'Ditolak' : 'Menunggu verifikasi'
  return resource(driverById(driver.id)!, { message: `Status driver: ${label}.` })
}

/** GET /api/v1/admin/payments — semua transaksi lintas pengguna */
export async function adminListPayments(event: H3Event) {
  requireRole(event, 'admin')
  const rows = db.rides
    .map(r => {
      const payment = paymentsForRide(r.id)
      if (!payment) return null
      return {
        ...payment,
        ride_code: r.ride_code,
        customer_name: userById(r.customer_id)?.name ?? '-',
        driver_name: r.driver_id ? (driverById(r.driver_id)?.user.name ?? '-') : '-',
      }
    })
    .filter(Boolean) as Array<
    Payment & { ride_code: string; customer_name: string; driver_name: string }
  >

  const list = queryList(rows, event, {
    search: ['reference', 'ride_code', 'customer_name', 'driver_name'],
    match: (p, term) => p.customer_name.toLowerCase().includes(term) || p.driver_name.toLowerCase().includes(term),
    filters: {
      status: (p, v) => p.status === v,
      method: (p, v) => p.method === v,
      date: (p, v) => p.created_at.slice(0, 10) === v,
    },
    sort: { created_at: 'desc', amount: 'desc' },
  })
  const page = paginate(list, event, 15)
  return { data: page.data, links: page.links, meta: page.meta }
}

/** GET /api/v1/admin/reports?days=30 */
export async function adminReports(event: H3Event) {
  requireRole(event, 'admin')
  const days = Math.min(365, Number(getQuery(event).days) || 30)
  const series = buildChartSeries(days)
  const completed = db.rides.filter(r => r.status === 'completed')
  const byMethod = new Map<string, { method: string; count: number; amount: number }>()
  for (const r of completed) {
    const entry = byMethod.get(r.payment_method) ?? { method: r.payment_method, count: 0, amount: 0 }
    entry.count += 1
    entry.amount += r.fare
    byMethod.set(r.payment_method, entry)
  }
  return resource({
    range: { days, from: series[0]?.date ?? null, to: series[series.length - 1]?.date ?? null },
    series,
    summary: {
      total_rides: completed.length,
      total_gmv: completed.reduce((a, r) => a + r.fare, 0),
      avg_fare: completed.length ? Math.round(completed.reduce((a, r) => a + r.fare, 0) / completed.length) : 0,
      total_distance_km: Number(completed.reduce((a, r) => a + (r.distance_km ?? 0), 0).toFixed(1)),
      total_duration_min: completed.reduce((a, r) => a + (r.duration_min ?? 0), 0),
    },
    by_method: [...byMethod.values()],
    by_vehicle: revenueByVehicleType(),
  })
}

/** GET /api/v1/admin/settings */
export async function getSettings(event: H3Event) {
  requireRole(event, 'admin')
  const grouped = db.settings.reduce<Record<string, SystemSetting[]>>((acc, s) => {
    ;(acc[s.group] ??= []).push(s)
    return acc
  }, {})
  return resource(db.settings, { grouped })
}

/** PUT /api/v1/admin/settings */
export async function updateSettings(event: H3Event) {
  requireRole(event, 'admin')
  const body = await readPayload(event)
  const updates = (body.settings ?? body) as Record<string, string>
  let count = 0
  for (const [key, value] of Object.entries(updates)) {
    const s = db.settings.find(x => x.key === key)
    if (s) {
      s.value = String(value)
      count++
    }
  }
  return resource({ updated: count }, { message: `${count} pengaturan disimpan.` })
}

/** GET /api/v1/admin/activity */
export async function adminActivity(event: H3Event) {
  requireRole(event, 'admin')
  const list = db.rides
    .slice(0, 12)
    .map(r => ({
      id: r.id,
      ride_code: r.ride_code,
      status: r.status,
      fare: r.fare,
      customer_name: userById(r.customer_id)?.name ?? '-',
      driver_name: r.driver_id ? driverById(r.driver_id)?.user.name ?? '-' : '-',
      created_at: r.created_at,
    }))
  await delay(120)
  return resource(list)
}
