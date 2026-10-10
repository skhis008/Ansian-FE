<script setup lang="ts">
import type { RideStatus } from '#shared/types'
import { RIDE_STATUS_LABELS } from '#shared/types'

const props = defineProps<{ status: RideStatus; size?: 'sm' | 'md' }>()

const config: Record<RideStatus, { tone: 'brand' | 'gray' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; icon: string }> = {
  searching: { tone: 'warning', icon: 'search' },
  driver_assigned: { tone: 'info', icon: 'user' },
  driver_arrived: { tone: 'purple', icon: 'map-pin' },
  in_progress: { tone: 'brand', icon: 'navigation' },
  completed: { tone: 'success', icon: 'check' },
  // Pembatalan dan kegagalan dipisahkan ikon supaya "kamu yang batalin" tidak
  // tampil sama dengan "tidak ada driver". Kalimatnya sudah berbeda lewat
  // RIDE_STATUS_LABELS; ikon membedakan tanpa harus dibaca.
  passenger_cancelled: { tone: 'danger', icon: 'x' },
  driver_cancelled: { tone: 'danger', icon: 'x' },
  no_driver_found: { tone: 'danger', icon: 'alert-triangle' },
  rejected: { tone: 'gray', icon: 'rotate-ccw' },
}
</script>

<template>
  <UiBadge :tone="config[props.status].tone" :size="size">
    <UiIcon :name="config[props.status].icon" class="size-3" />
    {{ RIDE_STATUS_LABELS[props.status] }}
  </UiBadge>
</template>
