<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ApiError } from '~/composables/useApi'

definePageMeta({ layout: 'auth' })

useSeoMeta({
  title: 'Masuk',
  description: 'Masuk ke akun {{ $config.public.appName }} untuk memesan antar jemput atau mengantar pelanggan sebagai driver.',
  robots: 'noindex, follow',
})

const auth = useAuthStore()
const route = useRoute()
const toast = useToast()

const form = reactive({ email: '', password: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const showPassword = ref(false)

/**
 * Akun demo.
 *
 * Email dan password di sini milik SEEDER BACKEND (`Ajem-UDINUS-BE`), bukan
 * milik mock. Sebelumnya masih `@ansian.id` dan password `password`, yang
 * tidak ada di Laravel — jadi menekan tombolnya selalu berakhir 401 dengan
 * "Email atau password salah", dan yang benar-benar terjadi (akunnya memang
 * tidak ada) tidak terbaca.
 *
 * Kalau nanti mock dinyalakan lagi (setiap akun mock punya password berbeda),
 * daftar ini harus dibalik — satu daftar untuk dua backend yang berbeda akan
 * meledak begitu salah satunya mati.
 */
const demoAccounts = [
  { role: 'Pelanggan', email: 'user@ajem-be.test', password: 'password123', icon: 'user', tone: 'bg-brand-50 text-brand-600' },
  { role: 'Driver', email: 'driver@ajem-be.test', password: 'password123', icon: 'bike', tone: 'bg-emerald-50 text-emerald-600' },
  { role: 'Admin', email: 'admin@ajem-be.test', password: 'password123', icon: 'shield', tone: 'bg-violet-50 text-violet-600' },
]

function fill(account: (typeof demoAccounts)[number]) {
  form.email = account.email
  form.password = account.password
  errors.value = {}
  serverError.value = ''
}

async function submit() {
  errors.value = {}
  serverError.value = ''

  if (!form.email) errors.value.email = 'Email wajib diisi.'
  if (!form.password) errors.value.password = 'Password wajib diisi.'
  if (Object.keys(errors.value).length) return

  try {
    const user = await auth.login(form.email, form.password)
    const redirect = route.query.redirect
    const destination = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : auth.homePath

    /*
     * Jangan navigasi kalau sesi ternyata belum berdiri.
     *
     * Middleware melempar ke `/login` setiap kali `isAuthenticated` false, jadi
     * navigasi ke beranda tanpa memeriksa kondisi itu berakhir sebagai bouncing
     * bolak-balik yang tidak pernah menjelaskan apa pun ke pengguna. Di sini
     * kesalahannya ditampilkan sebagai pesan biasa saja.
     */
    if (!auth.isAuthenticated || !user) {
      serverError.value =
        'Login diterima tapi sesi tidak terbentuk. Periksa cookie browser — kalau cookie diblokir, aplikasi ini tidak bisa menyimpan sesi.'
      await auth.logout()
      return
    }

    /* Email belum terverifikasi: pemesanan akan ditolak backend, jadi arahkan
       ke layar OTP lebih dulu. Login tetap berhasil — yang belum selesai
       hanyalah verifikasi. */
    if (auth.verifyingEmail) {
      await navigateTo({ path: '/verifikasi', query: { redirect: destination } })
      return
    }

    toast.success(`Selamat datang, ${user.name.split(' ')[0]}!`)
    await navigateTo(destination)
  } catch (e) {
    if (e instanceof ApiError) {
      serverError.value = e.message
      errors.value = e.fieldErrors()
    } else {
      serverError.value = 'Gagal masuk. Coba lagi.'
    }
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-ink-900">Masuk ke akun</h1>
    <p class="mt-1.5 text-sm text-ink-500">Selamat datang kembali! Silakan masuk untuk melanjutkan.</p>

    <div
      v-if="serverError"
      class="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
      role="alert"
    >
      <UiIcon name="alert-circle" class="mt-0.5 size-4 shrink-0" />
      <span>{{ serverError }}</span>
    </div>

    <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
      <UiInput
        v-model="form.email"
        label="Email"
        type="email"
        placeholder="nama@email.com"
        icon="mail"
        autocomplete="email"
        :error="errors.email"
        required
      />

      <UiInput
        v-model="form.password"
        label="Password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="••••••••"
        icon="shield"
        autocomplete="current-password"
        :error="errors.password"
        required
      >
        <template #suffix>
          <button
            type="button"
            class="text-ink-400 transition hover:text-ink-600"
            :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
            @click="showPassword = !showPassword"
          >
            <UiIcon :name="showPassword ? 'eye-off' : 'eye'" class="size-4" />
          </button>
        </template>
      </UiInput>

      <!--
        Switch "Ingat saya" dihapus. Backend memberi refresh token 30 hari tanpa
        regard, jadi switch itu tidak mengubah apa pun — dan kontrol yang tidak
        melakukan sesuatu lebih buruk daripada tidak ada, karena orang mengira
        sesinya lebih aman atau lebih pendek dari kenyataan.
      -->
      <div class="flex items-center justify-end">
        <NuxtLink to="/faq#lupa-password" class="text-[13px] font-semibold text-brand-600 hover:underline">
          Lupa password?
        </NuxtLink>
      </div>

      <UiButton type="submit" size="lg" block :loading="auth.loading">
        Masuk
      </UiButton>
    </form>

    <div class="my-6 flex items-center gap-3">
      <span class="h-px flex-1 bg-ink-200" />
      <span class="text-xs font-medium text-ink-400">
        Akun demo — klik untuk isi otomatis
        <span class="block text-[11px] font-normal text-ink-300">akun seeder backend, password: password123</span>
      </span>
      <span class="h-px flex-1 bg-ink-200" />
    </div>

    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="acc in demoAccounts"
        :key="acc.email"
        type="button"
        class="group flex flex-col items-center gap-1.5 rounded-xl border border-ink-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/50"
        @click="fill(acc)"
      >
        <span class="grid size-8 place-items-center rounded-lg transition" :class="acc.tone">
          <UiIcon :name="acc.icon" class="size-4" />
        </span>
        <span class="text-[11px] font-semibold text-ink-700 group-hover:text-brand-700">{{ acc.role }}</span>
      </button>
    </div>

    <p class="mt-7 text-center text-sm text-ink-500">
      Belum punya akun?
      <NuxtLink to="/register" class="font-semibold text-brand-600 hover:underline">Daftar gratis</NuxtLink>
    </p>
  </div>
</template>
