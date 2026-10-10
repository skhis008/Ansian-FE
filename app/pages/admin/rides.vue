<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { normalizeRides, type Paginated, type Ride, type RideResourceShape, type RideStatus } from '#shared/types'
import { formatRupiah, formatDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Kelola Perjalanan', robots: 'noindex, nofollow' })

const toast = useToast()
const search = ref('')
const status = ref<RideStatus | ''>('')
const page = ref(1)

const query = reactive({ status: '', search: '' })
watch([search, status], () => {
  query.search = search.value
  query.status = status.value
  page.value = 1
})

const { data, pending, refresh } = await useAsyncData(
  'admin-rides',
  // BE `GET /rides` menerima `status`, `scope`, `page`, `per_page` saja — tidak ada
  // `search` dan tidak ada `sort_by`. Kotak pencarian di layar ini jadi tidak
  // berguna saat mock dimatikan; pencarian ride perlu endpoint baru.
  () => http.get<{ data?: RideResourceShape[] }>('/rides', { status: query.status || undefined, page: page.value, per_page: 15 }),
  { watch: [query, page] },
)

const rows = computed(() => normalizeRides(data.value))
const meta = computed(() => (data.value as unknown as Paginated<Ride> | null)?.meta ?? null)

const editing = ref<Ride | null>(null)
const nextStatus = ref<RideStatus>('completed')
const saving = ref(false)

const STATUS_OPTIONS: { value: RideStatus; label: string }[] = [
  { value: 'searching', label: 'Mencari Driver' },
  { value: 'driver_assigned', label: 'Driver Ditugaskan' },
  { value: 'driver_arrived', label: 'Driver Tiba' },
  { value: 'in_progress', label: 'Berjalan' },
  { value: 'completed', label: 'Selesai' },
  { value: 'passenger_cancelled', label: 'Dibatalkan penumpang' },
  { value: 'driver_cancelled', label: 'Dibatalkan driver' },
  { value: 'no_driver_found', label: 'Tidak ada driver' },
  { value: 'rejected', label: 'Mencari driver lagi' },
]

function openEdit(ride: Ride) {
  editing.value = ride
  nextStatus.value = ride.status
}

async function save() {
  if (!editing.value) return
  saving.value = true
  try {
    await http.patch(`/admin/rides/${editing.value.id}`, { status: nextStatus.value })
    toast.success(`Perjalanan ${editing.value.ride_code} diperbarui.`)
    editing.value = null
    await refresh()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal memperbarui perjalanan.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Kelola Perjalanan" description="Pantau dan koreksi status seluruh perjalanan." />

    <UiCard :padded="false">
      <div class="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
        <div class="relative min-w-[15rem] flex-1">
          <UiIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <input
            v-model="search"
            type="search"
            placeholder="Cari kode perjalanan, alamat, atau nama…"
            class="h-10 w-full rounded-xl border border-ink-200 bg-white pr-3 pl-9 text-sm outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          >
        </div>
        <select
          v-model="status"
          class="h-10 rounded-xl border border-ink-200 bg-white px-3 text-[12.5px] font-medium text-ink-700 outline-none focus:border-brand-500"
        >
          <option value="">Semua status</option>
          <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <UiButton variant="outline" size="sm" @click="refresh()">
          <template #icon><UiIcon name="refresh-cw" class="size-4" /></template>
          Segarkan
        </UiButton>
      </div>

      <div v-if="pending" class="space-y-2 p-4">
        <UiCard v-for="i in 5" :key="i" :padded="false"><UiSkeletonBlock :lines="1" /></UiCard>
      </div>

      <div v-else-if="!rows.length" class="p-4">
        <AppEmptyState icon="navigation" title="Tidak ada perjalanan" description="Ubah kata kunci atau filter status." />
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-ink-100 text-[11px] tracking-wide text-ink-400 uppercase">
              <th class="px-4 py-3 font-semibold">Kode</th>
              <th class="px-3 py-3 font-semibold">Rute</th>
              <th class="px-3 py-3 font-semibold">Pelanggan</th>
              <th class="px-3 py-3 font-semibold">Driver</th>
              <th class="px-3 py-3 font-semibold">Status</th>
              <th class="px-3 py-3 font-semibold">Bayar</th>
              <th class="px-3 py-3 text-right font-semibold">Tarif</th>
              <th class="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
              <td class="px-4 py-3">
                <p class="font-mono text-[12.5px] font-semibold text-ink-900">{{ r.ride_code }}</p>
                <p class="text-[11px] text-ink-400">{{ formatDateTime(r.created_at) }}</p>
              </td>
              <td class="max-w-[16rem] px-3 py-3">
                <p class="truncate text-[12.5px] text-ink-700">{{ r.pickup.place_name ?? r.pickup.address }}</p>
                <p class="truncate text-[11px] text-ink-400">ke {{ r.destination.place_name ?? r.destination.address }}</p>
              </td>
              <td class="px-3 py-3 text-[12.5px] text-ink-700">{{ r.customer?.name ?? '-' }}</td>
              <td class="px-3 py-3 text-[12.5px] text-ink-500">{{ r.driver?.user?.name ?? '-' }}</td>
              <td class="px-3 py-3"><RideStatusBadge :status="r.status" size="sm" /></td>
              <td class="px-3 py-3">
                <UiBadge :tone="r.payment_status === 'paid' ? 'success' : 'warning'" size="sm">
                  {{ r.payment_status }}
                </UiBadge>
              </td>
              <td class="px-3 py-3 text-right text-[12.5px] font-semibold text-ink-900">{{ formatRupiah(r.fare) }}</td>
              <td class="px-4 py-3 text-right">
                <UiButton size="xs" variant="outline" @click="openEdit(r)">Kelola</UiButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta && meta.last_page > 1" class="flex items-center justify-between border-t border-ink-100 px-4 py-3">
        <p class="text-[12px] text-ink-500">
          Halaman {{ meta.current_page }} dari {{ meta.last_page }} · {{ meta.total }} data
        </p>
        <div class="flex gap-2">
          <UiButton size="sm" variant="outline" :disabled="page <= 1" @click="page--">Sebelumnya</UiButton>
          <UiButton size="sm" variant="outline" :disabled="page >= meta.last_page" @click="page++">Berikutnya</UiButton>
        </div>
      </div>
    </UiCard>

    <UiModal
      :open="!!editing"
      title="Kelola Perjalanan"
      :description="editing ? `${editing.ride_code} · ${formatRupiah(editing.fare)}` : ''"
      @close="editing = null"
    >
      <div v-if="editing" class="space-y-4">
        <dl class="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-3.5 text-[12.5px]">
          <div>
            <dt class="text-ink-400">Status sekarang</dt>
            <dd class="mt-0.5"><RideStatusBadge :status="editing.status" size="sm" /></dd>
          </div>
          <div>
            <dt class="text-ink-400">Pembayaran</dt>
            <dd class="mt-0.5 font-semibold text-ink-800">{{ editing.payment_method }} · {{ editing.payment_status }}</dd>
          </div>
          <div>
            <dt class="text-ink-400">Jarak</dt>
            <dd class="mt-0.5 font-semibold text-ink-800">{{ (editing.distance_km ?? 0).toFixed(1) }} km</dd>
          </div>
          <div>
            <dt class="text-ink-400">Durasi</dt>
            <dd class="mt-0.5 font-semibold text-ink-800">{{ editing.duration_min ?? 0 }} menit</dd>
          </div>
        </dl>

        <label class="block">
          <span class="mb-1.5 block text-[12.5px] font-medium text-ink-700">Ubah status menjadi</span>
          <select
            v-model="nextStatus"
            class="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] text-ink-800 outline-none focus:border-brand-500"
          >
            <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
        <p class="text-[11.5px] text-ink-400">
          Perubahan status manual dicatat di riwayat perjalanan dan dikirim ke pelanggan serta driver terkait.
        </p>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="editing = null">Batal</UiButton>
        <UiButton :loading="saving" @click="save">Simpan</UiButton>
      </template>
    </UiModal>
  </div>
</template>
