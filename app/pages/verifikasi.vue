<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiError } from '~/composables/useApi'

definePageMeta({ layout: 'auth' })

useSeoMeta({
  title: 'Verifikasi Email',
  description: 'Masukkan kode verifikasi 6 digit yang dikirim ke email kamu.',
  robots: 'noindex, follow',
})

const auth = useAuthStore()
const route = useRoute()
const toast = useToast()

const code = ref('')
const serverError = ref('')
const cooldown = ref(0)
const resending = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const email = computed(() => auth.verifyingEmail)
const masked = computed(() => {
  const value = email.value
  if (!value) return 'email kamu'
  const [local = '', domain = ''] = value.split('@')
  const head = local.slice(0, 1)
  return `${head}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`
})

function startCooldown(seconds: number) {
  cooldown.value = seconds
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (cooldown.value > 0) cooldown.value--
    else if (timer) clearInterval(timer)
  }, 1000)
}

onMounted(() => startCooldown(60))
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

async function submit() {
  serverError.value = ''
  const value = code.value.replace(/\D/g, '')
  if (value.length !== 6) {
    serverError.value = 'Kode verifikasi 6 digit.'
    return
  }
  try {
    await auth.verifyOtp(value)
    const redirect = route.query.redirect
    await navigateTo(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : auth.homePath)
  } catch (e) {
    serverError.value = e instanceof ApiError ? e.message : 'Gagal memverifikasi kode. Coba lagi.'
  }
}

async function resend() {
  if (cooldown.value > 0 || resending.value || !email.value) return
  resending.value = true
  serverError.value = ''
  try {
    await auth.requestOtp(email.value, 'registration')
    toast.success('Kode baru sudah dikirim.')
    startCooldown(60)
  } catch (e) {
    serverError.value = e instanceof ApiError ? e.message : 'Gagal mengirim ulang kode.'
  } finally {
    resending.value = false
  }
}

function back() {
  auth.clearVerification()
  navigateTo('/login')
}
</script>

<template>
  <div>
    <template v-if="email">
      <span class="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <UiIcon name="mail" class="size-6" />
      </span>

      <h1 class="mt-5 text-2xl font-bold tracking-tight text-ink-900">Verifikasi email kamu</h1>
      <p class="mt-2 text-[14.5px] leading-relaxed text-ink-500">
        Kode 6 digit sudah dikirim ke {{ masked }}. Berlaku 5 menit. Pemesanan perjalanan baru bisa
        dilakukan setelah email terverifikasi.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label for="otp" class="mb-1.5 block text-[13px] font-semibold text-ink-700">Kode verifikasi</label>
          <input
            id="otp"
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            :maxlength="6"
            class="text-center font-mono text-xl tracking-[0.5em]"
            @update:model-value="code = String($event).replace(/\D/g, '').slice(0, 6)"
          >
        </div>

        <!--
          Kotak kode demo DIHAPUS. Backend tidak pernah mengirim kode OTP di
          respons — hanya ke email, dan sampai `MAIL_MAILER` diganti SMTP kodenya
          hanya masuk ke `storage/logs/laravel.log`. Menampilkannya di layar
          berarti memberitahu siapa pun yang memegang perangkat itu, dan di
          produksi kode itu jadi bisa dipakai orang lain.

          Saat mock aktif kodenya juga tidak ditampilkan di sini; ambil dari
          respons `POST /auth/otp/request` kalau sedang menelusuri mock.
        -->

        <p v-if="serverError" class="text-[13px] font-medium text-danger-600">{{ serverError }}</p>

        <UiButton type="submit" size="lg" block :loading="auth.loading">
          Verifikasi
        </UiButton>
      </form>

      <div class="mt-5 flex items-center justify-between text-[13px]">
        <button
          type="button"
          class="font-semibold text-brand-600 disabled:cursor-not-allowed disabled:text-ink-300"
          :disabled="cooldown > 0 || resending"
          @click="resend"
        >
          {{ cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Kirim ulang kode' }}
        </button>
        <button type="button" class="font-semibold text-ink-400 hover:text-ink-600" @click="back">
          Ganti akun
        </button>
      </div>
    </template>

    <template v-else>
      <span class="grid size-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
        <UiIcon name="shield" class="size-6" />
      </span>
      <h1 class="mt-5 text-2xl font-bold tracking-tight text-ink-900">Tidak ada verifikasi yang menunggu</h1>
      <p class="mt-2 text-[14.5px] leading-relaxed text-ink-500">
        Halaman ini hanya dipakai setelah kode dikirim ke email kamu.
      </p>
      <UiButton to="/login" variant="outline" size="lg" block class="mt-6">Kembali ke halaman masuk</UiButton>
    </template>
  </div>
</template>