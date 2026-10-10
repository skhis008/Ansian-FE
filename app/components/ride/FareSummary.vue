<script setup lang="ts">
import type { FareQuote } from '#shared/types'
import { formatRupiah } from '#shared/utils/format'

defineProps<{ quote: FareQuote | null; loading?: boolean; note?: string }>()

/*
 * Rincian ini disalin apa adanya dari `POST /rides/preview`. Backend menghitung
 * tarif dari tarif dasar ditambah kilometer, jadi begitu juga yang ditampilkan:
 * Passenger berhak tahu kenapa ongkosnya segitu, dan angka yang tampil di sini
 * adalah angka yang dipakai server saat memesan.
 *
 * Tidak ada "biaya admin" dan tidak ada zona. Keduanya tidak ada di backend —
 * uang tidak pernah singgah di aplikasi, jadi tidak ada komisi untuk dipotong.
 */
</script>

<template>
  <div class="rounded-2xl border border-ink-200 bg-white p-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-ink-900">Rincian tarif</h3>
      <span
        v-if="quote"
        class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700"
      >
        {{ quote.billable_kilometres }} km ditagih
      </span>
    </div>

    <div v-if="loading" class="mt-3 space-y-2">
      <UiSkeletonBlock v-for="i in 4" :key="i" :lines="1" height="h-3" />
    </div>

    <template v-else-if="quote">
      <dl class="mt-3 space-y-2 text-sm">
        <div class="flex justify-between">
          <dt class="text-ink-500">Tarif dasar</dt>
          <dd class="font-medium text-ink-700">{{ formatRupiah(quote.base_fare) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-ink-500">
            Ongkos {{ quote.billable_kilometres }} km × {{ formatRupiah(quote.per_km_rate) }}
          </dt>
          <dd class="font-medium text-ink-700">
            {{ formatRupiah(quote.billable_kilometres * quote.per_km_rate) }}
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-ink-500">Jarak sebenarnya</dt>
          <dd class="font-medium text-ink-700">
            {{ (quote.distance_meters / 1000).toFixed(2) }} km
          </dd>
        </div>
        <div v-if="quote.surcharge" class="flex justify-between">
          <dt class="text-ink-500">{{ quote.surcharge.name }}</dt>
          <dd class="font-medium text-ink-700">{{ formatRupiah(quote.surcharge.amount) }}</dd>
        </div>
        <div v-if="quote.discount_amount > 0" class="flex justify-between">
          <dt class="text-ink-500">Diskon{{ quote.promo_code ? ` ${quote.promo_code}` : '' }}</dt>
          <dd class="font-medium text-emerald-600">−{{ formatRupiah(quote.discount_amount) }}</dd>
        </div>
        <div v-if="quote.minimum_fare > quote.base_fare" class="flex justify-between">
          <dt class="text-ink-500">Minimum tarif</dt>
          <dd class="font-medium text-ink-500">
            {{ formatRupiah(quote.minimum_fare) }}
            <span class="text-[11px] font-normal">(tidak berlaku)</span>
          </dd>
        </div>
      </dl>

      <div class="mt-3 flex items-end justify-between rounded-xl bg-brand-50 px-3.5 py-3">
        <span class="text-sm font-semibold text-brand-800">Total</span>
        <span class="text-xl font-bold text-brand-700">{{ formatRupiah(quote.total) }}</span>
      </div>

      <p v-if="note" class="mt-2 text-[11px] text-ink-400">{{ note }}</p>
    </template>

    <p v-else class="mt-3 text-sm text-ink-400">
      Isi titik penjemputan dan tujuan untuk melihat estimasi tarif.
    </p>
  </div>
</template>