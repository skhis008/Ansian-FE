<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ApiError } from '~/composables/useApi'

definePageMeta({ layout: 'default' })
useSeoMeta({
  title: 'Gabung Jadi Driver — Ansian',
  description:
    'Daftar jadi driver Ansian. Khusus mahasiswa — cukup NIM & kampus. Tanpa biaya pendaftaran, atur sendiri waktu online.',
})

const auth = useAuthStore()
const toast = useToast()

const form = reactive({
  name: '',
  email: '',
  phone: '',
  password: '',
  student_id: '',
  campus: '',
  study_program: '',
  vehicle_plate: '',
  vehicle_color: '',
  vehicle_model: '',
})

const errors = ref<Record<string, string>>({})
const submitting = ref(false)

const benefits = [
  { icon: 'wallet', title: 'Penghasilan harian', text: 'Pendapatan masuk setiap hari kerja, tanpa potongan biaya daftar.' },
  { icon: 'clock', title: 'Atur waktu sendiri', text: 'Kuliah dulu, online kapan saja — cocok buat mahasiswa.' },
  { icon: 'shield-check', title: 'Verifikasi NIM', text: 'Cukup NIM & kampus, tim kami verifikasi cepat.' },
]

const requirements = [
  'Mahasiswa aktif minimal semester 3 dengan NIM valid',
  'Memiliki SIM C aktif dan KTP',
  'Motor pribadi dalam kondisi baik, plat sesuai STNK',
  'Foto profil & data kendaraan diverifikasi admin Ansian',
]

const CAMPUS_SUGGESTIONS = [
  'Universitas Dian Nuswantoro',
  'Universitas Diponegoro',
  'Politeknik Negeri Semarang',
  'UIN Walisongo',
  'Universitas Semarang',
]

const valid = computed(
  () =>
    form.name &&
    form.email &&
    form.phone &&
    form.password.length >= 8 &&
    form.student_id &&
    form.campus &&
    form.vehicle_plate,
)

function validate() {
  errors.value = {}
  if (!form.name.trim()) errors.value.name = 'Nama wajib diisi.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.value.email = 'Format email tidak valid.'
  if (!/^08[0-9]{8,11}$/.test(form.phone.replace(/[\s-]/g, ''))) {
    errors.value.phone = 'Masukkan nomor WhatsApp yang valid, contoh 08123456789.'
  }
  if (form.password.length < 8) errors.value.password = 'Password minimal 8 karakter.'
  if (!form.student_id.trim()) errors.value.student_id = 'NIM wajib diisi.'
  if (!form.campus.trim()) errors.value.campus = 'Kampus wajib diisi.'
  if (!form.vehicle_plate.trim()) errors.value.vehicle_plate = 'Nomor kendaraan wajib diisi.'
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  try {
    /* Hanya name/email/password yang dikirim.
     *
     * `POST /auth/register` di backend selalu membuat akun dengan role `user`
     * — `AuthController::register` menulis `UserRole::User` tanpa membaca
     * permintaan. Jadi `role: 'driver'` di sini akan diabaikan diam-diam, dan
     * orang akan mengira dirinya driver padahal tidak.
     *
     * NIM, kampus, dan data kendaraan juga belum punya kolom di backend. Isian
     * ini tetap dikumpulkan supaya tidak hilang, tapi belum dikirim; backend
     * belum punya tempat untuk menyimpannya.
     */
    await auth.register({
      name: form.name,
      email: form.email,
      password: form.password,
    })
    toast.success('Akun dibuat. Kode verifikasi dikirim ke email kamu.')
    await navigateTo('/verifikasi')
  } catch (e) {
    errors.value = e instanceof ApiError ? { ...e.fieldErrors() } : {}
    toast.error(e instanceof ApiError ? e.message : 'Pendaftaran gagal. Coba lagi.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="bg-ink-50">
    <section class="border-b border-ink-200 bg-ink-900">
      <div class="container-app grid gap-10 py-14 lg:grid-cols-2 lg:py-20">
        <div>
          <UiBadge tone="brand" size="sm">Lowongan Driver Mahasiswa</UiBadge>
          <h1 class="mt-4 text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
            Kuliah tetap jalan,<br>
            penghasilan tetap jalan.
          </h1>
          <p class="mt-4 max-w-md text-[14px] leading-relaxed text-ink-300">
            Ansian membuka lowongan driver antar jemput khusus mahasiswa. Cukup NIM dan kampus, tanpa biaya
            pendaftaran, tanpa target harian — kamu yang atur waktunya.
          </p>
          <ul class="mt-8 space-y-4">
            <li v-for="b in benefits" :key="b.title" class="flex items-start gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <UiIcon :name="b.icon" class="size-4.5" />
              </span>
              <div>
                <p class="text-[14px] font-semibold text-white">{{ b.title }}</p>
                <p class="text-[12.5px] text-ink-400">{{ b.text }}</p>
              </div>
            </li>
          </ul>
        </div>

        <UiCard class="border-0 p-6 shadow-xl sm:p-7">
          <h2 class="text-lg font-bold text-ink-900">Isi Data Driver</h2>
          <p class="mt-1.5 text-[12.5px] text-ink-500">
            *Khusus mahasiswa. Status diverifikasi admin setelah akun dibuat.
          </p>

          <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
            <label class="block">
              <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Nama lengkap</span>
              <UiInput v-model="form.name" placeholder="mis. Budi Santoso" :error="errors.name" autocomplete="name" />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Email kampus/pribadi</span>
                <UiInput
                  v-model="form.email"
                  type="email"
                  placeholder="nama@email.com"
                  :error="errors.email"
                  autocomplete="email"
                />
              </label>
              <label class="block">
                <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Nomor WhatsApp</span>
                <UiInput
                  v-model="form.phone"
                  type="tel"
                  inputmode="numeric"
                  placeholder="08123456789"
                  :error="errors.phone"
                  autocomplete="tel"
                />
              </label>
            </div>

            <label class="block">
              <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Password</span>
              <UiInput
                v-model="form.password"
                type="password"
                placeholder="Minimal 8 karakter"
                :error="errors.password"
                autocomplete="new-password"
              />
            </label>

            <div class="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
              <p class="mb-3 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-brand-700">
                <UiIcon name="graduation-cap" class="size-3.5" />
                Data mahasiswa
              </p>
              <div class="space-y-3">
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="block">
                    <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">NIM</span>
                    <UiInput
                      v-model="form.student_id"
                      placeholder="mis. A11.2023.0123"
                      :error="errors.student_id"
                      inputmode="text"
                    />
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Program studi</span>
                    <UiInput v-model="form.study_program" placeholder="mis. Teknik Informatika" />
                  </label>
                </div>
                <label class="block">
                  <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Kampus</span>
                  <UiInput
                    v-model="form.campus"
                    placeholder="mis. Universitas Dian Nuswantoro"
                    :error="errors.campus"
                  />
                  <span class="mt-2 flex flex-wrap gap-1.5">
                    <button
                      v-for="c in CAMPUS_SUGGESTIONS"
                      :key="c"
                      type="button"
                      class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition"
                      :class="form.campus === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300'"
                      @click="form.campus = c"
                    >
                      {{ c }}
                    </button>
                  </span>
                </label>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Nomor kendaraan (motor)</span>
                <UiInput v-model="form.vehicle_plate" placeholder="F 1234 XYZ" :error="errors.vehicle_plate" />
              </label>
              <label class="block">
                <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Warna</span>
                <UiInput v-model="form.vehicle_color" placeholder="Hitam" />
              </label>
            </div>

            <label class="block">
              <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Merek dan tipe</span>
              <UiInput v-model="form.vehicle_model" placeholder="mis. Honda Beat 2023" />
            </label>

            <UiButton type="submit" block :loading="submitting || auth.loading" :disabled="!valid">
              Daftar Jadi Driver
            </UiButton>

            <p class="text-center text-[11.5px] text-ink-400">
              Dengan mendaftar, kamu menyetujui
              <NuxtLink to="/terms" class="font-medium text-brand-700 hover:underline">Syarat & Ketentuan</NuxtLink>
              dan
              <NuxtLink to="/kebijakan-privasi" class="font-medium text-brand-700 hover:underline">
                Kebijakan Privasi
              </NuxtLink>.
            </p>
          </form>
        </UiCard>
      </div>
    </section>

    <section class="container-app py-14">
      <div class="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 class="text-xl font-bold text-ink-900">Syarat Pendaftaran</h2>
          <ul class="mt-4 space-y-3">
            <li v-for="r in requirements" :key="r" class="flex items-start gap-2.5">
              <UiIcon name="check-circle" class="mt-0.5 size-4 shrink-0 text-brand-600" />
              <span class="text-[13.5px] leading-relaxed text-ink-600">{{ r }}</span>
            </li>
          </ul>
        </div>

        <UiCard class="h-fit bg-ink-50">
          <h3 class="text-[14px] font-bold text-ink-900">Pertanyaan Umum</h3>
          <div class="mt-3 space-y-3 text-[13px] text-ink-600">
            <p><span class="font-semibold text-ink-800">Biaya pendaftaran?</span> Gratis, tanpa biaya tersembunyi.</p>
            <p><span class="font-semibold text-ink-800">Waktu kuliah bentrok?</span> Tidak masalah — online kapan saja.</p>
            <p><span class="font-semibold text-ink-800">Kapan pembayaran masuk?</span> Setiap hari kerja ke rekeningmu.</p>
          </div>
          <UiButton to="/faq" block variant="soft" class="mt-4">Baca FAQ Lengkap</UiButton>
        </UiCard>
      </div>
    </section>
  </div>
</template>
