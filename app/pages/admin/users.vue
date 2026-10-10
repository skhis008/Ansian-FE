<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Paginated, User, UserRole } from '#shared/types'
import { formatDate, formatDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Pengguna', robots: 'noindex, nofollow' })

const toast = useToast()
const search = ref('')
const role = ref<UserRole | ''>('')
const status = ref('')
const page = ref(1)

const query = reactive({ search: '', role: '', status: '' })
watch([search, role, status], () => {
  query.search = search.value
  query.role = role.value
  query.status = status.value
  page.value = 1
})

const { data, pending, refresh } = await useAsyncData(
  'admin-users',
  () => http.get<Paginated<User>>('/users', { ...query, page: page.value, per_page: 15 }),
  { watch: [query, page] },
)

const rows = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta)

const editing = ref<User | null>(null)
const form = reactive({ name: '', email: '', phone: '', role: 'user' as UserRole, status: 'active' })
const saving = ref(false)
const removing = ref<User | null>(null)

const ROLE_TONES: Record<string, 'brand' | 'info' | 'purple'> = {
  user: 'brand',
  driver: 'info',
  admin: 'purple',
}
const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
}

function openEdit(user: User) {
  editing.value = user
  form.name = user.name
  form.email = user.email
  form.phone = user.phone ?? ''
  form.role = user.role
  form.status = user.status
}

async function save() {
  if (!editing.value) return
  saving.value = true
  try {
    await http.patch(`/users/${editing.value.id}`, { ...form })
    toast.success('Pengguna diperbarui.')
    editing.value = null
    await refresh()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal memperbarui pengguna.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!removing.value) return
  saving.value = true
  try {
    await http.delete(`/users/${removing.value.id}`)
    toast.success('Pengguna dihapus.')
    removing.value = null
    await refresh()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal menghapus pengguna.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Pengguna" description="Kelola akun pelanggan, driver, dan administrator." />

    <UiCard :padded="false">
      <div class="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
        <div class="relative min-w-[15rem] flex-1">
          <UiIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <input
            v-model="search"
            type="search"
            placeholder="Cari nama, email, atau telepon…"
            class="h-10 w-full rounded-xl border border-ink-200 bg-white pr-3 pl-9 text-sm outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          >
        </div>
        <select
          v-model="role"
          class="h-10 rounded-xl border border-ink-200 bg-white px-3 text-[12.5px] font-medium text-ink-700 outline-none focus:border-brand-500"
        >
          <option value="">Semua peran</option>
          <option value="user">Pelanggan</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
        <select
          v-model="status"
          class="h-10 rounded-xl border border-ink-200 bg-white px-3 text-[12.5px] font-medium text-ink-700 outline-none focus:border-brand-500"
        >
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="pending">Menunggu</option>
          <option value="suspended">Ditangguhkan</option>
        </select>
      </div>

      <div v-if="pending" class="space-y-2 p-4">
        <UiCard v-for="i in 5" :key="i" :padded="false"><UiSkeletonBlock :lines="1" /></UiCard>
      </div>

      <div v-else-if="!rows.length" class="p-4">
        <AppEmptyState icon="users" title="Tidak ada pengguna" description="Ubah kata kunci atau filter peran." />
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-ink-100 text-[11px] tracking-wide text-ink-400 uppercase">
              <th class="px-4 py-3 font-semibold">Pengguna</th>
              <th class="px-3 py-3 font-semibold">Kontak</th>
              <th class="px-3 py-3 font-semibold">Peran</th>
              <th class="px-3 py-3 font-semibold">Status</th>
              <th class="px-3 py-3 font-semibold">Bergabung</th>
              <th class="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in rows" :key="u.id" class="border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <UiAvatar :name="u.name" :src="u.avatar_url" :size="32" />
                  <div class="min-w-0">
                    <p class="truncate text-[13px] font-semibold text-ink-900">{{ u.name }}</p>
                    <p class="truncate text-[11px] text-ink-400">{{ u.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3 text-[12.5px] text-ink-600">{{ u.phone ?? '-' }}</td>
              <td class="px-3 py-3">
                <!-- `role_label` dari backend, bukan `role`. Nilai enum-nya `user` dan itu
                     bukan bahasa manusia — memaparkannya membuat daftar pengguna
                     terbaca seperti `user`, `admin`, `driver`. -->
                <UiBadge :tone="ROLE_TONES[u.role]" size="sm">{{ u.role_label ?? u.role }}</UiBadge>
              </td>
              <td class="px-3 py-3">
                <UiBadge :tone="STATUS_TONES[u.status]" size="sm" dot>{{ u.status }}</UiBadge>
              </td>
              <td class="px-3 py-3 text-[12px] text-ink-500">{{ formatDate(u.created_at) }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-1.5">
                  <UiButton size="xs" variant="outline" @click="openEdit(u)">Edit</UiButton>
                  <UiButton size="xs" variant="ghost" aria-label="Hapus" @click="removing = u">
                    <UiIcon name="trash-2" class="size-3.5 text-red-600" />
                  </UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta && meta.last_page > 1" class="flex items-center justify-between border-t border-ink-100 px-4 py-3">
        <p class="text-[12px] text-ink-500">
          Halaman {{ meta.current_page }} dari {{ meta.last_page }} · {{ meta.total }} pengguna
        </p>
        <div class="flex gap-2">
          <UiButton size="sm" variant="outline" :disabled="page <= 1" @click="page--">Sebelumnya</UiButton>
          <UiButton size="sm" variant="outline" :disabled="page >= meta.last_page" @click="page++">Berikutnya</UiButton>
        </div>
      </div>
    </UiCard>

    <UiModal :open="!!editing" title="Edit Pengguna" :description="editing?.email" @close="editing = null">
      <div class="space-y-4">
        <label class="block">
          <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Nama lengkap</span>
          <UiInput v-model="form.name" />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Email</span>
          <UiInput v-model="form.email" type="email" />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Nomor WhatsApp</span>
          <UiInput v-model="form.phone" inputmode="numeric" />
        </label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Peran</span>
            <select
              v-model="form.role"
              class="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] text-ink-800 outline-none focus:border-brand-500"
            >
              <option value="user">Pelanggan</option>
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Status</span>
            <select
              v-model="form.status"
              class="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] text-ink-800 outline-none focus:border-brand-500"
            >
              <option value="active">Aktif</option>
              <option value="pending">Menunggu</option>
              <option value="suspended">Ditangguhkan</option>
            </select>
          </label>
        </div>
        <p v-if="editing" class="text-[11.5px] text-ink-400">
          Terakhir diperbarui {{ formatDateTime(editing.updated_at) }}.
        </p>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="editing = null">Batal</UiButton>
        <UiButton :loading="saving" @click="save">Simpan</UiButton>
      </template>
    </UiModal>

    <UiModal
      :open="!!removing"
      title="Hapus Pengguna"
      :description="removing ? `Hapus akun ${removing.name}?` : ''"
      size="sm"
      @close="removing = null"
    >
      <p class="text-[13px] leading-relaxed text-ink-600">
        Tindakan ini tidak dapat dibatalkan. Riwayat perjalanan terkait tetap tersimpan di laporan.
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="removing = null">Batal</UiButton>
        <UiButton variant="danger" :loading="saving" @click="confirmDelete">Hapus</UiButton>
      </template>
    </UiModal>
  </div>
</template>
