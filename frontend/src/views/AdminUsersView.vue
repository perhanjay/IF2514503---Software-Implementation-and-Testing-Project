<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { AlertTriangle, AudioLines, Ban, RefreshCw, Search, Users, X } from 'lucide-vue-next'
import AppNavbar from '../components/AppNavbar.vue'
import RetroSelect from '../components/ui/RetroSelect.vue'
import AdminUsersDirectory from '../components/admin/AdminUsersDirectory.vue'
import UserSupportDrawer from '../components/admin/UserSupportDrawer.vue'
import { formatNumberId } from '../utils/adminFormatters'

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'Semua Peran' },
  { value: 'AUDIO_ENGINEER', label: 'Audio Engineer' },
  { value: 'ADMIN', label: 'Admin' }
]
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'SUSPENDED', label: 'Ditangguhkan' }
]

const users = ref([])
const stats = ref({ totalUsers: 0, activeEngineers: 0, suspendedAccounts: 0 })
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const selectedRole = ref('ALL')
const selectedStatus = ref('ALL')
const currentPage = ref(1)
const selectedUserId = ref(null)
const isDrawerOpen = ref(false)
let searchTimeout = null

const kpiCards = computed(() => [
  { key: 'total', label: 'Total Pengguna', value: stats.value.totalUsers, icon: Users, iconBg: 'bg-[#87d7ff]', valueClass: 'text-[#111111]' },
  { key: 'engineers', label: 'Engineer Aktif', value: stats.value.activeEngineers, icon: AudioLines, iconBg: 'bg-[#d8f3dc]', valueClass: 'text-[#111111]' },
  { key: 'suspended', label: 'Akun Ditangguhkan', value: stats.value.suspendedAccounts, icon: Ban, iconBg: 'bg-[#ffcae6]', valueClass: stats.value.suspendedAccounts > 0 ? 'text-[#be123c]' : 'text-[#111111]' }
])

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: currentPage.value, limit: 20 }
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
    if (selectedRole.value !== 'ALL') params.role = selectedRole.value
    if (selectedStatus.value !== 'ALL') params.status = selectedStatus.value
    const res = await axios.get('/api/v1/admin/users', { params })
    users.value = res.data.users || []
    pagination.value = res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }
    stats.value = res.data.stats || { totalUsers: 0, activeEngineers: 0, suspendedAccounts: 0 }
  } catch (err) {
    console.error('Failed to fetch admin users:', err)
    error.value = err.response?.data?.error || 'Gagal memuat direktori pengguna'
  } finally {
    loading.value = false
  }
}

function resetAndFetch() {
  if (currentPage.value !== 1) currentPage.value = 1
  else fetchUsers()
}

watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(resetAndFetch, 300)
})
watch([selectedRole, selectedStatus], resetAndFetch)
watch(currentPage, fetchUsers)

function goToPage(page) {
  if (page >= 1 && page <= (pagination.value.totalPages || 1)) currentPage.value = page
}

function clearFilters() {
  clearTimeout(searchTimeout)
  searchQuery.value = ''
  selectedRole.value = 'ALL'
  selectedStatus.value = 'ALL'
  resetAndFetch()
}

function openManageUser(userId) {
  selectedUserId.value = userId
  isDrawerOpen.value = true
}

onMounted(fetchUsers)
onBeforeUnmount(() => clearTimeout(searchTimeout))
</script>

<template>
  <div class="min-h-screen notebook-paper relative overflow-x-clip text-[#111111] flex flex-col selection:bg-[#ff82c2] selection:text-[#111111] font-sans">
    <div aria-hidden="true" class="pointer-events-none fixed -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#20afff]/12 blur-[110px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed top-[32%] -right-28 w-[420px] h-[420px] rounded-full bg-[#ffda40]/14 blur-[120px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed -bottom-28 left-[18%] w-[380px] h-[380px] rounded-full bg-[#ff82c2]/10 blur-[120px]"></div>

    <AppNavbar :fluid="true" />

    <main class="relative z-10 flex-1 w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 py-7 md:py-9 space-y-6">
      <div
        v-if="error && users.length > 0"
        role="alert"
        class="rounded-[14px] border-[1.5px] border-rose-400 bg-rose-50/95 px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold text-rose-950 shadow-[2px_3px_0_#111111]"
      >
        <div class="flex items-center gap-2.5">
          <AlertTriangle class="w-4 h-4 text-rose-700 shrink-0" :stroke-width="2.2" />
          <span>{{ error }}</span>
        </div>
        <button type="button" @click="error = ''" class="p-1 text-rose-700 hover:text-rose-950 cursor-pointer" aria-label="Tutup notifikasi">
          <X class="w-4 h-4" :stroke-width="2.2" />
        </button>
      </div>

      <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <h1 class="font-editorial font-bold text-3xl sm:text-4xl text-[#111111] tracking-[-0.03em] leading-none">
          Manajemen Pengguna
        </h1>
        <button type="button" @click="fetchUsers" :disabled="loading" class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" :stroke-width="2.2" />
          <span>{{ loading ? 'Memperbarui...' : 'Segarkan Data' }}</span>
        </button>
      </header>

      <section aria-label="Ringkasan Pengguna" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          v-for="card in kpiCards"
          :key="card.key"
          class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 flex items-center justify-between gap-4"
        >
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-[#60605e]">{{ card.label }}</div>
            <div :class="card.valueClass" class="mt-1.5 font-editorial font-bold text-3xl tracking-tight tabular-nums leading-none">
              {{ formatNumberId(card.value) }}
            </div>
          </div>
          <span :class="card.iconBg" class="w-11 h-11 rounded-[12px] border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_#111111] flex items-center justify-center shrink-0">
            <component :is="card.icon" class="w-5 h-5 text-[#111111]" :stroke-width="2.2" />
          </span>
        </div>
      </section>

      <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div class="relative flex-1">
          <Search class="w-4 h-4 text-[#60605e] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" :stroke-width="2.2" />
          <input
            v-model="searchQuery"
            type="text"
            aria-label="Cari nama atau email pengguna"
            placeholder="Cari nama atau email pengguna..."
            class="w-full h-10 pl-10 pr-10 text-xs sm:text-sm font-medium text-[#111111] bg-white border-[1.5px] border-[#111111] rounded-[12px] shadow-[1.5px_2px_0_#111111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20afff] placeholder:text-[#60605e]/80"
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="searchQuery = ''"
            aria-label="Hapus pencarian"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-[8px] text-[#60605e] hover:text-[#111111] cursor-pointer"
          >
            <X class="w-3.5 h-3.5" :stroke-width="2.2" />
          </button>
        </div>

        <div class="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <RetroSelect v-model="selectedRole" :options="ROLE_OPTIONS" aria-label="Filter peran pengguna" :compact="true" />
          <RetroSelect v-model="selectedStatus" :options="STATUS_OPTIONS" aria-label="Filter status pengguna" :compact="true" />
        </div>
      </div>

      <AdminUsersDirectory
        :users="users"
        :loading="loading"
        :error="error"
        :pagination="pagination"
        :current-page="currentPage"
        @manage-user="openManageUser"
        @page-change="goToPage"
        @retry="fetchUsers"
        @clear-filters="clearFilters"
      />
    </main>

    <UserSupportDrawer :user-id="selectedUserId" :is-open="isDrawerOpen" @close="isDrawerOpen = false" @user-updated="fetchUsers" />
  </div>
</template>
