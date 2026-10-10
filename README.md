# Ansian — Antar Jemput Dinusian

Frontend **Ansian (Antar Jemput Dinusian)** — layanan antar jemput berbasis motor kawasan Udinus/Semarang.
Nuxt 4 + Vue 3 + TypeScript + Tailwind CSS 4.

> **Repo ini dipakai bareng, bukan sendirian.**
> Kalau kamu anggota tim: baca **[Kolaborasi](#kolaborasi--untuk-anggota-tim)** dulu,
> terutama bagian [Sebelum Ngoding](#sebelum-ngoding-wajib), sebelum mulai ngoding.

Dua pilar produk:

1. **Tarif lebih terjangkau & transparan** — zona jarak (hijau/kuning/jingga/merah), tanpa surge, tanpa biaya tersembunyi.
2. **Lowongan kerja sampingan bagi mahasiswa** — driver khusus mahasiswa (NIM + kampus, diverifikasi admin).

## Fitur

- **Pelanggan** — pesan perjalanan (motor), kirim barang, peta, chat, checkout **Tunai/QRIS**, riwayat, verifikasi kode email (OTP)
- **Driver (mahasiswa)** — pendaftaran via `/driver/daftar` (NIM, kampus, prodi), banner status verifikasi, permintaan order, pendapatan, profil kendaraan
- **Admin** — dashboard, verifikasi driver, pengguna, perjalanan, transaksi (termasuk **Tandai Lunas**), laporan, pengaturan zona tarif
- **Peta** — Leaflet + OpenStreetMap (pusat default: Kampus Udinus `-6.982835, 110.4093524`)
- **State** — Pinia · **Chart** — komponen chart internal (tanpa ECharts)

## Stack

| Layer | Teknologi |
| --- | --- |
| Framework | Nuxt 4 (Vue 3, Composition API, TypeScript strict) |
| Styling | Tailwind CSS 4 |
| State | Pinia |
| Maps | Leaflet + OpenStreetMap |
| Realtime | Laravel Echo + Pusher/Reverb (opsional) |
| Backend | Laravel (`CUKLIZ/Ajem-UDINUS-BE`) |

## Menjalankan

Prasyarat: **Node.js >= 20.19.0** (lihat `package.json` → `engines`).

```bash
npm install        # atau `npm ci` kalau ikut lockfile persis
npm run dev        # http://localhost:3000
npm run typecheck  # vue-tsc
npm run lint       # ESLint (flat config via @nuxt/eslint)
npm run build && npm run preview
```

Server default hanya bind ke `localhost` — **dari HP / device lain** perlu ekspos network:

```bash
npm run dev -- --host
```

> Catatan environment Termux: file bin `node_modules` dengan shebang `#!/usr/bin/env node`
> perlu di-patch bila `/usr/bin/env` tidak ada (`sed -i "1s|.*|#!$(which node)|" <file>`).

### Login demo

Default app memakai mock API bawaan, jadi bisa langsung login tanpa backend:

| Role | Email | Password |
| --- | --- | --- |
| Pelanggan | `customer@ansian.id` | `password` |
| Driver | `driver@ansian.id` | `password` |
| Admin | `admin@ansian.id` | `admin123` |

Login/registrasi meminta **kode OTP 6 digit** (mode mock: kode tampil di layar sebagai `dev_code`,
produksi Laravel mengirim via email). Perangkat yang lolos OTP diberi cookie `ans_device` (percaya 30 hari),
sehingga login berikutnya cukup password.

---

# Kolaborasi — Untuk Anggota Tim

## Sebelum Ngoding (Wajib)

Lima aturan ini. Kalau ada yang dilewati, ujung-ujungnya konflik dan capek.

### 1. Selalu tarik perubahan terbaru dulu

```bash
git pull                 # kalau sudah di main
git pull --rebase        # kalau sedang di branch sendiri
```

Jangan mulai coding dari versi kode yang sudah berubah oleh orang lain. Kalau sedang di branch kamu, `git pull --rebase` supaya commit kamu menumpuk di atas kode orang lain dan diff-nya enak dibaca.

### 2. Never push langsung ke `main`

`main` itu versi yang dipakai bersama. Semua perubahan lewat **branch + Pull Request**, biar orang lain bisa review dulu.

```bash
git switch -c feature/nama-fitur      # atau fix/nama-bug, docs/nama-dok
```

### 3. Jangan commit hasil build & dependency

Sudah otomatis ke-ignore lewat `.gitignore` (`node_modules`, `.output`, `.nuxt`, `.env*`).
Tapi sebelum commit, **cek dulu**:

```bash
git status
```

Kalau muncul `node_modules/` atau `.output/` di daftar — itu `.gitignore` ketimpa. Jangan dipaksakan commit.

### 4. Commit kecil & satu tujuan

Satu commit = satu alasan. Jangan campur refactor, fixes, dan fitur dalam satu commit. PR yang 5 commit lebih gampang di-review daripada 1 commit 500 baris.

### 5. Jangan edit kontrak API diam-diam

`server/utils/apiRouter.ts` itu **cermin 1:1 dari `routes/api.php` Laravel**. Path dan method harus sama persis dengan backend, supaya frontend tidak perlu diubah saat backend aktif. Kalau kamu perlu endpoint baru, bilang dulu — jangan bikin path sendiri, karena nanti tidak akan match dengan Laravel.

---

## Alur Kerja Harian

```bash
# 1. Tarik perubahan terbaru
git pull --rebase

# 2. Buat branch
git switch -c feature/chat-realtime

# 3. Ngoding...

# 4. Pastikan bersih & rapi
git status
git diff                    # baca diffmu sendiri sebelum push

# 5. Commit
git add app/components/chat/ChatWindow.vue
git commit -m "feat(chat): tampilkan indikator unread di daftar chat"

# 6. Push
git push -u origin feature/chat-realtime

# 7. Buka Pull Request di GitHub, minta review ke teammate
```

### Penamaan Branch

| Prefix | Dipakai untuk |
| --- | --- |
| `feature/` | fitur baru |
| `fix/` | perbaikan bug |
| `refactor/` | bongkar-pasang kode tanpa mengubah fungsi |
| `docs/` | dokumentasi |
| `chore/` | tooling, config, dependency |

Contoh: `feature/customer-pagination`, `fix/leaflet-marker-abnormal`, `docs/tambah-tabel-api`.

### Setelah PR di-merge

```bash
git switch main
git pull
git branch -d feature/chat-realtime   # hapus branch yang sudah selesai
```

---

## Cara Push ke GitHub

### A. First time — clone repo

```bash
git clone https://github.com/CUKLIZ/Ajem-UDINUS-FE.git
cd Ajem-UDINUS-FE
npm ci
npm run dev
```

### B. Login GitHub (sekali saja)

Repo ini **private**, jadi butuh autentikasi. Dua cara:

**Cara 1 — pakai GitHub CLI (paling gampang, recommended)**

```bash
gh auth login                                   # pilih GitHub.com → HTTPS → Login with browser
gh auth setup-git                               # bikin git otomatis pakai token gh
```

Langkah `gh auth setup-git` **wajib**. Tanpa itu, `git push` bakal berhenti minta password dan gagal — karena GitHub sudah tidak menerima password sebagai autentikasi.

Cek sudah benar:

```bash
gh auth status          # harus muncul ✓ Logged in
git config --get credential.helper    # harus ada isinya, kalau kosong berarti belum setup
```

**Cara 2 — Personal Access Token (kalau tidak pakai `gh`)**

Buat token di GitHub → Settings → Developer settings → Personal access tokens → **Classic token** (centang scope `repo`), atau fine-grained token dengan akses repo ini (Contents: Read & write). Lalu saat `git push` ditanya password, **paste token itu** di kolom password.

### C. Push

```bash
# Push pertama kali di branch baru (set tracking)
git push -u origin feature/nama-fitur

# Push berikutnya di branch yang sama
git push
```

### D. Kalau `credential.helper` belum di-set

Gejala: `git push` berhenti dan minta `Username for 'https://github.com'` / `Password`, padahal kamu nggak pernah mau input password. Fix:

```bash
gh auth setup-git
```

Atau, tanpa mengubah config global — push dengan helper gh secara inline:

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push
```

---

## Aturan Commit

Pakai **Conventional Commits** — memudahkan review dan generate changelog:

```
<type>(<scope>): <deskripsi singkat>
```

| Type | Untuk |
| --- | --- |
| `feat` | fitur baru |
| `fix` | perbaikan bug |
| `refactor` | ubah struktur, bukan perilaku |
| `style` | format/whitespace (tanpa perubahan logika) |
| `docs` | dokumentasi |
| `test` | nambah/ubah test |
| `chore` | tooling, config, dependency |
| `perf` | optimasi performa |

Scope yang umum dipakai: `chat`, `ride`, `driver`, `auth`, `admin`, `map`, `pay`, `api`, `ui`.

Contoh:

```
feat(ride): tambah pagination di riwayat perjalanan pelanggan
fix(auth): session hilang setelah hard refresh
refactor(ui): pecah RideCard jadi komponen kecil
docs(api): lengkapi tabel endpoint
chore(deps): bump nuxt ke 4.5.2
```

### Kalau ada Konflik Merge

Jangan panik, dan **jangan** langsung `git reset --hard` (itu membuang kerjaanmu).

```bash
git pull --rebase origin main
# muncul: CONFLICT (content): Merge conflict in ...

# 1. Buka file yang konflik, perbaiki tanda <<<<<<< ======== >>>>>>>
# 2. Tandai sudah beres
git add app/components/...
# 3. Lanjutkan rebase
git rebase --continue
# 4. Kalau mau batal
git rebase --abort
```

Kalau **`npm install` / `npm run dev` tiba-tiba error setelah pull**, hampir selalu karena lockfile berubah. Jalankan `npm install` ulang.

---

## Build

```bash
npm run build      # build produksi  -> .output/
npm run preview    # preview hasil build
npm run generate   # static generate (caveat: lihat di bawah)
```

### Catatan penting soal production

App ini **bukan situs statis** — ada SSR (`routeRules` → `ssr: true` untuk `/customer/**`, `/driver/**`, `/admin/**`) dan ada Nitro server routes (`server/routes/api/v1/`). Jadi:

- **Jangan** menaruh hasil build langsung di document root Apache (`/srv/httpd`) dan berharap route-nya jalan. Yang kepake cuma aset statis, SSR dan API-nya mati.
- `.output/` **harus dijalankan pakai Node**:

  ```bash
  npm run build
  node .output/server/index.mjs        # default port 3000
  # atau: PORT=8080 NITRO_HOST=127.0.0.1 node .output/server/index.mjs
  ```

  Untuk production, jalankan pakai **pm2** atau **systemd** supaya auto-restart, lalu set **Apache sebagai reverse proxy** ke `127.0.0.1:3000`. Itupun bukan "menaruh file di `/srv/httpd`" — httpd cuma proxy, file-nya tetap milik proses Node.
- `npm run generate` (fully static) **tidak disarankan** untuk app ini: halaman `/customer`, `/driver`, `/admin` jadi hollow shell tanpa SSR, dan mock API mati. Kalau memang harus, wajib `NUXT_PUBLIC_USE_MOCK=false` + arahkan ke backend Laravel.

---

## Environment

Salin `.env.example` menjadi `.env` lalu sesuaikan (`nuxt.config.ts → runtimeConfig`):

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `NUXT_API_BASE` | `http://127.0.0.1:8000` | Base URL Laravel. **Bukan `PUBLIC`** — hanya dibaca server, tidak pernah sampai ke browser |
| `NUXT_PUBLIC_USE_MOCK` | `true` | `true` = mock API bawaan, `false` = panggil Laravel |
| `NUXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL aplikasi |
| `NUXT_PUBLIC_REALTIME_*` | - | Konfigurasi Pusher/Reverb (opsional) |

**`.env` jangan pernah di-commit** — sudah ke-ignore, tapi tetap hati-hati saat `git add`.

### Kenapa `NUXT_API_BASE` bukan `NUXT_PUBLIC_API_BASE`

Browser tidak pernah memanggil Laravel secara langsung. Klien selalu memanggil
`/api/v1/*` di origin yang sama, dan route catch-all
`server/routes/api/v1/[...slug].ts` yang meneruskannya ke Laravel sambil
menempelkan header `Authorization`.

Kalau `apiBase` ada di `runtimeConfig.public`, ia dikirim ke browser di setiap
respons dan bisa dibaca siapa pun yang membuka devtools — termasuk URL internal
yang tidak perlu diketahui pengguna. Selain itu, proxy di server membuat CORS
tidak diperlukan sama sekali.

---

## Kontrak API

Semua panggilan frontend lewat `/api/v1/...`, yang **sama persis dengan path + method di `routes/api.php` Laravel**. Kalau backend aktif: set `NUXT_PUBLIC_USE_MOCK=false`, lalu file mock (`server/utils/mockApi/`) boleh dihapus **tanpa mengubah kode frontend**.

### Autentikasi

Pasangan token Laravel **tidak pernah sampai ke browser**.

```
Browser ──/api/v1/*──> server Nitro ──Bearer──> Laravel
                  ↑                ↑
        cookie httpOnly      NUXT_API_BASE (server-only)
        ans_at + ans_rt
```

`server/routes/api/v1/[...slug].ts` yang memegang seluruhnya:

1. Membaca `ans_at` (access) dan `ans_rt` (refresh) dari cookie httpOnly
2. Menempelkan `Authorization: Bearer <access>` ke request ke Laravel
3. Kalau Laravel menjawab 401 `token_expired`, memanggil `POST /auth/refresh`
   lalu mengulang request — jadi 15 menit masa access token tidak berarti
   pengguna terlempar ke halaman login
4. Kalau jawabannya `unauthenticated` yang tidak bisa dipulihkan, cookie
   dihapus supaya request berikutnya tidak membawa token mati
5. Pada login/register, menyimpan pasangan token ke cookie lalu
   **menghapusnya dari respons** — klien hanya menerima `user`

Alasan token tidak diletakkan di `localStorage` atau state Pinia: keduanya bisa
dibaca skrip yang berhasil masuk lewat XSS, dan aplikasi ini punya input bebas
dari pengguna (alamat jemput, chat, komentar penilaian). Dengan token berhenti di
server, skrip yang disuntik masih bisa mengirim request, tapi tidak bisa
mengambil token.

Konsekuensi kedua: URL backend tidak pernah dikirim ke browser, jadi **CORS
tidak diperlukan** dan URL internal tidak bocor ke devtools.

### Endpoint yang ter-cover

Endpoint yang ter-cover (semua di `server/utils/apiRouter.ts`):

| Group | Endpoint | Status |
| --- | --- | --- |
| Auth | `auth/register`, `auth/login`, `auth/logout`, `auth/me` | Ada di BE |
| OTP | `auth/otp/verify`, `auth/otp/request` | Ada di BE |
| Users | `users`, `users/:user` | Ada di BE (Pribadi lewat `users/:id`) |
| Me | `me/summary`, `me/activity` | **Belum ada di BE** |
| Rides | `rides`, `rides/:id`, `rides/:id/cancel`, `rides/:id/rating` | Ada di BE |
| Rides | `rides/:id/route`, `rides/:id/assign` | **Belum ada di BE** |
| Fare | `fares/quote` | Backend: `rides/preview`, bentuk field berbeda |
| Driver | `driver/rides/nearby`, `rides/:id/accept\|arrive\|start\|complete` | Ada di BE |
| Driver | `driver/profile/availability`, `driver/profile/location` | Ada di BE (PUT) |
| Driver | `drivers/me`, `drivers`, `drivers/nearby`, `drivers/:id`, `drivers/me/earnings`, `drivers/jobs/:ride/reject` | **Belum ada di BE** |
| Driver | `auth/sessions` | **Belum ada di BE** |
| Chat | `conversations`, `conversations/:id`, `messages/:conversation`, `conversations/:id/messages`, `conversations/:id/read` | **Belum ada di BE** |
| Notification | `notifications`, `notifications/read-all`, `notifications/:id/read` | **Belum ada di BE** |
| Payment | `payments`, `payments/qris`, `payments/webhook` | **Belum ada di BE** (tunnel: `rides/:id/payment`) |
| Admin | `admin/rides` → `rides`, `admin/users` → `users` | Ada di BE |
| Admin | `stats`, `activity`, `charts/*`, `top-drivers`, `payments`, `reports`, `settings`, `drivers/:driver/verify`, `admin/rides/:ride` | **Belum ada di BE** |

> **"Belum ada di BE" bukan berarti layar dibiarkan error.** Endpoint itu masih jalan
> lewat mock, dan ditandai `TODO backend` di `server/utils/apiRouter.ts`. Kalau mock
> dimatikan sementara endpoint itu belum dibangun, layarnya ikut hilang — bukan
> mengirim permintaan yang pasti ditolak.

Tambah endpoint baru? Update di **dua tempat**: `server/utils/apiRouter.ts` (mock) dan `Ajem-UDINUS-BE/routes/api.php` (Laravel). Kalau cuma salah satu, frontend bakal tidak sinkron dengan backend.

---

## Kontrak Backend (untuk tim Laravel)

Frontend berjalan mandiri dengan mock API di `server/utils/mockApi/*` yang **meniru 1:1 `routes/api.php`**.
Saat backend aktif: set `NUXT_PUBLIC_USE_MOCK=false` — file mock boleh dihapus tanpa mengubah kode frontend.
Perubahan kontrak terhadap versi lama tercatat di bawah.

> **Klaim "meniru 1:1" ini tidak lagi tepat, dan sudah dibetulkan.** Setelah routes
> kedua repo dibandingkan satu per satu, dari 66 endpoint FE hanya 9 yang punya
> path+method identik dengan BE, dan tidak satu pun dari 9 itu kontrak payload
> yang sama. Tabel status di [Kontrak API](#kontrak-api) sekarang menyatakan yang
> mana yang benar-benar ada di BE dan mana yang belum.

### 1. Naming & role

| Lama | Baru |
| --- | --- |
| route `/rider/*`, role `rider` | route **`/customer/*`**, role **`customer`** |
| field `rider_id`, `rider_name`, `rider_rating` | **`customer_id`**, **`customer_name`**, **`customer_rating`** |
| cookie `aj_session` / `ans_session` | **dihapus** — diganti `ans_at` + `ans_rt` milik server (lihat §Autentikasi) |
| token mock `aj_mock_*` | **dihapus** — token hanya ada di cookie httpOnly server |
| kode trip `AJ-…` | **`ASN-…`** |
| promo `AJHEMAT30` | **`ANSIAN30`** |
| cancel reason `rider_cancel` | **`customer_cancel`** |
| kendaraan `motorcycle/car/van` | **`motorcycle` saja** |
| pembayaran `cash/qris/midtrans/xendit/wallet` | **`cash` + `qris` saja** (tanpa gateway/`checkout_url`) |

### 2. Auth + OTP — SUDAH SESUAI BACKEND

Bagian ini sebelumnya menggambarkan model mock (tantangan OTP saat login).
Model itu dibuang karena tidak punya padanan di Laravel.

**Bentuk sekarang, mengikuti `Ajem-UDINUS-BE/routes/api.php`:**

| Endpoint | Bentuk |
| --- | --- |
| `POST /auth/register` | 201 + `{ access_token, refresh_token, user }`. Email **belum** terverifikasi |
| `POST /auth/login` | 200 + `{ access_token, refresh_token, user }`. Tidak ada tantangan |
| `POST /auth/otp/request` | `{ email, purpose }`. Membalas sama apakah email terdaftar atau tidak |
| `POST /auth/otp/verify` | `{ email, purpose, code }`. Hanya mengisi `email_verified_at` — **tidak mengembalikan token** |
| `POST /auth/refresh` | Dipanggil server otomatis saat 401 `token_expired` |

Yang berubah di sisi FE:

- **Tidak ada `challenge_id` lagi.** Backend mengenali email + `purpose`, bukan
  id tantangan buatan mock
- **Tidak ada cookie `ans_device` (trust device) lagi.** Sanctum tidak punya
  konsepnya, dan "perangkat ini sudah dipercaya" yang disimpan di browser adalah
  jalan pintas yang tidak bisa dicabut dari sisi server
- **Kode OTP tidak pernah tampil di layar.** Backend memang tidak pernah
  mengirimnya di respons; sampai `MAIL_MAILER` diganti SMTP, kodenya hanya
  masuk ke `storage/logs/laravel.log` milik backend
- **`role` dan `phone` tidak dikirim saat register.** `AuthController::register`
  menulis `UserRole::User` tanpa membaca permintaan, jadi `role: 'driver'` akan
  diabaikan diam-diam
- **Field driver (`student_id`, `campus`, `study_program`) belum dikirim.**
  Belum ada kolomnya di backend. Form `/driver/daftar` tetap mengumpulkan isian,
  tapi isian itu belum dikirim ke mana pun

### 3. Tarif zona (satu sumber kebenaran: `shared/utils/pricing.ts`)

`POST /fares/quote { pickup, destination }` →

```jsonc
{
  "zone": "green|yellow|orange|red",
  "zone_label": "Zona Hijau", "zone_color": "#16a34a",
  "distance_km": 1.92, "duration_min": 4,
  "zone_fare": 4000, "admin_fee": 500, "total": 4500,
  "currency": "IDR", "route": [...], "nearest_drivers": 5
}
```

Rumus (WAJIB sama persis di backend, **tanpa surge/biaya layanan**):

| Zona | Jarak | Tarif zona | Admin |
| --- | --- | --- | --- |
| Hijau | 0 – 2,5 km | tetap Rp4.000 | Rp500 |
| Kuning | 2,5 – 6,5 km | lurus Rp5.000@3km → Rp15.000@6km (clamp) | Rp500 |
| Jingga | 6,5 – 10,5 km | lurus Rp16.000@7km → Rp20.000@10km (clamp) | Rp1.000 |
| Merah | ≥ 10,5 km | Rp20.000 + max(0, km−11) × Rp1.500 | Rp1.000 |

`total = zone_fare + admin_fee`, pembulatan kelipatan Rp100.

### 4. Pembayaran (tanpa gateway)

- `GET /payments/qris` → `{ image_url, merchant_name, enabled, instructions[] }` — QR statis dari backend
- `POST /payments { ride_id, method: 'cash'|'qris' }` → `Payment` (tanpa `gateway`, tanpa `checkout_url`);
  cash → `unpaid`, qris → `pending`
- `POST /payments/{payment}/webhook` (atau `/payments/webhook`) body `{ reference, transaction_status }`
  → konfirmasi `settlement`/`success` → `paid`. Dipakai ulang sebagai aksi admin **"Tandai Lunas"**
- `POST /rides` menerima `payment_method: 'cash'|'qris'` saja (422 untuk selain itu)

### 5. Driver mahasiswa

`DriverProfile` bertambah:

```ts
student_id: string      // NIM
campus: string
study_program: string
verification: 'pending' | 'verified' | 'rejected'
```

- `GET /admin/stats` → field `riders` diganti **`customers`**; `pending_drivers` = jumlah profil berstatus `pending`
- `POST /admin/drivers/{driver}/verify` `{ verification }` → ubah status verifikasi (endpoint baru)
- `PATCH /admin/drivers/{driver}` menerima `student_id/campus/study_program`
- `GET /me/summary` (driver) menyertakan `verification`
- Order baru untuk driver non-`verified` → kebijakan backend (mock: tetap boleh, UI menampilkan banner)

### 6. Lain-lain

- `GET /admin/payments` baris: `customer_name` (bukan `rider_name`), tanpa kolom `gateway`
- `DriverJob`: `customer_name`, `customer_rating`, **tanpa** `surge_multiplier`
- `Ride`: **tanpa** `surge_multiplier`
- `payment_status` nilai: `unpaid | pending | paid | failed | refunded`
- Email demo/domain: `*@ansian.id` (`customer@`, `driver@`, `admin@`, `support@`, `legal@`, `bantuan@`)
- Pengaturan sistem (group `fare`) menyimpan entri zona (lihat `server/utils/mockApi/db.ts → buildSettings`)

---

## Integrasi Backend

Secara default aplikasi memakai mock API bawaan di `server/utils/mockApi` agar dapat dijalankan mandiri. Untuk terhubung ke Laravel backend, set `NUXT_PUBLIC_USE_MOCK=false` dan `NUXT_PUBLIC_API_BASE` menuju URL backend Anda (`CUKLIZ/Ajem-UDINUS-BE`).

---

## Struktur

```
app/
  assets/        # CSS global
  components/    # UI, map, ride, chat, charts, marketing, pay, driver
  composables/   # useApi, useRealtime, useToast, usePreferences
  layouts/       # app, auth, default
  middleware/    # auth.global.ts
  pages/         # customer/, driver/, admin/, verifikasi, halaman publik
  plugins/       # leaflet.client.ts
  stores/        # auth, ride, chat, driver, notification, ui (Pinia)
server/          # routes/api/v1 catch-all + utils/apiRouter.ts
  utils/mockApi/ # db, auth (OTP), rides, admin — HAPUS saat backend aktif
shared/
  types/         # kontrak tipe (AuthChallenge, FareQuote zona, DriverProfile, …)
  utils/         # geo (titik Semarang), pricing (TARIF ZONA), format
```

### Routing Halaman

| Prefix | Layout | Akses |
| --- | --- | --- |
| `/`, `/tentang`, `/faq`, `/terms`, `/kebijakan-privasi` | `default` | Publik, di-prerender |
| `/login`, `/register`, `/verifikasi` | `auth` | Publik, di-prerender |
| `/driver/daftar` | `auth` | Publik |
| `/customer/**` | `app` | Pelanggan |
| `/driver/**` | `app` | Driver |
| `/admin/**` | `app` | Admin |

Proteksi akses lewat `app/middleware/auth.global.ts` — jangan bypass dengan menonaktifkan middleware.

---

## Kualitas Kode

```bash
npm run typecheck   # TypeScript strict — WAJIB lolos, exit 0
npm run lint        # ESLint (flat config via @nuxt/eslint)
npm run lint:fix    # ESLint + autofix
```

> **Status (2026-09-28):** `npm run lint` → **0 error**, 50 warning (mayoritas `no-explicit-any`
> yang sudah diset `warn`). Error wajib tetap 0; sisa warning menyusul di PR terpisah.
> `npm run typecheck` **wajib hijau** (0 error).

### ⚠️ Jangan asal `lint --fix` untuk `no-unused-vars`

Ada kasus di mana "variabel unused" itu **memang harus tetap ada** —
memanggilnya efek sampingnya yang penting (mis. auth guard `authUser(event)` yang me-throw 401
kalau tidak ada session). Perbaikannya hanya buang assignment-nya, jangan hapus baris panggilannya:

```ts
authUser(event)   // ✅ guard tetap jalan, tanpa variabel sia-sia
```

---

## Troubleshooting

### `ERR_MODULE_NOT_FOUND: .../node_modules/dist/index.mjs`

Semua binary di `node_modules/.bin` rusak. Biasanya karena project **dipindah** dengan `cp -r` — symlink ikut ter-dereference jadi file biasa, dan path relatif di dalam file binary jadi nyasar.

```bash
npm rebuild
```

Sebagai pengingat: kalau memang harus menyalin project, pakai `cp -a` / `rsync -a`, atau `mv`. Jangan pernah `cp -r` folder yang berisi `node_modules`.

### `npm run dev` tidak bisa diakses dari HP

Default bind ke `localhost` saja. Pakai `npm run dev -- --host`.

### `npm run typecheck` keluar stack trace padahal sukses

Kalau muncul `(Vue) Resolve plugin path failed: ... ERR_PACKAGE_PATH_NOT_EXPORTED`, **itu bukan error**. Cuma plugin bahasa Vue yang gagal resolve subpath `vue-router/volar/...` yang tidak di-export di versi `vue-router` yang terpasang. Exit code tetap `0` dan jumlah `error TS` = 0. Abaikan saja.

### `npm install` / `npm run dev` error setelah `git pull`

Hampir selalu karena `package-lock.json` berubah. Jalankan `npm install` ulang, lalu `npm run dev`.

---

## License

Private — © Ansian (tim: Alif Fahri Octavianto, Wiratama Rava Rahardia, Farid Nur Cahyo, M Setya Angga Adi Prabowo). Repo ini private; jangan dibagikan ke luar tim tanpa izin.
