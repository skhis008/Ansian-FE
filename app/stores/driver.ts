import { defineStore } from 'pinia'
import type { DriverEarnings, DriverJob, DriverProfile, LatLng, Ride } from '#shared/types'
import { http } from '~/composables/useApi'
import type { DriverLocationEvent } from '~/composables/useRealtime'

interface DriverState {
  profile: DriverProfile | null
  jobs: DriverJob[]
  rides: Ride[]
  earnings: DriverEarnings | null
  liveLocation: LatLng | null
  trackingLocation: LatLng | null
  online: boolean
  loadingJobs: boolean
  loadingRides: boolean
  loading: boolean
  busy: boolean
}

export const useDriverStore = defineStore('driver', {
  state: (): DriverState => ({
    profile: null,
    jobs: [],
    rides: [],
    earnings: null,
    liveLocation: null,
    trackingLocation: null,
    online: false,
    loadingJobs: false,
    loadingRides: false,
    loading: false,
    busy: false,
  }),

  getters: {
    statusLabel: state => {
      switch (state.profile?.status) {
        case 'idle':
          return 'Online'
        case 'busy':
          return 'Sedang mengantar'
        case 'offline':
        default:
          return 'Offline'
      }
    },
    isAvailable: state => state.profile?.status === 'idle',
  },

  actions: {
    sync(profile: DriverProfile | null) {
      this.profile = profile
      this.online = profile?.status !== 'offline'
      if (profile?.lat && profile?.lng) this.liveLocation = { lat: profile.lat, lng: profile.lng }
    },

    async toggleStatus() {
      if (!this.profile) return
      this.busy = true
      try {
        // Backend menerima `is_available`, bukan string status. Status yang boleh
        // dipasang driver untuk dirinya sendiri juga cara membatalkan suspendu,
        // jadi layar ini hanya boleh mengirim flag itu.
        const nextAvailable = this.profile.status === 'offline'
        const res = await http.put<{ data: DriverProfile }>('/driver/profile/availability', { is_available: nextAvailable })
        this.sync(res.data)
        return res.data
      } finally {
        this.busy = false
      }
    },

    async fetchJobs() {
      if (!this.profile || this.profile.status === 'offline') {
        this.jobs = []
        return
      }
      this.loadingJobs = true
      try {
        const res = await http.get<{ data: DriverJob[] }>('/driver/rides/nearby')
        this.jobs = res.data
      } finally {
        this.loadingJobs = false
      }
    },

    async fetchEarnings() {
      const res = await http.get<{ data: DriverEarnings }>('/drivers/me/earnings')
      this.earnings = res.data
      return res.data
    },

    /** Riwayat perjalanan yang pernah dilayani driver ini */
    async fetchRides() {
      this.loadingRides = true
      try {
        const res = await http.get<{ data: Ride[] }>('/rides', { per_page: 50 })
        this.rides = res.data
        return res.data
      } finally {
        this.loadingRides = false
      }
    },

    async acceptJob(rideId: number) {
      this.busy = true
      try {
        const res = await http.post<{ data: Ride }>(`/rides/${rideId}/accept`)
        this.jobs = this.jobs.filter(j => j.ride_id !== rideId)
        if (this.profile) this.profile.status = 'busy'
        return res.data
      } finally {
        this.busy = false
      }
    },

    async rejectJob(rideId: number) {
      const res = await http.post<{ data: { rejected: boolean } }>(`/drivers/jobs/${rideId}/reject`)
      this.jobs = this.jobs.filter(j => j.ride_id !== rideId)
      return res.data
    },

    /** Kirim posisi driver saat ini ke backend + channel realtime */
    async updateLocation(lat: number, lng: number) {
      this.liveLocation = { lat, lng }
      const res = await http.put<{ data: { lat: number; lng: number } }>('/driver/profile/location', { lat, lng })
      if (this.profile) {
        this.profile.lat = res.data.lat
        this.profile.lng = res.data.lng
      }
      return res.data
    },

    /**
     * Data kendaraan driver.
     *
     * TODO backend: belum ada padanan di BE dan tidak bisa dipetakan dengan
     * rename. BE memisahkan kendaraan jadi baris sendiri lewat
     * `POST /api/v1/driver/vehicles`, dan bentuknya berbeda: `vehicle_type_id`
     * (id katalog, bukan string `motorcycle`), `plate_number`, `brand`, `model`,
     * `year`, `color`. Tidak ada `PATCH` — kendaraan diganti, bukan diubah
     * di tempat. Layar ini perlu dibangun ulang, bukandisambiguation path.
     */
    async updateVehicle(payload: Partial<Pick<DriverProfile, 'vehicle_type' | 'vehicle_plate' | 'vehicle_color' | 'vehicle_model'>>) {
      const res = await http.patch<{ data: DriverProfile }>('/drivers/me', { vehicle: payload })
      this.profile = res.data
      return res.data
    },

    /** Broadcast lokasi driver (dari channel private) */
    applyLocation(payload: DriverLocationEvent) {
      this.liveLocation = { lat: payload.lat, lng: payload.lng }
      if (this.profile) {
        this.profile.lat = payload.lat
        this.profile.lng = payload.lng
      }
    },

    /** Broadcast lokasi driver untuk halaman customer yang melacak */
    applyRideLocation(payload: DriverLocationEvent) {
      this.trackingLocation = { lat: payload.lat, lng: payload.lng }
    },

    clearTracking() {
      this.trackingLocation = null
    },
  },
})
