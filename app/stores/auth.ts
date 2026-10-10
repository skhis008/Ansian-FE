import { defineStore } from 'pinia'
import type { AuthPayload, Driver, User } from '#shared/types'
import { ApiError, http } from '~/composables/useApi'

interface AuthState {
  user: User | null
  driver: Driver | null
  initialized: boolean
  loading: boolean
  /** Email yang menunggu verifikasi OTP, atau null */
  verifyingEmail: string | null
  /** Tujuan setelah verifikasi selesai */
  verifyRedirect: string | null
}

/**
 * Beranda tiap peran.
 *
 * Nilai untuk `user` adalah `/customer`, bukan `/user`: halaman dan URL-nya
 * memang tentang memesan perjalanan, dan mengganti URL yang sudah ada akan
 * membuat tautan lama dan bookmark mati tanpa manfaat apa pun. Yang
 * berubah adalah **nilai peran** di kontrak (`user`), bukan nama foldernya.
 *
 * `ROLE_HOME` dipetakan dari `User['role']` yang lengkap, jadi peran baru di
 * backend akan gagal di typecheck di sini alih-alih menghasilkan `undefined`
 * yang diam-diam membuat `navigateTo(undefined)`.
 */
const ROLE_HOME: Record<User['role'], string> = {
  user: '/customer',
  driver: '/driver',
  admin: '/admin',
}

/**
 * Autentikasi.
 *
 * Token TIDAK ada di state ini dan tidak ada di `localStorage`. Pasangan token
 * disimpan route catch-all di cookie httpOnly (`server/utils/tokenVault.ts`),
 * dan klien hanya pernah melihat `user`. Menyimpan token di state Pinia akan
 * menaruhnya di memori halaman yang bisa dibaca skrip mana pun yang
 * berhasil disuntik, dan state Pinia juga ikut ter-serialize ke payload SSR
 * sehingga bisa bocor ke HTML.
 *
 * Kontrak mengikuti `Ajem-UDINUS-BE/routes/api.php`:
 * - `POST /auth/register` membalas 201 + token, email BELUM terverifikasi
 * - `POST /auth/login` membalas 200 + token
 * - Verifikasi email adalah langkah TERPISAH: `POST /auth/otp/verify` hanya
 *   mengisi `email_verified_at` dan tidak mengembalikan token
 * - Tidak ada "tantangan OTP" saat login. Yang ada di mock lama tidak punya
 *   padanan di backend, jadi login tidak lagi bisa berakhir di halaman kode.
 */
export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    driver: null,
    initialized: false,
    loading: false,
    verifyingEmail: null,
    verifyRedirect: null,
  }),

  getters: {
    isAuthenticated: state => Boolean(state.user),
    role: state => state.user?.role ?? null,
    isUser: state => state.user?.role === 'user',
    isDriver: state => state.user?.role === 'driver',
    isAdmin: state => state.user?.role === 'admin',
    /** Email belum terverifikasi = pemesanan perjalanan akan ditolak backend. */
    needsEmailVerification: state => state.user !== null && state.user.email_verified_at === null,
    homePath: state => (state.user ? ROLE_HOME[state.user.role] : '/login'),
    displayName: state => state.user?.name ?? 'Tamu',
  },

  actions: {
    /** Dipanggil sekali dari app.vue / middleware — cookie dulu, SSR-friendly. */
    /**
     * Membaca profil dari server.
     *
     * Ini untuk memuat state di awal halaman. Kalau gagal, `user` dibersihkan —
     * memang belum ada sesi dan memang tidak ada yang perlu dijaga.
     *
     * Untuk menyegarkan profil **setelah** login, jangan pakai ini: lihat
     * `refreshProfile()`. Fungsinya berbeda dan mencampurkan keduanya membuat
     * login yang berhasil dihapus kembali jadi tidak terautentikasi.
     */
    async fetchUser(force = false) {
      if (this.initialized && !force) return this.user
      try {
        const res = await http.get<{ data: User & { driver?: Driver | null } }>('/auth/me', undefined, { silent: true })
        this.user = res.data
        this.driver = res.data.driver ?? null
      } catch {
        this.user = null
        this.driver = null
      } finally {
        this.initialized = true
      }
      return this.user
    },

    /**
     * Menyegarkan profil tanpa menghapus sesi yang sudah ada.
     *
     * Kegagalan di sini berarti profilnya tidak terisi, BUKAN berarti sesinya
     * batal. Kalau `user` ikut dikosongkan, satu request yang gagal sementara
     * akan:
//     *
     *   1. `adopt()` mengembalikan `payload.user`, jadi pemanggil mengira login
     *      berhasil
     *   2. `login.vue` navigasi ke beranda
     *   3. middleware melihat `isAuthenticated` false dan melempar balik ke
     *      `/login`
     *
     * Gejalanya: "sudah benar-benar masuk tapi halaman balik ke login lagi".
     */
    async refreshProfile(): Promise<User | null> {
      try {
        const res = await http.get<{ data: User & { driver?: Driver | null } }>('/auth/me', undefined, { silent: true })
        this.user = res.data
        this.driver = res.data.driver ?? null
      } catch {
        /* biarkan state yang ada: profil basi lebih baik daripada logout palsu */
      }
      this.initialized = true
      return this.user
    },

    /**
     * Login. Backend membalas token langsung — tidak ada tahap OTP di sini.
     * Device trust dihapus: tidak ada padanannya di Sanctum, dan menyimpan
     * "perangkat ini sudah dipercaya" di browser berarti jalan pintas yang
     * tidak bisa dicabut dari sisi server.
     */
    async login(email: string, password: string): Promise<User> {
      this.loading = true
      try {
        const res = await http.post<{ data: AuthPayload }>('/auth/login', { email: email.trim().toLowerCase(), password })
        const user = await this.adopt(res.data)
        if (!user.email_verified_at) {
          this.verifyingEmail = user.email
        }
        return user
      } catch (e) {
        throw e instanceof ApiError ? e : new ApiError('Gagal masuk.', 500)
      } finally {
        this.loading = false
      }
    },

    /**
     * Registrasi. Backend membalas 201 + token, jadi pengguna sudah masuk —
     * tetapi email belum terverifikasi, dan pemesanan perjalanan ditolak sampai
     * itu selesai. Field `role` dan `phone` TIDAK dikirim: `RegisterUserRequest`
     * tidak punya keduanya, dan peran selalu `user` dari sisi server.
     */
    async register(payload: { name: string; email: string; password: string; password_confirmation?: string }): Promise<User> {
      this.loading = true
      try {
        const res = await http.post<{ data: AuthPayload }>('/auth/register', {
          name: payload.name.trim(),
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
          password_confirmation: payload.password_confirmation ?? payload.password,
        })
        const user = await this.adopt(res.data)
        this.verifyingEmail = user.email
        return user
      } catch (e) {
        throw e instanceof ApiError ? e : new ApiError('Gagal mendaftar.', 500)
      } finally {
        this.loading = false
      }
    },

    /**
     * Minta kode OTP.
     *
     * Backend membalas jawaban yang sama apakah email terdaftar atau tidak, jadi
     * layar ini tidak pernah bisa dipakai untuk menebak apakah suatu email
     * punya akun. `_dev_code` hanya ada saat mock aktif dan tidak pernah ada di
     * respons Laravel.
     */
    async requestOtp(email: string, purpose: 'registration' | 'login'): Promise<void> {
      this.loading = true
      try {
        await http.post('/auth/otp/request', { email: email.trim().toLowerCase(), purpose })
      } finally {
        this.loading = false
      }
    },

    /** Verifikasi kode OTP. Mengisi `email_verified_at`, tidak memberikan token. */
    async verifyOtp(code: string): Promise<void> {
      const email = this.verifyingEmail
      if (!email) throw new ApiError('Sesi verifikasi tidak valid. Ulangi proses.', 422)

      this.loading = true
      try {
        await http.post('/auth/otp/verify', { email, purpose: 'registration', code })
        await this.refreshProfile()
        this.verifyingEmail = null
      } catch (e) {
        throw e instanceof ApiError ? e : new ApiError('Gagal memverifikasi kode.', 500)
      } finally {
        this.loading = false
      }
    },

    clearVerification() {
      this.verifyingEmail = null
    },

    async logout() {
      // Token dicabut lebih dulu supaya logout tetap berarti di server, walau
      // cookie lokal sudah tidak bisa dihapus (mis. karena header yang
      // dipanggil proxy tidak sampai ke browser).
      await http.post('/auth/logout').catch(() => undefined)
      this.$reset()
      this.initialized = true
    },

    /**
     * Profil sendiri lewat `PATCH /users/{id}`.
     *
     * Backend hanya menerima `name`, `email`, `password`, dan `role` — dan `role`
     * ditolak 422 kalau pengirim bukan admin. `phone` dan `avatar_url` tidak ikut
     * dikirim karena tabel `users` belum punya keduanya; mengirimnya cuma
     * menambah field yang server abaikan.
     */
    async updateProfile(payload: Partial<Pick<User, 'name'>>) {
      if (!this.user) throw new ApiError('Silakan masuk terlebih dahulu.', 401)
      const body: Record<string, unknown> = {}
      if (payload.name !== undefined) body.name = payload.name
      const res = await http.patch<{ data: User }>(`/users/${this.user.id}`, body)
      this.user = res.data
      if (this.isDriver) await this.refreshProfile()
      return res.data
    },

    can(area: string) {
      if (!this.user) return false
      switch (area) {
        case 'customer':
        case 'user':
          return this.user.role === 'user'
        case 'driver':
          return this.user.role === 'driver'
        case 'admin':
          return this.user.role === 'admin'
        default:
          return true
      }
    },

    /** Menyimpan hasil login/registrasi, lalu ambil profil segar dari server. */
    async adopt(payload: AuthPayload): Promise<User> {
      this.initialized = true
      if (payload.user) this.user = payload.user
      // Respons login belum selalu memuat relasi `driver`, jadi `/auth/me`
      // dipakai sebagai sumber kebenaran — lewat `refreshProfile`, bukan
      // `fetchUser`, supaya kegagalan di sana tidak mengosongkan sesi ini.
      const fresh = await this.refreshProfile()
      return fresh ?? payload.user
    },
  },
})

export { ROLE_HOME }