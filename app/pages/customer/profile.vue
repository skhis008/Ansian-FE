<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { formatDate, maskPhone } from '#shared/utils/format'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Profil Saya', robots: 'noindex, nofollow' })

const auth = useAuthStore()
const toast = useToast()

const editOpen = ref(false)
const passOpen = ref(false)
const saving = ref(false)
const changingPass = ref(false)
const errors = ref<Record<string, string>>({})

const form = reactive({ name: '', phone: '' })
const pass = reactive({ current_password: '', password: '', password_confirmation: '' })

const roleLabel = computed(
  () =>
    ({ user: 'Pelanggan', driver: 'Driver', admin: 'Administrator' })[auth.role ?? 'user'],
)

function openEdit() {
  form.name = auth.user?.name ?? ''
  errors.value = {}
  editOpen.value = true
}

async function saveProfile() {
  errors.value = {}
  if (!form.name.trim()) {
    errors.value.name = 'Nama wajib diisi.'
    return
  }
  saving.value = true
  try {
    await auth.updateProfile({ name: form.name })
    toast.success('Profil berhasil diperbarui.')
    editOpen.value = false
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.')
  } finally {
    saving.value = false
  }
}

async function savePassword() {
  errors.value = {}
  if (!pass.current_password) errors.value.current_password = 'Wajib diisi.'
  if (pass.password.length < 8) errors.value.password = 'Minimal 8 karakter.'
  if (pass.password !== pass.password_confirmation) errors.value.password_confirmation = 'Konfirmasi tidak cocok.'
  if (Object.keys(errors.value).length) return

  changingPass.value = true
  try {
    // TODO backend: BE tidak punya endpoint ganti-password. Yang ada
    // `PUT /users/{id}` yang menerima `password` + `password_confirmation` —
    // dan TIDAK memeriksa `current_password`. Jadi kalau mock dimatikan, siapa pun
    // yang memegang token bisa mengganti password tanpa mengetahui password lama.
    // `current_password` tetap dikirim dan mock tetap memeriksanya; BE perlu
    // aturan yang sama sebelum layar ini dianggap aman.
    await http.put(`/users/${auth.user?.id}`, {
      current_password: pass.current_password,
      password: pass.password,
      password_confirmation: pass.password_confirmation,
    })
    toast.success('Password berhasil diubah.')
    passOpen.value = false
    Object.assign(pass, { current_password: '', password: '', password_confirmation: '' })
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal mengubah password.')
  } finally {
    changingPass.value = false
  }
}

async function logout() {
  await auth.logout()
  toast.success('Kamu sudah keluar.')
  await navigateTo('/login')
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5">
    <AppPageHeader title="Profil Saya" description="Kelola data akun dan preferensimu." />

    <!-- Header card -->
    <UiCard class="overflow-hidden !p-0">
      <div class="h-24 bg-gradient-to-r from-brand-600 to-brand-800" />
      <div class="-mt-12 px-5 pb-5">
        <div class="flex flex-wrap items-end gap-4">
          <UiAvatar :name="auth.displayName" :src="auth.user?.avatar_url" :size="88" class="ring-4 ring-white" />
          <div class="min-w-0 flex-1 pb-1">
            <h2 class="text-lg font-bold text-ink-900">{{ auth.user?.name }}</h2>
            <p class="text-sm text-ink-500">{{ auth.user?.email }}</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <UiBadge tone="brand" size="xs">{{ roleLabel }}</UiBadge>
              <UiBadge
                :tone="auth.user?.status === 'active' ? 'success' : 'warning'"
                size="xs"
                dot
              >
                {{ auth.user?.status === 'active' ? 'Aktif' : auth.user?.status }}
              </UiBadge>
            </div>
          </div>
          <UiButton variant="outline" size="sm" class="mb-1" @click="openEdit">
            <template #icon><UiIcon name="edit" class="size-4" /></template>
            Edit Profil
          </UiButton>
        </div>
      </div>
    </UiCard>

    <!-- Informasi & Keamanan -->
    <div class="grid gap-5 sm:grid-cols-2">
      <UiCard>
        <h3 class="mb-4 text-sm font-bold text-ink-900">Informasi Akun</h3>
        <dl class="space-y-3.5">
          <div class="flex items-start justify-between gap-3">
            <dt class="text-[13px] text-ink-500">Nama lengkap</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ auth.user?.name }}</dd>
          </div>
          <div class="flex items-start justify-between gap-3">
            <dt class="text-[13px] text-ink-500">Email</dt>
            <dd class="flex items-center gap-1.5 text-right text-[13px] font-semibold text-ink-900">
              {{ auth.user?.email }}
              <UiIcon v-if="auth.user?.email_verified_at" name="check-circle" class="size-3.5 text-emerald-600" />
            </dd>
          </div>
          <div class="flex items-start justify-between gap-3">
            <dt class="text-[13px] text-ink-500">WhatsApp</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ maskPhone(auth.user?.phone ?? '') }}</dd>
          </div>
          <div class="flex items-start justify-between gap-3">
            <dt class="text-[13px] text-ink-500">Bergabung sejak</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ formatDate(auth.user?.created_at) }}</dd>
          </div>
          <div class="flex items-start justify-between gap-3 border-t border-ink-100 pt-3">
            <dt class="text-[13px] text-ink-500">Status akun</dt>
            <dd>
              <UiBadge :tone="auth.user?.status === 'active' ? 'success' : 'warning'" size="xs" dot>
                {{ auth.user?.status === 'active' ? 'Aktif' : auth.user?.status }}
              </UiBadge>
            </dd>
          </div>
        </dl>
      </UiCard>

      <UiCard>
        <h3 class="mb-4 text-sm font-bold text-ink-900">Keamanan</h3>
        <div class="space-y-3">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-3 text-left transition hover:border-ink-300 hover:bg-ink-50"
            @click="passOpen = true"
          >
            <span class="grid size-9 place-items-center rounded-lg bg-ink-100 text-ink-600">
              <UiIcon name="shield" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold text-ink-900">Ubah Password</span>
              <span class="block text-[11px] text-ink-500">Disarankan tiap 3 bulan</span>
            </span>
            <UiIcon name="chevron-right" class="size-4 text-ink-400" />
          </button>

          <div class="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
            <span class="grid size-9 place-items-center rounded-lg" :class="auth.user?.email_verified_at ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'">
              <UiIcon :name="auth.user?.email_verified_at ? 'check-circle' : 'mail'" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold text-ink-900">Verifikasi email</span>
              <span class="block text-[11px] text-ink-500">
                {{ auth.user?.email_verified_at ? 'Email sudah terverifikasi' : 'Belum terverifikasi' }}
              </span>
            </span>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Dukungan & Sesi -->
    <div class="grid gap-5 sm:grid-cols-2">
      <UiCard>
        <h3 class="mb-4 text-sm font-bold text-ink-900">Dukungan</h3>
        <div class="space-y-3">
          <NuxtLink
            to="/customer/chat?new=support"
            class="flex items-center gap-3 rounded-xl border border-ink-200 p-3 transition hover:border-ink-300 hover:bg-ink-50"
          >
            <span class="grid size-9 place-items-center rounded-lg bg-violet-50 text-violet-600">
              <UiIcon name="message-circle" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold text-ink-900">Hubungi Customer Service</span>
              <span class="block text-[11px] text-ink-500">Chat langsung dari halaman chat</span>
            </span>
            <UiIcon name="chevron-right" class="size-4 text-ink-400" />
          </NuxtLink>

          <NuxtLink
            to="/faq"
            class="flex items-center gap-3 rounded-xl border border-ink-200 p-3 transition hover:border-ink-300 hover:bg-ink-50"
          >
            <span class="grid size-9 place-items-center rounded-lg bg-ink-100 text-ink-600">
              <UiIcon name="help-circle" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold text-ink-900">Pusat Bantuan</span>
              <span class="block text-[11px] text-ink-500">Pertanyaan yang sering diajukan</span>
            </span>
            <UiIcon name="chevron-right" class="size-4 text-ink-400" />
          </NuxtLink>
        </div>
      </UiCard>

      <UiCard>
        <h3 class="mb-4 text-sm font-bold text-ink-900">Sesi</h3>
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl border border-red-200 p-3 text-left transition hover:bg-red-50"
          @click="logout"
        >
          <span class="grid size-9 place-items-center rounded-lg bg-red-50 text-red-600">
            <UiIcon name="logout" class="size-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-semibold text-red-700">Keluar dari akun</span>
            <span class="block text-[11px] text-red-500">Kamu perlu masuk lagi</span>
          </span>
          <UiIcon name="chevron-right" class="size-4 text-red-400" />
        </button>
        <p class="mt-3 text-[11px] leading-relaxed text-ink-400">
          Keluar hanya menghapus sesi di perangkat ini. Perangkat tepercaya tetap login otomatis selama 30 hari.
        </p>
      </UiCard>
    </div>

    <!-- Edit modal -->
    <UiModal :open="editOpen" title="Edit Profil" size="sm" @close="editOpen = false">
      <div class="space-y-4">
        <UiInput v-model="form.name" label="Nama lengkap" icon="user" :error="errors.name" />
        <!--
          Input nomor WhatsApp DIHAPUS dari form edit. Tabel `users` di backend
          belum punya kolom telepon, jadi isian itu akan diterima form lalu
          dibuang server tanpa pesan — dan orang akan mengira nomornya tersimpan.
          Kolomnya kembali begitu `phone` benar-benar ada di backend.
        -->
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="editOpen = false">Batal</UiButton>
        <UiButton :loading="saving" @click="saveProfile">Simpan</UiButton>
      </template>
    </UiModal>

    <!-- Password modal -->
    <UiModal :open="passOpen" title="Ubah Password" size="sm" @close="passOpen = false">
      <div class="space-y-4">
        <UiInput
          v-model="pass.current_password"
          label="Password saat ini"
          type="password"
          icon="shield"
          :error="errors.current_password"
        />
        <UiInput
          v-model="pass.password"
          label="Password baru"
          type="password"
          icon="shield"
          hint="Minimal 8 karakter"
          :error="errors.password"
        />
        <UiInput
          v-model="pass.password_confirmation"
          label="Ulangi password baru"
          type="password"
          icon="shield"
          :error="errors.password_confirmation"
        />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="passOpen = false">Batal</UiButton>
        <UiButton :loading="changingPass" @click="savePassword">Simpan</UiButton>
      </template>
    </UiModal>
  </div>
</template>
