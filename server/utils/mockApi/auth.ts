import type { H3Event } from 'h3'
import { createError } from 'h3'
import type { User } from '#shared/types'
import {
  authUser,
  clearAuthSession,
  delay,
  emailRule,
  minRule,
  readPayload,
  readSession,
  readDevice,
  trustDevice,
  required,
  resource,
  validate,
  writeSession,
  db,
} from '../api'
import {
  buildChartSeries,
  driverByUserId,
  nowIso,
  type OtpChallenge,
} from './db'

const OTP_TTL_SECONDS = 300
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_COOLDOWN_SECONDS = 60

function issueToken(userId: number): string {
  return `ans_mock_${userId}_${Math.random().toString(36).slice(2, 12)}`
}

function sessionFor(user: User, event: H3Event): { token: string; user: User } {
  const token = issueToken(user.id)
  writeSession(event, { userId: user.id, token })
  return { token, user }
}

/** `rah***@dinus.ac.id` — untuk ditampilkan di layar verifikasi */
function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@')
  const head = name.slice(0, 1)
  return `${head}***@${domain}`
}

function newOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Buat tantangan OTP. Mode mock: kode tidak dikirim via email,
 * dikembalikan sebagai `dev_code` (hanya mode development).
 */
function createChallenge(user: User, purpose: OtpChallenge['purpose']) {
  const now = Date.now()
  const challenge: OtpChallenge = {
    id: `otp_${db.counters.otp++}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: user.id,
    purpose,
    code: newOtpCode(),
    email: user.email,
    expires_at: now + OTP_TTL_SECONDS * 1000,
    attempts: 0,
  }
  /* Hanya satu tantangan aktif per user+purpose */
  const kept = db.otpChallenges.filter(c => !(c.user_id === user.id && c.purpose === purpose))
  db.otpChallenges.length = 0
  db.otpChallenges.push(...kept, challenge)
  return challenge
}

function challengePayload(challenge: OtpChallenge) {
  const user = db.users.find(u => u.id === challenge.user_id)
  if (user) user.updated_at = nowIso()
  return {
    challenge_id: challenge.id,
    email_masked: maskEmail(challenge.email),
    expires_in: OTP_TTL_SECONDS,
    /* Mode mock tanpa SMTP: kode disertakan agar UI demo bisa menampilkan */
    dev_code: challenge.code,
  }
}

function takeChallenge(challengeId: string): OtpChallenge {
  const challenge = db.otpChallenges.find(c => c.id === challengeId)
  if (!challenge) {
    throw createError({ statusCode: 422, data: { message: 'Sesi verifikasi tidak valid. Ulangi proses.', errors: { challenge_id: ['Sesi verifikasi tidak valid.'] } } })
  }
  return challenge
}

/** POST /api/v1/auth/register — customer & driver; balas dengan tantangan OTP */
export async function register(event: H3Event) {
  await delay(400)
  const body = await readPayload(event)
  validate(body, {
    name: required('Nama'),
    email: emailRule(),
    phone: (v: unknown) =>
      typeof v === 'string' && v.replace(/\D/g, '').length >= 9 ? null : 'Nomor HP tidak valid.',
    password: minRule(8, 'Password'),
    role: (v: unknown) => (v === 'user' || v === 'driver' ? null : 'Role tidak valid.'),
    ...(body.role === 'driver'
      ? {
          student_id: required('NIM'),
          campus: required('Kampus'),
        }
      : {}),
  })

  const email = String(body.email).toLowerCase().trim()
  if (db.users.some(u => u.email.toLowerCase() === email)) {
    throw createError({
      statusCode: 422,
      data: { message: 'Email sudah terdaftar.', errors: { email: ['Email sudah terdaftar.'] } },
    })
  }

  const user: User = {
    id: Math.max(...db.users.map(u => u.id)) + 1,
    name: String(body.name).trim(),
    email,
    phone: String(body.phone),
    role: body.role,
    avatar_url: null,
    status: 'active',
    rating: null,
    rating_count: 0,
    email_verified_at: null,
    phone_verified_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  }
  db.users.push(user)
  db.passwords.set(user.email, String(body.password))

  if (user.role === 'driver') {
    db.drivers.push({
      id: Math.max(...db.drivers.map(d => d.id)) + 1,
      user_id: user.id,
      driver_code: `DRV-${2000 + db.drivers.length}`,
      status: 'offline',
      student_id: String(body.student_id).trim(),
      campus: String(body.campus).trim(),
      study_program: String(body.study_program ?? '').trim(),
      verification: 'pending',
      vehicle_type: 'motorcycle',
      vehicle_plate: String(body.vehicle_plate ?? '').trim() || '-',
      vehicle_color: String(body.vehicle_color ?? '').trim() || '-',
      vehicle_model: String(body.vehicle_model ?? '').trim() || '-',
      photo_url: null,
      lat: null,
      lng: null,
      last_seen_at: null,
      rating: 5,
      total_rides: 0,
      online_hours: 0,
      earnings_today: 0,
      earnings_month: 0,
    })
  }

  const challenge = createChallenge(user, 'register')
  return resource(challengePayload(challenge))
}

/** POST /api/v1/auth/login — password valid → device trust langsung masuk, selain itu tantangan OTP */
export async function login(event: H3Event) {
  await delay(450)
  const body = await readPayload(event)

  validate(body, { email: required('Email'), password: required('Password') })
  const email = String(body.email).toLowerCase().trim()
  const user = db.users.find(u => u.email.toLowerCase() === email)

  const isAdminDemo = email === 'admin@ansian.id' && body.password === 'admin123'
  const stored = db.passwords.get(email)
  const isValid = Boolean(
    user && (stored ? body.password === stored : body.password === 'password' || body.password === 'password123' || isAdminDemo),
  )

  if (!isValid) {
    throw createError({
      statusCode: 422,
      data: { message: 'Email atau password salah.', errors: { email: ['Email atau password salah.'] } },
    })
  }
  if (user!.status === 'suspended') {
    throw createError({ statusCode: 403, data: { message: 'Akun Anda dinonaktifkan. Hubungi customer service.' } })
  }

  /* Perangkat tepercaya (30 hari) → langsung sesi tanpa OTP */
  const device = readDevice(event)
  if (device && device.userId === user!.id) {
    return resource(sessionFor(user!, event))
  }

  const challenge = createChallenge(user!, 'login')
  return resource(challengePayload(challenge))
}

/** POST /api/v1/auth/otp/verify — verifikasi kode → sesi + set device trust 30 hari */
export async function verifyOtp(event: H3Event) {
  await delay(350)
  const body = await readPayload(event)
  validate(body, {
    challenge_id: required('Challenge'),
    code: (v: unknown) => (typeof v === 'string' && v.trim().length === 6 ? null : 'Kode verifikasi 6 digit.'),
  })

  const challenge = takeChallenge(String(body.challenge_id))
  const user = db.users.find(u => u.id === challenge.user_id)
  if (!user) {
    db.otpChallenges.splice(db.otpChallenges.indexOf(challenge), 1)
    throw createError({ statusCode: 404, data: { message: 'Akun tidak ditemukan.' } })
  }

  if (Date.now() > challenge.expires_at) {
    db.otpChallenges.splice(db.otpChallenges.indexOf(challenge), 1)
    throw createError({ statusCode: 422, data: { message: 'Kode kedaluwarsa. Minta kode baru.', errors: { code: ['Kode kedaluwarsa.'] } } })
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    db.otpChallenges.splice(db.otpChallenges.indexOf(challenge), 1)
    throw createError({ statusCode: 422, data: { message: 'Terlalu banyak percobaan. Minta kode baru.', errors: { code: ['Terlalu banyak percobaan.'] } } })
  }

  if (String(body.code).trim() !== challenge.code) {
    challenge.attempts += 1
    const left = OTP_MAX_ATTEMPTS - challenge.attempts
    throw createError({
      statusCode: 422,
      data: {
        message: left > 0 ? `Kode salah. Sisa percobaan ${left}.` : 'Terlalu banyak percobaan. Minta kode baru.',
        errors: { code: ['Kode verifikasi salah.'] },
      },
    })
  }

  db.otpChallenges.splice(db.otpChallenges.indexOf(challenge), 1)
  if (challenge.purpose === 'register' && !user.email_verified_at) {
    user.email_verified_at = nowIso()
    user.updated_at = nowIso()
  }
  trustDevice(event, user.id)
  return resource(sessionFor(user, event))
}

/** POST /api/v1/auth/otp/request — kode baru, throttle 60 detik */
export async function requestOtp(event: H3Event) {
  await delay(300)
  const body = await readPayload(event)
  validate(body, { challenge_id: required('Challenge') })

  const challenge = db.otpChallenges.find(c => c.id === String(body.challenge_id))
  if (!challenge) {
    throw createError({ statusCode: 422, data: { message: 'Sesi verifikasi tidak valid. Ulangi proses.', errors: { challenge_id: ['Sesi verifikasi tidak valid.'] } } })
  }

  const elapsed = (Date.now() - challenge.expires_at + OTP_TTL_SECONDS * 1000) / 1000
  if (elapsed < OTP_RESEND_COOLDOWN_SECONDS && elapsed >= 0) {
    throw createError({
      statusCode: 429,
      data: { message: `Tunggu ${OTP_RESEND_COOLDOWN_SECONDS - Math.floor(elapsed)} detik sebelum meminta kode baru.` },
    })
  }

  challenge.code = newOtpCode()
  challenge.expires_at = Date.now() + OTP_TTL_SECONDS * 1000
  challenge.attempts = 0
  return resource({ ...challengePayload(challenge), message: 'Kode baru terkirim.' })
}

/** POST /api/v1/auth/logout */
export async function logout(event: H3Event) {
  clearAuthSession(event)
  return resource({ message: 'Berhasil keluar.' })
}

/** GET /api/v1/auth/me */
export async function me(event: H3Event) {
  const user = authUser(event)
  return resource({
    ...user,
    driver: user.role === 'driver' ? (driverByUserId(user.id)?.user_id ? driverByUserId(user.id) : null) : null,
  })
}

/** GET /api/v1/auth/sessions */
export async function sessions(event: H3Event) {
  const session = readSession(event)
  return resource({ active: Boolean(session), token_hint: session?.token.slice(-6) ?? null })
}

/** GET /api/v1/me/summary — ringkasan sesuai role untuk halaman depan */
export async function homeSummary(event: H3Event) {
  const user = authUser(event)
  const today = new Date().toISOString().slice(0, 10)
  const isCancelled = (s: string) => s === 'passenger_cancelled' || s === 'driver_cancelled' || s === 'no_driver_found'
  const isActive = (s: string) => s === 'searching' || s === 'driver_assigned' || s === 'driver_arrived' || s === 'in_progress'

  if (user.role === 'user') {
    const rides = db.rides.filter(r => r.customer_id === user.id)
    const completed = rides.filter(r => r.status === 'completed')
    return resource({
      role: 'user' as const,
      total_rides: rides.length,
      active_rides: rides.filter(r => isActive(r.status)).length,
      completed_rides: completed.length,
      cancelled_rides: rides.filter(r => isCancelled(r.status)).length,
      rides_today: rides.filter(r => r.created_at.slice(0, 10) === today).length,
      total_spent: completed.reduce((a, r) => a + r.fare, 0),
      currency: 'IDR',
      series: buildChartSeries(7),
    })
  }

  /*
   * Tidak ada `points` dan tidak ada `online_hours`: keduanya tidak ada di
   * backend. `points: 1240` dulu dibuat-buat supaya kartunya terlihat penuh,
   * dan `online_hours` tidak pernah dihitung dari apa pun.
   */
  const profile = driverByUserId(user.id)
  return resource({
    role: 'driver' as const,
    status: profile?.status ?? 'offline',
    // Mock tidak punya sakelar `is_available` terpisah seperti backend; status
    // adalah satu-satunya penanda yang ada di sini.
    is_available: (profile?.status ?? 'offline') !== 'offline',
    total_rides: profile?.total_rides ?? 0,
    active_rides: db.rides.filter(r => r.driver_id !== null && r.driver_id === profile?.id && isActive(r.status)).length,
    rating: profile?.rating ?? null,
    earnings_today: profile?.earnings_today ?? 0,
    earnings_month: profile?.earnings_month ?? 0,
    collected_cash_month: Math.round((profile?.earnings_month ?? 0) * 0.4),
    currency: 'IDR',
    series: buildChartSeries(7),
  })
}