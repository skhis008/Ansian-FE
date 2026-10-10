/**
 * ============================================================
 *  DOMAIN TYPES — cerminan langsung dari Laravel Eloquent
 *  Aturan kontrak dengan backend:
 *  1. Semua tanggal = string ISO-8601 (Laravel default serialize)
 *  2. Semua nilai uang = integer Rupiah TANPA titik/pemisah
 *  3. Enum = string lowercase sesuai kolom DB
 *  4. Response list dibungkus { data, links, meta } (Laravel Resource Collection)
 * ============================================================
 */

/* ---------- Enums (harus sama dengan value di Laravel) ---------- */

/**
 * Role pengguna, mengikuti `App\Enums\UserRole` di `Ajem-UDINUS-BE`.
 *
 * Peran penumpangnya bernama **`user`**, bukan `customer`. Alasannya ada di
 * ADR-011 pada `docs/DECISIONS.md` sisi backend: peran itu hanya menyatakan
 * "bukan admin dan bukan driver", dan menamainya `customer` akan berbenturan
 * dengan istilah yang di tempat lain sudah dipakai untuk orang yang memesan
 * perjalanan.
 */
export const USER_ROLES = ['user', 'driver', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const USER_STATUSES = ['active', 'pending', 'suspended'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const DRIVER_STATUSES = ['offline', 'idle', 'busy'] as const
export type DriverStatus = (typeof DRIVER_STATUSES)[number]

export const VEHICLE_TYPES = ['motorcycle'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

/**
 * Status perjalanan, mengikuti `App\Enums\RideStatus` di `Ajem-UDINUS-BE`.
 *
 * Backend punya **sembilan** status, bukan tujuh. Yang FE sebelumnya punya
 * (`cancelled`, `failed`) digantikan oleh empat status yang lebih spesifik:
 * pembatalan tahu **siapa** yang membatalkan, dan kegagalan mencari driver
 * dipisahkan dari kegagalan yang bisa dicoba lagi. Frontend yang memakai
 * `cancelled` tanpa tahu siapa yang membatalkan akan menampilkan kalimat yang
 * sama untuk dua kejadian yang berbeda.
 *
 * Tabel transisinya ada di `RIDE_NEXT` di bawah, bukan ditulis ulang di
 * tiap layar.Menyalinnya berarti status baru bisa lolos ke satu layar dan tidak
 * ke layar lain, dan tidak ada yang mengetahuinya.
 */
export const RIDE_STATUSES = [
  'searching',
  'driver_assigned',
  'driver_arrived',
  'in_progress',
  'completed',
  'passenger_cancelled',
  'driver_cancelled',
  'no_driver_found',
  'rejected',
] as const
export type RideStatus = (typeof RIDE_STATUSES)[number]

export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  searching: 'Mencari driver',
  driver_assigned: 'Driver menuju lokasi',
  driver_arrived: 'Driver sudah di lokasi',
  in_progress: 'Dalam perjalanan',
  completed: 'Perjalanan selesai',
  passenger_cancelled: 'Dibatalkan penumpang',
  driver_cancelled: 'Dibatalkan driver',
  no_driver_found: 'Tidak ada driver tersedia',
  rejected: 'Mencari driver lagi',
}

/**
 * Transisi yang diizinkan, cerminan `RideStatus::allowedNext()`.
 *
 * Backend menjawab `409 invalid_transition` kalau lompat langkah, jadi daftar
 * ini untuk menentukan tombol mana yang tampil — bukan untuk memutuskan
 * transisi. Yang menentukan tetap server.
 */
export const RIDE_NEXT: Record<RideStatus, readonly RideStatus[]> = {
  searching: ['driver_assigned', 'passenger_cancelled', 'driver_cancelled', 'no_driver_found', 'rejected'],
  driver_assigned: ['driver_arrived', 'passenger_cancelled', 'driver_cancelled'],
  driver_arrived: ['in_progress', 'passenger_cancelled', 'driver_cancelled'],
  in_progress: ['completed'],
  // Driver yang ditolak kembali ke `searching`, dan itulah satu-satunya jalan
  // keluar dari status ini.
  rejected: ['searching'],
  completed: [],
  passenger_cancelled: [],
  driver_cancelled: [],
  no_driver_found: [],
}

/** Status yang tidak bisa ditinggalkan — cerminan `RideStatus::isTerminal()`. */
export const RIDE_TERMINAL_STATUSES = [
  'completed',
  'passenger_cancelled',
  'driver_cancelled',
  'no_driver_found',
] as const satisfies readonly RideStatus[]

/** Status yang membatalkan perjalanan, dengan pelaku yang mengharuskannya. */
export const RIDE_CANCELLED_STATUSES = ['passenger_cancelled', 'driver_cancelled', 'no_driver_found'] as const

/** Status perjalanan yang masih berjalan — cerminan `RideStatus::isActive()`. */
export const RIDE_ACTIVE_STATUSES = [
  'searching',
  'driver_assigned',
  'driver_arrived',
  'in_progress',
] as const satisfies readonly RideStatus[]

export function isRideCancelled(status: RideStatus): boolean {
  return (RIDE_CANCELLED_STATUSES as readonly RideStatus[]).includes(status)
}

/**
 * Perjalanan yang sudah selesai dan tidak akan bergerak lagi — selesai atau
 * dibatalkan. Bedanya dengan `isRideCancelled`: perjalanan `completed` bukan
 * pembatalan, tapi sama-sama tidak punya tombol berikutnya.
 */
export function isRideSettled(status: RideStatus): boolean {
  return (RIDE_TERMINAL_STATUSES as readonly RideStatus[]).includes(status)
}

export function isRideActive(status: RideStatus): boolean {
  return (RIDE_ACTIVE_STATUSES as readonly RideStatus[]).includes(status)
}

export function canRideTransitionTo(from: RideStatus, to: RideStatus): boolean {
  return RIDE_NEXT[from].includes(to)
}

export const PAYMENT_METHODS = ['cash', 'qris'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
}

export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'refunded', 'failed'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Belum Bayar',
  pending: 'Menunggu',
  paid: 'Lunas',
  refunded: 'Dikembalikan',
  failed: 'Gagal',
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Aktif',
  pending: 'Menunggu',
  suspended: 'Ditangguhkan',
}

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  offline: 'Offline',
  idle: 'Online',
  busy: 'Menjalankan Perjalanan',
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  motorcycle: 'Motor',
}

export const VERIFICATIONS = ['pending', 'verified', 'rejected'] as const
export type Verification = (typeof VERIFICATIONS)[number]

export const VERIFICATION_LABELS: Record<Verification, string> = {
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
}

export const SERVICE_TYPES = ['instant', 'scheduled'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const CANCEL_REASONS = [
  'customer_cancel',
  'driver_cancel',
  'no_driver',
  'customer_no_show',
  'driver_no_show',
  'wrong_address',
  'other',
] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

export const CHAT_MESSAGE_TYPES = ['text', 'system', 'location', 'image'] as const
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number]

/* ---------- Shared ---------- */

export interface LatLng {
  lat: number
  lng: number
}

export interface Place extends LatLng {
  address: string
  place_name?: string | null
}

/** Laravel `Illuminate\Http\Resources\Json\Resource` */
export interface ApiResource<T> {
  data: T
  meta?: Record<string, unknown>
  links?: Record<string, string>
}

/** Laravel paginator response */
export interface Paginated<T> {
  data: T[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}

/* ---------- User ---------- */

export interface User {
  id: number
  name: string
  email: string
  phone: string
  role: UserRole
  /** Label Bahasa Indonesia dari backend (`UserRole::label()`). Tampilkan ini, bukan `role`. */
  role_label?: string
  avatar_url: string | null
  status: UserStatus
  rating: number | null
  rating_count: number
  email_verified_at: string | null
  phone_verified_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Hasil login atau registrasi yang berhasil.
 *
 * `access_token` dan `refresh_token` ada di kontrak backend, tapi TIDAK pernah
 * sampai ke klien: route catch-all menyimpannya di cookie httpOnly dan
 * menghapusnya dari respons sebelum dikirim ke browser. Field keduanya
 * dicantumkan supaya bentuk responsnya terdokumentasi, bukan supaya dibaca.
 */
export interface AuthPayload {
  access_token?: string
  refresh_token?: string
  token_type?: 'Bearer'
  expires_in?: number
  user: User
}

/* ---------- Driver ---------- */

export interface DriverProfile {
  id: number
  user_id: number
  driver_code: string
  status: DriverStatus
  /** Data mahasiswa — wajib untuk driver (khusus mahasiswa) */
  student_id: string
  campus: string
  study_program: string
  verification: Verification
  vehicle_type: VehicleType
  vehicle_plate: string
  vehicle_color: string
  vehicle_model: string
  photo_url: string | null
  lat: number | null
  lng: number | null
  last_seen_at: string | null
  rating: number
  total_rides: number
  online_hours: number
  earnings_today: number
  earnings_month: number
}

export interface Driver extends DriverProfile {
  user: User
  /**
   * Nama driver's account, diisi `normalizeRide` dari `RideResource` backend.
   *
   * Backend menyandikan `driver` ke user yang datanya sudah diratakan, jadi
   * tidak ada objek `user` di dalamnya — sementara mock tetap menyimpan
   * `user`. Dua-duanya dibaca di `RideCard`.
   */
  name?: string
}

/* ---------- Ride ---------- */

/**
 * Satu langkah riwayat status, mengikuti `RideStatusHistoryResource`.
 *
 * Backend mencatat **dari status mana ke status mana**, bukan sekadar status
 * akhirnya. `from_status` membedakan dua kejadian yang kalau hanya ditulis
 * status akhirnya akan terlihat sama, dan `changed_by_role` menandai siapa yang
 * menekan tombolnya — bukan siapa yang disebut di catatan.
 */
export interface RideStatusHistory {
  from_status: RideStatus | null
  to_status: RideStatus
  to_status_label: string
  changed_by_role: 'passenger' | 'driver' | 'system'
  changed_by_user_id: number | null
  note: string | null
  at: string
}

export interface RideRating {
  id: number
  reviewer_id: number
  score: number
  comment: string | null
  tags: string[]
  created_at: string
}

export interface Ride {
  id: number
  ride_code: string
  status: RideStatus
  service_type: ServiceType
  scheduled_at: string | null
  pickup: Place
  destination: Place
  pickup_note: string | null
  distance_km: number
  duration_min: number
  fare: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  cancel_reason: CancelReason | null
  customer_id: number
  driver_id: number | null
  customer?: User
  driver?: Driver | null
  rating?: RideRating | null
  status_histories: RideStatusHistory[]
  started_at: string | null
  arrived_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Pratinjau tarif dari `POST /api/v1/rides/preview`.
 *
 * Backend menghitung tarif dari tarif dasar plus kilometer, bukan dari zona.
 * Bentuk ini ikut apa adanya supaya rincian yang tampil di layar ini sama
 * persis dengan yang dipakai server saat memesan — README menyatakan itu sebagai
 * syarat, bukan pilihan.
 *
 * `duration_min` tidak ada karena backend tidak menyimpannya.
 */
export interface FareQuote {
  distance_meters: number
  /** Kilometer yang ditagih, setelah pembulatan ke atas. */
  billable_kilometres: number
  base_fare: number
  per_km_rate: number
  minimum_fare: number
  discount_amount: number
  promo_code: string | null
  surcharge: { code: string; name: string; kind: string; value: number; amount: number } | null
  total: number
  currency: string
}

export interface Payment {
  id: number
  ride_id: number
  method: PaymentMethod
  amount: number
  status: PaymentStatus
  reference: string
  paid_at: string | null
  created_at: string
}

/**
 * Hasil permintaan kode OTP.
 *
 * Backend sengaja membalas bentuk yang sama apakah email-nya terdaftar atau
 * tidak, jadi field ini tidak pernah bisa dipakai untuk menebak keberadaan
 * sebuah akun. `_dev_code` hanya ada di mock dan TIDAK ADA di Laravel — kode OTP
 * sungguhan hanya ditulis ke `storage/logs/laravel.log` sampai SMTP dipasang.
 */
export interface OtpRequestPayload {
  data?: { expires_in?: number }
  message?: string
}

/* ---------- Chat ---------- */

export interface Conversation {
  id: number
  type: 'ride' | 'support'
  ride_id: number | null
  ride_code: string | null
  counterpart: User
  last_message: ChatMessage | null
  unread_count: number
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  conversation_id: number
  sender_id: number
  sender_name: string
  is_mine: boolean
  body: string
  type: ChatMessageType
  attachment_url: string | null
  attachment_meta: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

/* ---------- Notification ---------- */

export interface AppNotification {
  id: number
  type: 'ride' | 'chat' | 'payment' | 'promo' | 'system'
  title: string
  body: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

/* ---------- Admin ---------- */

/**
 * Ringkasan dasbor, mengikuti `DashboardStatsSchema` di `Ajem-UDINUS-BE`.
 *
 * Field `revenue_today`, `revenue_month`, dan `pending_complaints` yang ada di
 * versi sebelumnya DIHAPUS, bukan disembunyikan. ADR-038 di backend menjelaskan
 * alasannya: ADR-035 menetapkan uang tidak pernah singgah di aplikasi, jadi
 * tidak ada komisi yang bisa dihitung, dan pengaduan belum punya tabel.
 *
 * Menampilkan nol untuk keduanya juga bukan perbaikan, karena nol untuk klaim
 * yang belum ada sama saja mengarang angka.
 */
export interface DashboardStats {
  /** Sepanjang waktu, bukan mengikuti periode. */
  total_rides: number
  /** Perjalanan yang dibuat dalam periode yang diminta. */
  rides_in_period: number
  total_users: number
  customers: number
  drivers: number
  online_drivers: number
  active_rides: number
  /** Ongkos perjalanan **selesai**. Perjalanan dibatalkan tidak dihitung. */
  gmv_in_period: number
  average_fare: number
  completion_rate: number
  cancellation_rate: number
  average_driver_rating: number
  rides_change_pct: number
  gmv_change_pct: number
}

export interface ChartPoint {
  date: string
  label: string
  rides: number
  gmv: number
  completed: number
  cancelled: number
}

export interface TopDriver {
  id: number
  name: string
  avatar_url: string | null
  vehicle_plate: string | null
  total_rides: number
  /** GMV dari perjalanan yang selesai. */
  gmv: number
  /** Setoran tunai yang dikumpulkan driver. QRIS tidak melewati aplikasi. */
  collected_cash: number
}

export interface RevenueByVehicleType {
  vehicle_type: VehicleType
  label: string
  rides: number
  gmv: number
  percentage: number
}

export interface SystemSetting {
  key: string
  value: string
  group: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'text'
}

/* ---------- Driver job queue ---------- */

export interface DriverJob {
  id: number
  ride_id: number
  /** Driver yang sudah dikunci ke job ini (null = terbuka untuk semua driver) */
  driver_id: number | null
  ride_code: string
  pickup: Place
  destination: Place
  distance_km: number
  duration_min: number
  fare: number
  customer_name: string
  customer_rating: number
  distance_to_pickup_km: number
  expires_in_seconds: number
  created_at: string
}

export interface DriverEarnings {
  today: number
  week: number
  month: number
  total: number
  trips_today: number
  trips_week: number
  trips_month: number
  average_fare: number
  series: ChartPoint[]
}

/* ---------- Normalisasi respons backend ---------- */

/**
 * Bentuk ride yang dikirim `RideResource` di backend.
 *
 * Beda dari `Ride` di atas pada tiga hal: tarifnya bersarang (`fare` objek,
 * bukan angka), jarak dalam meter, dan pembayarannya tidak ada di ride sama
 * sekali — pembayaran hidup di `/rides/{ride}/payment`.
 */
export interface RideResourceShape {
  id: number
  ride_code: string
  status: RideStatus
  status_label: string
  active: boolean
  fare: {
    currency: string
    distance_meters: number
    base_fare: number
    per_km_rate: number
    minimum_fare: number
    discount_amount: number
    promo_code: string | null
    total: number
    surcharge: { code: string; name: string; kind: string; value: number; amount: number } | null
  }
  pickup: { address: string; lat: number; lng: number; note: string | null }
  dropoff: { address: string; lat: number; lng: number; note: string | null }
  passenger?: { id: number; name: string } | null
  driver?: { id: number; name: string; rating: { average: number; count: number } } | null
  vehicle?: { id: number; plate_number: string; brand: string; model: string; color: string } | null
  vehicle_type?: { id: number; code: string; name: string } | null
  cancellation?: { by: string; by_label: string; reason: string | null; at: string } | null
  milestones: {
    assigned_at: string | null
    arrived_at: string | null
    started_at: string | null
    completed_at: string | null
    cancelled_at: string | null
  }
  status_history: RideStatusHistory[]
  created_at: string
  updated_at: string
}

/**
 * Mengubah bentuk backend menjadi bentuk yang dipakai komponen.
 *
 * Dipisah ke satu fungsi supaya perbedaan kontrak ada di satu tempat. Kalau
 * tiap komponen membaca field backend langsung, setiap perbedaan jadi error
 * 500 di halaman yang berbeda — dan yang pertama baru terlihat saat halamannya
 * dibuka, bukan saat kodenya ditulis.
 *
 * Yang TIDAK ada di backend dan karena itu dibiarkan kosong: durasi perjalanan,
 * metode dan status pembayaran, serta nilai rating ride. Menebaknya berarti
 * mengarang angka yang ditampilkan ke pengguna seolah berasal dari server.
 */
export function normalizeRide(raw: RideResourceShape): Ride {
  const distanceKm = raw.fare.distance_meters / 1000
  const driverRating = raw.driver?.rating

  return {
    id: raw.id,
    ride_code: raw.ride_code,
    status: raw.status,
    service_type: 'instant',
    scheduled_at: null,
    pickup: { ...raw.pickup },
    destination: { ...raw.dropoff },
    pickup_note: raw.pickup.note,
    distance_km: Number(distanceKm.toFixed(2)),
    // Backend tidak menyimpan durasi. `0` berarti "tidak diketahui", dan
    // komponen harus menampilkan itu — bukan mengarang angka.
    duration_min: 0,
    fare: raw.fare.total,
    payment_method: null,
    payment_status: null,
    cancel_reason: null,
    customer_id: raw.passenger?.id ?? 0,
    driver_id: raw.driver?.id ?? null,
    customer: raw.passenger ? ({ ...raw.passenger, role: 'user' } as User) : undefined,
    driver: raw.driver
      ? ({
          id: raw.driver.id,
          user_id: raw.passenger?.id ?? 0,
          name: raw.driver.name,
          rating: driverRating?.average ?? 0,
          rating_count: driverRating?.count ?? 0,
          vehicle_plate: raw.vehicle?.plate_number ?? '',
          vehicle_color: raw.vehicle?.color ?? '',
          vehicle_model: [raw.vehicle?.brand, raw.vehicle?.model].filter(Boolean).join(' '),
        } as unknown as Driver)
      : null,
    rating: null,
    status_histories: raw.status_history ?? [],
    started_at: raw.milestones?.started_at ?? null,
    arrived_at: raw.milestones?.arrived_at ?? null,
    completed_at: raw.milestones?.completed_at ?? null,
    cancelled_at: raw.milestones?.cancelled_at ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  } as unknown as Ride
}

/** Normalisasi satu halaman daftar perjalanan. */
export function normalizeRides(raw: { data?: RideResourceShape[] } | null | undefined): Ride[] {
  return (raw?.data ?? []).map(normalizeRide)
}
