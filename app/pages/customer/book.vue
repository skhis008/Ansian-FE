<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LatLng, Place } from '#shared/types'
import { fetchRoute, syntheticRoute } from '#shared/utils/geo'
import { formatRupiah } from '#shared/utils/format'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Pesan Antar Jemput', robots: 'noindex, nofollow' })

const rideStore = useRideStore()
const toast = useToast()
const router = useRouter()

const pickup = ref<Place | null>(null)
const destination = ref<Place | null>(null)
const routePath = ref<LatLng[] | null>(null)
const note = ref('')
const promoCode = ref('')

let routeController: AbortController | null = null

type VehicleTypeOption = {
  id: number
  code: string
  name: string
  base_fare: number
  per_km_rate: number
  minimum_fare: number
  bookable: boolean
}

const { data: vehicleTypes } = await useAsyncData('book-vehicle-types', () =>
  http.get<{ data: VehicleTypeOption[] }>('/vehicle-types').then(r => r.data.filter(v => v.bookable)),
)

const vehicleTypeId = computed(() => vehicleTypes.value?.[0]?.id ?? null)
const selectedVehicle = computed(() => vehicleTypes.value?.find(v => v.id === vehicleTypeId.value) ?? null)

const ready = computed(() => Boolean(pickup.value && destination.value && vehicleTypeId.value))
const canBook = computed(() => ready.value && !rideStore.booking && !rideStore.hasActiveRide)

/* Auto-quote saat kedua titik terisi */
watch([pickup, destination, vehicleTypeId], async ([p, d, typeId]) => {
  if (!p || !d || !typeId) {
    rideStore.quote = null
    routePath.value = null
    return
  }
  routeController?.abort()
  routeController = new AbortController()
  const [quote, route] = await Promise.all([
    rideStore.getQuote({ vehicleTypeId: typeId, pickup: p, destination: d, promoCode: promoCode.value || null }),
    fetchRoute(p, d, routeController.signal),
  ])
  routePath.value = route.points.length > 2 ? route.points : syntheticRoute(p, d)
  if (quote) return
}, { deep: true })

function swap() {
  const tmp = pickup.value
  pickup.value = destination.value
  destination.value = tmp
}

async function book() {
  if (!canBook.value || !pickup.value || !destination.value) return
  try {
    if (!vehicleTypeId.value) return
    const ride = await rideStore.book({
      vehicleTypeId: vehicleTypeId.value,
      pickup: pickup.value,
      destination: destination.value,
      pickupNote: note.value || null,
      promoCode: promoCode.value || null,
    })
    toast.success('Mencari driver terdekat…')
    await router.push(`/customer/active?id=${ride.id}`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal memesan.')
  }
}

/* Guard: user sudah punya perjalanan aktif */
watch(
  () => rideStore.hasActiveRide,
  v => {
    if (v) toast.info('Kamu punya perjalanan aktif.')
  },
  { immediate: true },
)

const distanceLabel = computed(() => {
  const q = rideStore.quote
  if (!q) return '—'
  return `${(q.distance_meters / 1000).toFixed(2)} km`
})

</script>

<template>
  <div class="space-y-5">
    <AppPageHeader
      title="Pesan Antar Jemput"
      description="Tentukan titik jemput dan tujuan, kami carikan driver terdekat."
    />

    <div
      v-if="rideStore.hasActiveRide"
      class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
    >
      <UiIcon name="alert-triangle" class="mt-0.5 size-5 shrink-0 text-amber-600" />
      <div class="flex-1">
        <p class="text-sm font-semibold text-amber-900">Kamu punya perjalanan yang sedang berjalan</p>
        <p class="mt-0.5 text-xs text-amber-700">Selesaikan atau batalkan dulu sebelum memesan lagi.</p>
      </div>
      <UiButton to="/customer/active" size="sm" variant="outline">Lihat</UiButton>
    </div>

    <div class="grid gap-5 lg:grid-cols-5">
      <!-- ============ MAP ============ -->
      <div class="lg:col-span-3">
        <UiCard :padded="false" class="overflow-hidden">
          <ClientOnly>
            <MapCanvas
              :pickup="pickup"
              :destination="destination"
              :route="routePath"
              height="h-[26rem] lg:h-[34rem]"
              @click="pickup = { lat: $event.lat, lng: $event.lng, address: 'Lokasi dipilih (klik untuk detail)', place_name: 'Lokasi dipilih' }"
            />
            <template #fallback>
              <div class="grid h-[26rem] place-items-center bg-ink-100 lg:h-[34rem]">
                <UiSkeletonBlock :lines="1" width="w-40" />
              </div>
            </template>
          </ClientOnly>
        </UiCard>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-ink-900" />
            Titik jemput
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-rose-600" />
            Tujuan
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-1 w-5 rounded-full bg-brand-600" />
            Rute
          </span>
          <span v-if="distanceLabel !== '—'" class="ml-auto font-semibold text-ink-700">{{ distanceLabel }}</span>
        </div>
      </div>

      <!-- ============ FORM ============ -->
      <div class="space-y-4 lg:col-span-2">
        <UiCard>
          <div class="space-y-3">
            <MapLocationPicker
              v-model="pickup"
              kind="pickup"
              label="Titik penjemputan"
              placeholder="Dari mana kamu naik?"
              required
            />

            <div class="flex items-center gap-3">
              <span class="h-px flex-1 bg-ink-200" />
              <button
                type="button"
                class="grid size-8 place-items-center rounded-lg border border-ink-200 bg-white text-ink-500 transition hover:border-brand-300 hover:text-brand-600"
                aria-label="Tukar lokasi"
                title="Tukar penjemputan & tujuan"
                @click="swap"
              >
                <UiIcon name="refresh-cw" class="size-4" />
              </button>
              <span class="h-px flex-1 bg-ink-200" />
            </div>

            <MapLocationPicker
              v-model="destination"
              kind="destination"
              label="Tujuan"
              placeholder="Mau ke mana?"
              required
            />

            <UiInput
              v-model="note"
              label="Catatan untuk driver (opsional)"
              placeholder="misal: Pintu belakang, warna rambut hitam"
              :maxlength="120"
            />
          </div>
        </UiCard>

        <UiCard>
          <h3 class="text-sm font-semibold text-ink-900">Kendaraan</h3>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              v-for="v in vehicleTypes ?? []"
              :key="v.id"
              type="button"
              class="rounded-xl border p-3 text-left transition"
              :class="vehicleTypeId === v.id
                ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/20'
                : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'"
              @click="vehicleTypeId = v.id"
            >
              <span class="block text-xs font-bold text-ink-900">{{ v.name }}</span>
              <span class="mt-1 block text-[11px] text-ink-500">
                {{ formatRupiah(v.base_fare) }} + {{ formatRupiah(v.per_km_rate) }}/km
              </span>
              <span class="mt-0.5 block text-[10px] text-ink-400">Minimum {{ formatRupiah(v.minimum_fare) }}</span>
            </button>
          </div>
        </UiCard>

        <UiCard>
          <UiInput
            v-model="promoCode"
            label="Kode promo (opsional)"
            placeholder="misal: hujan10"
            :maxlength="32"
          />
        </UiCard>

        <RideFareSummary
          :quote="rideStore.quote"
          :loading="rideStore.quoting"
          note="Rincian ini dihitung server, sama persis dengan yang dipakai saat kamu menekan tombol pesan."
        />

        <div class="sticky bottom-20 space-y-2 lg:bottom-4">
          <UiButton size="lg" block :disabled="!canBook" :loading="rideStore.booking" @click="book">
            <template #icon><UiIcon name="navigation" class="size-5" /></template>
            Pesan Sekarang
            <span v-if="rideStore.quote" class="ml-1 opacity-80">
              · {{ formatRupiah(rideStore.quote.total) }}
            </span>
          </UiButton>
          <p v-if="!ready" class="text-center text-[11px] text-ink-400">
            Pilih titik penjemputan dan tujuan untuk melanjutkan.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
