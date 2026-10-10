import { calculateZoneFare } from '#shared/utils/pricing'
import type {
  AppNotification,
  ChartPoint,
  Conversation,
  ChatMessage,
  Driver,
  DriverJob,
  DriverProfile,
  Payment,
  Ride,
  RideStatusHistory,
  SystemSetting,
  User,
  VehicleType,
} from '#shared/types'

/**
 * Mock database in-memory.
 * WAJIB mirror dengan isi tabel Laravel (users, driver_profiles, rides,
 * ride_status_histories, conversations, messages, notifications, payments, settings).
 */

export const CENTER = { lat: -6.982835, lng: 110.409352 }

const PLACES = [
  { lat: -6.982835, lng: 110.409352, address: 'Kampus Udinus, Pendrikan Kidul, Semarang Tengah', place_name: 'Kampus Udinus' },
  { lat: -6.9913, lng: 110.4163, address: 'Simpang Lima, Semarang', place_name: 'Simpang Lima' },
  { lat: -6.9789, lng: 110.4168, address: 'Jl. Pandanaran, Semarang', place_name: 'Pandanaran' },
  { lat: -6.9735, lng: 110.4287, address: 'Sriwawansari, Semarang Tengah', place_name: 'Sriwawansari' },
  { lat: -6.9944, lng: 110.4064, address: 'Stasiun Tawang, Semarang', place_name: 'Stasiun Tawang' },
  { lat: -6.9727, lng: 110.3767, address: 'Bandara Ahmad Yani, Semarang', place_name: 'Bandara Ahmad Yani' },
  { lat: -6.9663, lng: 110.4638, address: 'Genuk, Semarang Timur', place_name: 'Genuk' },
  { lat: -6.9881, lng: 110.3932, address: 'Salaman Mloyo, Semarang Barat', place_name: 'Salaman Mloyo' },
  { lat: -6.9688, lng: 110.4161, address: 'Kotabaru, Semarang', place_name: 'Kotabaru' },
  { lat: -6.9978, lng: 110.4227, address: 'Bandarharjo, Semarang Utara', place_name: 'Bandarharjo' },
]

const FIRST = ['Ahmad', 'Budi', 'Candra', 'Dewi', 'Eko', 'Fajar', 'Galih', 'Hendra', 'Indra', 'Joko', 'Kevin', 'Lukman', 'Miko', 'Nanda', 'Oscar', 'Putra', 'Rizky', 'Satria', 'Taufik', 'Umar']
const LAST = ['Saputra', 'Wijaya', 'Ramadhan', 'Pratama', 'Nugroho', 'Kusuma', 'Hidayat', 'Maulana', 'Setiawan', 'Firmansyah']

export function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

export function makeName(i: number): string {
  return `${FIRST[i % FIRST.length]} ${LAST[(i * 3 + 1) % LAST.length]}`
}

function hoursAgo(h: number, m = 0): string {
  return new Date(Date.now() - h * 3_600_000 - m * 60_000).toISOString()
}
function hoursAhead(h: number): string {
  return new Date(Date.now() + h * 3_600_000).toISOString()
}

const AVATAR_SVG = (name: string, hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="hsl(${hue} 70% 92%)"/><text x="48" y="60" font-family="sans-serif" font-size="34" font-weight="600" fill="hsl(${hue} 60% 35%)" text-anchor="middle">${name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')}</text></svg>`,
  )}`

/* ---------------- USERS ---------------- */

function buildUsers(): User[] {
  const users: User[] = []
  const now = new Date().toISOString()

  users.push({
    id: 1,
    name: 'Rani Kusuma',
    email: 'customer@ansian.id',
    phone: '081234567890',
    role: 'user',
    avatar_url: AVATAR_SVG('Rani Kusuma', 220),
    status: 'active',
    rating: null,
    rating_count: 0,
    email_verified_at: now,
    phone_verified_at: now,
    created_at: hoursAgo(720),
    updated_at: now,
  })

  users.push({
    id: 2,
    name: 'Dimas Anggara',
    email: 'driver@ansian.id',
    phone: '081298765432',
    role: 'driver',
    avatar_url: AVATAR_SVG('Dimas Anggara', 160),
    status: 'active',
    rating: 4.87,
    rating_count: 1243,
    email_verified_at: now,
    phone_verified_at: now,
    created_at: hoursAgo(1400),
    updated_at: hoursAgo(0, 2),
  })

  users.push({
    id: 3,
    name: 'Admin Ansian',
    email: 'admin@ansian.id',
    phone: '08111222333',
    role: 'admin',
    avatar_url: AVATAR_SVG('Admin Ansian', 265),
    status: 'active',
    rating: null,
    rating_count: 0,
    email_verified_at: now,
    phone_verified_at: now,
    created_at: hoursAgo(3000),
    updated_at: hoursAgo(24),
  })

  for (let i = 0; i < 46; i++) {
    const isDriver = i < 22
    const id = 100 + i
    const name = makeName(i + 4)
    users.push({
      id,
      name,
      email: `${isDriver ? 'driver' : 'customer'}${id}@ansian.id`,
      phone: `0812${String(1000000 + i * 137).slice(0, 8)}`,
      role: isDriver ? 'driver' : 'user',
      avatar_url: AVATAR_SVG(name, (i * 37) % 360),
      status: i % 17 === 0 ? 'suspended' : i % 11 === 0 ? 'pending' : 'active',
      rating: isDriver ? Number((4.5 + ((i * 13) % 50) / 100).toFixed(2)) : null,
      rating_count: isDriver ? 40 + i * 11 : 0,
      email_verified_at: i % 7 === 0 ? null : hoursAgo(600 - i * 6),
      phone_verified_at: hoursAgo(600 - i * 6),
      created_at: hoursAgo(30 * (i + 1)),
      updated_at: hoursAgo(i * 3),
    })
  }
  return users
}

/* ---------------- DRIVERS ---------------- */

const VEHICLES: { type: VehicleType; models: string[]; colors: string[] }[] = [
  { type: 'motorcycle', models: ['Honda Beat', 'Yamaha Mio', 'Honda Vario 160', 'Suzuki Smash'], colors: ['Hitam', 'Merah', 'Biru', 'Putih'] },
  { type: 'motorcycle', models: ['Yamaha NMAX', 'Honda PCX', 'Scoopy Prestige'], colors: ['Hitam', 'Cokelat', 'Abu-abu'] },
]

const CAMPUSES = ['Universitas Dian Nuswantoro', 'Universitas Dian Nuswantoro', 'Universitas Dian Nuswantoro', 'Universitas Diponegoro', 'Politeknik Negeri Semarang', 'UIN Walisongo']
const PROGRAMS = ['Teknik Informatika', 'Sistem Informasi', 'Manajemen', 'Desain Komunikasi Visual', 'Akuntansi', 'Ilmu Komunikasi', 'Teknik Elektro']

function buildDriverProfiles(users: User[]): DriverProfile[] {
  const drivers: DriverProfile[] = []
  const driverUsers = users.filter(u => u.role === 'driver')

  driverUsers.forEach((u, i) => {
    const spec = VEHICLES[i % VEHICLES.length]!
    const plate = `F ${String(1000 + i * 37).slice(0, 4)} ${['ABC', 'QWE', 'ZXC', 'KLM'][i % 4]}`
    const status = i === 0 ? 'busy' : i < 14 ? 'idle' : i < 18 ? 'busy' : 'offline'
    const p = PLACES[(i * 5) % PLACES.length]!
    drivers.push({
      id: i + 1,
      user_id: u.id,
      driver_code: `DRV-${String(1001 + i)}`,
      status,
      student_id: `A11.202${(i % 4) + 1}.${String(1000 + i * 73).slice(0, 4)}`,
      campus: CAMPUSES[i % CAMPUSES.length]!,
      study_program: PROGRAMS[i % PROGRAMS.length]!,
      verification: i === 0 ? 'verified' : i % 7 === 5 ? 'rejected' : i % 5 === 0 ? 'pending' : 'verified',
      vehicle_type: spec.type,
      vehicle_plate: plate,
      vehicle_color: spec.colors[i % spec.colors.length]!,
      vehicle_model: spec.models[i % spec.models.length]!,
      photo_url: null,
      lat: p.lat + ((i % 7) - 3) * 0.004,
      lng: p.lng + ((i % 5) - 2) * 0.004,
      last_seen_at: status === 'offline' ? hoursAgo(6 + i) : hoursAgo(0, i),
      rating: Number((4.5 + ((i * 13) % 50) / 100).toFixed(2)),
      total_rides: 60 + i * 27,
      online_hours: Math.round(400 + i * 31),
      earnings_today: i < 14 ? 180_000 + i * 21_500 : 0,
      earnings_month: 3_200_000 + i * 415_000,
    })
  })
  return drivers
}

/* ---------------- RIDES ---------------- */

const STATUS_FLOW: Ride['status'][] = ['searching', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed']

function buildRides(users: User[], drivers: DriverProfile[]): Ride[] {
  const rides: Ride[] = []
  const customers = users.filter(u => u.role === 'user')
  const rnd = seeded(42)
  const ACTIVE: Ride['status'][] = ['searching', 'driver_assigned', 'driver_arrived', 'in_progress']
  /* Satu customer hanya boleh punya satu perjalanan aktif. */
  const activeCustomerIds = new Set<number>()

  for (let i = 0; i < 64; i++) {
    const pickup = PLACES[i % PLACES.length]!
    const dest = PLACES[(i * 3 + 4) % PLACES.length]!
    const distance = Number((1.2 + rnd() * 18).toFixed(1))
    const duration = Math.round((distance / 24) * 60 + 2)
    const fare = calculateZoneFare(distance).total

    // Diannotasi eksplisit lalu dinolai terpisah: kalau ditulis `let status:
    // Ride['status']` lalu langsung di-*assign* di rantai `if`, TypeScript
    // mempersempit tipenya jadi enam nilai yang benar-benar terambil, dan
    // perbandingan dengan `driver_cancelled` di bawah jadi error walau
    // nilainya sah.
    let status: Ride['status']
    status = 'completed'
    if (i === 0) status = 'searching'
    else if (i === 1) status = 'driver_assigned'
    else if (i === 2) status = 'driver_arrived'
    else if (i === 3) status = 'in_progress'
    else if (i % 13 === 0) status = 'passenger_cancelled'
    else if (i % 17 === 0) status = 'no_driver_found'
    else if (i % 19 === 0) status = 'driver_cancelled'

    const createdHoursAgo = i === 0 ? 0.02 : 0.2 + i * 3.4
    const createdAt = hoursAgo(createdHoursAgo)
    /* Demo: driver pertama menerima perjalanan assigned, passenger pertama yang searching. */
    const driver = status === 'searching' ? null : drivers[status === 'driver_assigned' ? 0 : i % drivers.length]!
    const isActive = ACTIVE.includes(status)
    let customer = customers[i % customers.length]!
    if (isActive) {
      const free = customers.find(r => !activeCustomerIds.has(r.id))
      if (free) customer = free
      activeCustomerIds.add(customer.id)
    }
    const completed = status === 'completed'

    // Bentuknya mengikuti `RideStatusHistoryResource`: `from_status`/`to_status`,
    // bukan sekadar status. Menyimpan bentuk yang berbeda di mock berarti
    // timeline yang terlihat benar saat mock hidup akan kosong begitu backend
    // menyala — dan tidak ada yang salah karena keduanya "berisi".
    const histories: RideStatusHistory[] = [
      {
        from_status: null,
        to_status: 'searching',
        to_status_label: RIDE_STATUS_LABELS.searching,
        changed_by_role: 'passenger',
        changed_by_user_id: customer.id,
        note: null,
        at: createdAt,
      },
    ]
    const step = STATUS_FLOW.indexOf(status)
    const flowTimes = [0.05, 0.2, 0.3, 0.5]
    for (let s = 1; s <= step; s++) {
      const next = STATUS_FLOW[s]!
      histories.push({
        from_status: STATUS_FLOW[s - 1]!,
        to_status: next,
        to_status_label: RIDE_STATUS_LABELS[next],
        changed_by_role: 'driver',
        changed_by_user_id: driver?.id ?? null,
        note: null,
        at: hoursAgo(Math.max(0.01, createdHoursAgo - flowTimes[s - 1]!)),
      })
    }
    if (isRideCancelled(status)) {
      histories.push({
        from_status: STATUS_FLOW[step] ?? null,
        to_status: status,
        to_status_label: RIDE_STATUS_LABELS[status],
        changed_by_role: status === 'driver_cancelled' ? 'driver' : 'passenger',
        changed_by_user_id: status === 'driver_cancelled' ? (driver?.id ?? null) : customer.id,
        note:
          status === 'passenger_cancelled'
            ? 'Dibatalkan oleh pelanggan'
            : status === 'driver_cancelled'
              ? 'Dibatalkan oleh driver'
              : 'Tidak ada driver yang menerima',
        at: hoursAgo(Math.max(0.01, createdHoursAgo - 0.4)),
      })
    }

    rides.push({
      id: 1000 + i,
      ride_code: `ASN-${String(2609000 + i)}`,
      status,
      service_type: i % 7 === 0 ? 'scheduled' : 'instant',
      scheduled_at: i % 7 === 0 ? hoursAhead(2 + i) : null,
      pickup: { ...pickup },
      destination: { ...dest },
      pickup_note: i % 4 === 0 ? 'Pintu belakang, please hubungi saat tiba' : null,
      distance_km: distance,
      duration_min: duration,
      fare,
      payment_method: (['cash', 'qris'] as const)[i % 2]!,
      payment_status: completed ? 'paid' : isRideCancelled(status) ? 'refunded' : i % 2 === 1 ? 'pending' : 'unpaid',
      cancel_reason:
        status === 'passenger_cancelled'
          ? 'customer_cancel'
          : status === 'driver_cancelled'
            ? 'driver_cancel'
            : status === 'no_driver_found'
              ? 'no_driver'
              : null,
      customer_id: customer.id,
      driver_id: driver?.id ?? null,
      status_histories: histories,
      started_at: step >= 3 ? hoursAgo(Math.max(0.01, createdHoursAgo - 0.5)) : null,
      arrived_at: step >= 2 ? hoursAgo(Math.max(0.01, createdHoursAgo - 0.3)) : null,
      completed_at: completed ? hoursAgo(Math.max(0.01, createdHoursAgo - 0.05)) : null,
      cancelled_at: isRideCancelled(status) ? hoursAgo(Math.max(0.01, createdHoursAgo - 0.4)) : null,
      created_at: createdAt,
      updated_at: histories[histories.length - 1]!.at,
    })
  }
  return rides
}

/* ---------------- CHAT ---------------- */

function buildConversations(users: User[], rides: Ride[]): { convs: Conversation[]; msgs: ChatMessage[] } {
  const drivers = users.filter(u => u.role === 'driver')
  const convs: Conversation[] = []
  const msgs: ChatMessage[] = []
  let msgId = 1

  for (let i = 0; i < 6; i++) {
    const counterpart = drivers[i % drivers.length]!
    const ride = rides[i]!
    const seedMessages = [
      { body: 'Halo Pak/Mbu, saya Dimas. Mohon tunggu sebentar ya, saya menuju lokasi penjemputan.', mine: false },
      { body: 'Baik, saya sudah siap di depan gerbang.', mine: true },
      { body: 'Siap, 3 menit lagi sampai. Motor saya Yamaha NMX, plat B 1234 KLM.', mine: false },
      { body: 'Oke, noted. Terima kasih 🙏', mine: true },
      { body: 'Sudah saya sampai lokasi, mari naik ya.', mine: false },
    ]
    const created = msgs
    seedMessages.forEach((m, k) => {
      created.push({
        id: msgId++,
        conversation_id: i + 1,
        sender_id: m.mine ? 1 : counterpart.id,
        sender_name: m.mine ? 'Rani Kusuma' : counterpart.name,
        is_mine: m.mine,
        body: m.body,
        type: 'text',
        attachment_url: null,
        attachment_meta: null,
        read_at: hoursAgo(1),
        created_at: hoursAgo(Math.max(0.05, 2 - k * 0.4 - i * 0.1)),
      })
    })
    const last = created[created.length - 1]!
    convs.push({
      id: i + 1,
      type: 'ride',
      ride_id: ride.id,
      ride_code: ride.ride_code,
      counterpart,
      last_message: { ...last, is_mine: last.sender_id === 1 },
      unread_count: i === 0 ? 2 : 0,
      created_at: hoursAgo(3),
      updated_at: last.created_at,
    })
  }

  convs.push({
    id: 7,
    type: 'support',
    ride_id: null,
    ride_code: null,
    counterpart: {
      id: 3,
      name: 'Bantuan Ansian',
      email: 'support@ansian.id',
      phone: '1500450',
      role: 'admin',
      avatar_url: null,
      status: 'active',
      rating: null,
      rating_count: 0,
      email_verified_at: null,
      phone_verified_at: null,
      created_at: hoursAgo(3),
      updated_at: hoursAgo(3),
    },
    last_message: {
      id: msgId++,
      conversation_id: 7,
      sender_id: 3,
      sender_name: 'Bantuan Ansian',
      is_mine: true,
      body: 'Halo! Ada yang bisa kami bantu?',
      type: 'text',
      attachment_url: null,
      attachment_meta: null,
      read_at: hoursAgo(1),
      created_at: hoursAgo(3),
    },
    unread_count: 0,
    created_at: hoursAgo(3),
    updated_at: hoursAgo(3),
  })
  msgs.push(convs[convs.length - 1]!.last_message as ChatMessage)
  msgs.sort((a, b) => a.created_at.localeCompare(b.created_at))

  return { convs, msgs }
}

/* ---------------- NOTIFICATIONS ---------------- */

function buildNotifications(rides: Ride[]): AppNotification[] {
  const active = rides.find(r => r.status === 'in_progress')!
  return [
    {
      id: 1,
      type: 'ride',
      title: 'Driver sedang menuju lokasi',
      body: `${'Dimas Anggara'} akan tiba dalam 4 menit. Plat B 1234 KLM.`,
      data: { ride_id: active.id, ride_code: active.ride_code },
      read_at: null,
      created_at: hoursAgo(0.1),
    },
    {
      id: 2,
      type: 'promo',
      title: 'Diskon 30% untuk 3 perjalanan',
      body: 'Gunakan kode ANSIAN30 sebelum 30 September.',
      data: { code: 'ANSIAN30' },
      read_at: null,
      created_at: hoursAgo(2),
    },
    {
      id: 3,
      type: 'payment',
      title: 'Pembayaran berhasil',
      body: 'Pembayaran Rp18.500 via QRIS telah dikonfirmasi.',
      data: { ride_id: rides[5]!.id },
      read_at: hoursAgo(5),
      created_at: hoursAgo(6),
    },
    {
      id: 4,
      type: 'system',
      title: 'Fitur baru: kirim barang',
      body: 'Kini kamu bisa kirim paket dengan layanan antar Express.',
      data: {},
      read_at: hoursAgo(20),
      created_at: hoursAgo(22),
    },
  ]
}

/* ---------------- SETTINGS ---------------- */

function buildSettings(): SystemSetting[] {
  return [
    { key: 'app.name', value: 'Ansian', group: 'general', label: 'Nama Aplikasi', type: 'string' },
    { key: 'app.tagline', value: 'Antar Jemput Dinusian', group: 'general', label: 'Tagline', type: 'string' },
    { key: 'fare.zone_green', value: '4000', group: 'fare', label: 'Zona Hijau (0–2,5 km) — tarif (Rp)', type: 'number' },
    { key: 'fare.zone_yellow_start', value: '5000', group: 'fare', label: 'Zona Kuning — tarif di 3 km (Rp)', type: 'number' },
    { key: 'fare.zone_yellow_end', value: '15000', group: 'fare', label: 'Zona Kuning — tarif di 6 km (Rp)', type: 'number' },
    { key: 'fare.zone_orange_start', value: '16000', group: 'fare', label: 'Zona Jingga — tarif di 7 km (Rp)', type: 'number' },
    { key: 'fare.zone_orange_end', value: '20000', group: 'fare', label: 'Zona Jingga — tarif di 10 km (Rp)', type: 'number' },
    { key: 'fare.zone_red_base', value: '20000', group: 'fare', label: 'Zona Merah — tarif dasar (Rp)', type: 'number' },
    { key: 'fare.zone_red_per_km', value: '1500', group: 'fare', label: 'Zona Merah — per km setelah 11 km (Rp)', type: 'number' },
    { key: 'fare.admin_green_yellow', value: '500', group: 'fare', label: 'Biaya admin zona hijau & kuning (Rp)', type: 'number' },
    { key: 'fare.admin_orange_red', value: '1000', group: 'fare', label: 'Biaya admin zona jingga & merah (Rp)', type: 'number' },
    { key: 'ride.search_radius_km', value: '5', group: 'ride', label: 'Radius pencarian driver (km)', type: 'number' },
    { key: 'ride.cancel_free_min', value: '2', group: 'ride', label: 'Gratis pembatalan (menit)', type: 'number' },
    { key: 'driver.max_document', value: '4.7', group: 'driver', label: 'Rating minimum driver', type: 'number' },
    { key: 'payment.cash.enabled', value: 'true', group: 'payment', label: 'Aktifkan Tunai', type: 'boolean' },
    { key: 'payment.qris.enabled', value: 'true', group: 'payment', label: 'Aktifkan QRIS', type: 'boolean' },
    { key: 'payment.qris.image_url', value: '/qris.svg', group: 'payment', label: 'Gambar QRIS statis (dari backend)', type: 'string' },
    { key: 'payment.qris.merchant', value: 'Ansian', group: 'payment', label: 'Nama merchant QRIS', type: 'string' },
    { key: 'chat.auto_reply', value: 'true', group: 'chat', label: 'Balasan otomatis CS', type: 'boolean' },
  ]
}

/* ---------------- DB ---------------- */

const users = buildUsers()
const drivers = buildDriverProfiles(users)
const rides = buildRides(users, drivers)
const { convs: conversations, msgs: messages } = buildConversations(users, rides)
const notifications = buildNotifications(rides)
const settings = buildSettings()
const jobs: DriverJob[] = []

/** Tantangan kode verifikasi email (OTP) — mock pengganti pengiriman email */
export interface OtpChallenge {
  id: string
  user_id: number
  purpose: 'register' | 'login'
  code: string
  email: string
  expires_at: number
  attempts: number
}

const otpChallenges: OtpChallenge[] = []

export const db = {
  users,
  drivers,
  rides,
  conversations,
  messages,
  notifications,
  settings,
  jobs,
  otpChallenges,
  /* `user` mulai dari 1000, bukan 1: user hasil seeder sudah memakai id 1-3 dan
   100-145, jadi counter yang mulai kecil akan bertabrakan dengan user sungguhan
   yang baru dibuat dan `GET /users/{id}` akan mengembalikan orang yang salah. */
counters: { job: 1, message: 1000, notification: 100, otp: 1, user: 1000 },
  /* Password akun mock, key = email. Hanya untuk demo frontend, bukan kontrak backend. */
  passwords: new Map<string, string>(users.map(u => [u.email, u.role === 'admin' ? 'admin123' : 'password'])),
}

export const nowIso = () => new Date().toISOString()

export function userById(id: number): User | undefined {
  return db.users.find(u => u.id === id)
}

export function driverById(id: number): Driver | undefined {
  const profile = db.drivers.find(d => d.id === id)
  if (!profile) return undefined
  return { ...profile, user: userById(profile.user_id)! }
}

export function driverByUserId(userId: number): Driver | undefined {
  const profile = db.drivers.find(d => d.user_id === userId)
  if (!profile) return undefined
  return { ...profile, user: userById(profile.user_id)! }
}

export function rideById(id: number): Ride | undefined {
  return db.rides.find(r => r.id === id)
}

export function rideByCode(code: string): Ride | undefined {
  return db.rides.find(r => r.ride_code === code)
}

export function activeRideForUser(userId: number, role: 'user' | 'driver'): Ride | undefined {
  return db.rides.find(r => {
    if (role === 'user') return r.customer_id === userId && ['searching', 'driver_assigned', 'driver_arrived', 'in_progress'].includes(r.status)
    if (r.driver_id === null) return false
    const profile = db.drivers.find(d => d.id === r.driver_id)
    return profile?.user_id === userId && ['driver_assigned', 'driver_arrived', 'in_progress'].includes(r.status)
  })
}

/**
 * Menambahkan satu langkah riwayat status pada perjalanan.
 *
 * Satu fungsi dipakai semua tempat yang memindahkan status, karena bentuknya
 * harus persis sama dengan `RideStatusHistoryResource`. Kalau setiap call site
 * menulis literal sendiri, bentuknya pasti akan berbeda di satu tempat dan
 * timeline akan kosong di sana tanpa error.
 */
export function pushHistory(
  ride: Ride,
  to: Ride['status'],
  changedByRole: RideStatusHistory['changed_by_role'],
  changedByUserId: number | null,
  note: string | null = null,
): void {
  ride.status_histories.push({
    from_status: ride.status,
    to_status: to,
    to_status_label: RIDE_STATUS_LABELS[to],
    changed_by_role: changedByRole,
    changed_by_user_id: changedByUserId,
    note,
    at: nowIso(),
  })
  ride.status = to
  ride.updated_at = nowIso()
}

export function rideWithRelations(ride: Ride): Ride {
  const customer = userById(ride.customer_id)
  const driver = ride.driver_id ? driverById(ride.driver_id) : null
  const rating = ride.rating ?? (ride.status === 'completed' && ride.id % 3 === 0
    ? {
        id: ride.id * 10,
        reviewer_id: ride.customer_id,
        score: 5,
        comment: 'Driver ramah dan cepat. Pasti langganan!',
        tags: ['ramah', 'tepat waktu'],
        created_at: ride.completed_at ?? ride.updated_at,
      }
    : null)
  return { ...ride, customer, driver, rating }
}

export function paymentsForRide(rideId: number): Payment | undefined {
  const ride = rideById(rideId)
  if (!ride) return undefined
  return {
    id: rideId * 7,
    ride_id: rideId,
    method: ride.payment_method,
    amount: ride.fare,
    status: ride.payment_status,
    reference: `INV-${ride.ride_code}-${(rideId * 7919) % 100000}`,
    paid_at: ride.payment_status === 'paid' ? (ride.completed_at ?? ride.updated_at) : null,
    created_at: ride.created_at,
  }
}

export function buildChartSeries(days = 14): ChartPoint[] {
  const rnd = seeded(99)
  const series: ChartPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const rides = 120 + Math.round(rnd() * 180)
    const cancelled = Math.round(rides * (0.04 + rnd() * 0.06))
    const completed = rides - cancelled
    series.push({
      date: d.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d),
      rides,
      completed,
      cancelled,
      gmv: completed * (16_000 + Math.round(rnd() * 9_000)),
    })
  }
  return series
}
