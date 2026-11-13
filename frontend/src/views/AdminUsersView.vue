<script setup>
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'
import AppNavbar from '../components/AppNavbar.vue'
import UserSupportDrawer from '../components/admin/UserSupportDrawer.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

// State
const users = ref([])
const stats = ref({
  totalUsers: 0,
  activeEngineers: 0,
  suspendedAccounts: 0
})
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1
})
const loading = ref(false)
const error = ref('')

// Filters
const searchQuery = ref('')
const selectedRole = ref('ALL')
const selectedStatus = ref('ALL')
const currentPage = ref(1)

// Selected user ID & drawer visibility for Task 6
const selectedUserId = ref(null)
const isDrawerOpen = ref(false)

let searchTimeout = null

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const params = {
      page: currentPage.value,
      limit: 20
    }
    if (searchQuery.value && searchQuery.value.trim()) {
      params.q = searchQuery.value.trim()
    }
    if (selectedRole.value && selectedRole.value !== 'ALL') {
      params.role = selectedRole.value
    }
    if (selectedStatus.value && selectedStatus.value !== 'ALL') {
      params.status = selectedStatus.value
    }

    const res = await axios.get('/api/v1/admin/users', { params })
    users.value = res.data.users || []
    pagination.value = res.data.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1
    }
    stats.value = res.data.stats || {
      totalUsers: 0,
      activeEngineers: 0,
      suspendedAccounts: 0
    }
  } catch (err) {
    console.error('Failed to fetch admin users:', err)
    error.value = err.response?.data?.error || 'Gagal memuat direktori pengguna'
  } finally {
    loading.value = false
  }
}

// Watchers for filtering and debounce
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchUsers()
  }, 300)
})

watch([selectedRole, selectedStatus], () => {
  currentPage.value = 1
  fetchUsers()
})

watch(currentPage, () => {
  fetchUsers()
})

function goToPage(page) {
  if (page >= 1 && page <= pagination.value.totalPages) {
    currentPage.value = page
  }
}

function openManageUser(userId) {
  selectedUserId.value = userId
  isDrawerOpen.value = true
  console.log('Open manage drawer for user ID:', userId)
}

function formatNumber(val) {
  return new Intl.NumberFormat('id-ID').format(val || 0)
}

function formatDate(isoStr) {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return isoStr
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="min-h-screen bg-bone text-ink-black flex flex-col selection:bg-hot-pink selection:text-ink-black font-editorial">
    <AppNavbar :fluid="true" />

    <main class="flex-1 w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 md:py-8 space-y-6">

      <!-- Error Toast Notification -->
      <div 
        v-if="error" 
        role="alert" 
        class="p-4 border border-rose-300 bg-rose-50 text-rose-950 flex items-center justify-between gap-3 text-xs font-mono-accent rounded-none">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-rose-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{{ error }}</span>
        </div>
        <button 
          @click="error = ''" 
          class="text-rose-700 hover:text-rose-950 p-1 transition-colors cursor-pointer"
          aria-label="Tutup notifikasi">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Header Section -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2 px-1">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate bg-paper-white px-2 py-0.5 border border-stone">
              System Administration
            </span>
          </div>
          <h1 class="font-editorial font-bold text-2xl tracking-tight text-ink-black">
            USERS MANAGEMENT
          </h1>
        </div>

        <button 
          @click="fetchUsers" 
          :disabled="loading"
          class="btn-bone-secondary border border-stone h-10 px-4 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:border-ink-black transition-colors">
          <svg class="w-4 h-4 text-ink-black" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{{ loading ? 'Memperbarui...' : 'Segarkan Data' }}</span>
        </button>
      </div>

      <!-- Sub-navigation Tabs -->
      <div class="flex items-center gap-6 border-b border-stone">
        <router-link 
          to="/admin/users" 
          class="pb-3 text-sm font-semibold text-ink-black border-b-2 border-black -mb-px">
          Pengguna
        </router-link>
        <router-link 
          to="/admin/transactions" 
          class="pb-3 text-sm font-medium text-slate hover:text-ink-black transition-colors">
          Audit Transaksi
        </router-link>
      </div>

      <!-- Summary Stats Strip -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Total Users -->
        <div class="bg-paper-white border border-stone p-5 rounded-none">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate mb-1.5">
            TOTAL USERS
          </div>
          <div class="font-mono-accent text-3xl font-bold text-ink-black tracking-tight">
            {{ formatNumber(stats.totalUsers) }}
          </div>
          <div class="text-[11px] text-slate mt-1 font-mono-accent">
            Akun terdaftar dalam database
          </div>
        </div>

        <!-- Active Engineers -->
        <div class="bg-paper-white border border-stone p-5 rounded-none">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate mb-1.5">
            ACTIVE ENGINEERS
          </div>
          <div class="font-mono-accent text-3xl font-bold text-ink-black tracking-tight flex items-baseline gap-2">
            <span>{{ formatNumber(stats.activeEngineers) }}</span>
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mb-1"></span>
          </div>
          <div class="text-[11px] text-slate mt-1 font-mono-accent">
            Audio engineer berstatus aktif
          </div>
        </div>

        <!-- Suspended Accounts -->
        <div class="bg-paper-white border border-stone p-5 rounded-none">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate mb-1.5">
            SUSPENDED
          </div>
          <div class="font-mono-accent text-3xl font-bold text-rose-600 tracking-tight flex items-baseline gap-2">
            <span>{{ formatNumber(stats.suspendedAccounts) }}</span>
            <span v-if="stats.suspendedAccounts > 0" class="inline-block w-2 h-2 rounded-full bg-rose-500 mb-1"></span>
          </div>
          <div class="text-[11px] text-slate mt-1 font-mono-accent">
            Akun ditangguhkan oleh admin
          </div>
        </div>
      </div>

      <!-- Filter Controls Strip -->
      <div class="bg-paper-white border border-stone p-4 rounded-none flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <!-- Search Input -->
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Cari nama atau email pengguna..." 
            class="w-full pl-9 pr-4 py-2 text-xs text-ink-black bg-paper-white border border-stone rounded-none focus:outline-none focus:border-ink-black focus:ring-1 focus:ring-ink-black placeholder:text-slate"
          />
        </div>

        <!-- Role & Status Dropdowns -->
        <div class="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <div class="flex items-center gap-2">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-slate whitespace-nowrap">
              Peran:
            </label>
            <select 
              v-model="selectedRole" 
              class="border border-stone bg-paper-white px-3 py-2 text-xs text-ink-black rounded-none focus:outline-none focus:border-ink-black cursor-pointer">
              <option value="ALL">Semua Peran</option>
              <option value="AUDIO_ENGINEER">Audio Engineer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-slate whitespace-nowrap">
              Status:
            </label>
            <select 
              v-model="selectedStatus" 
              class="border border-stone bg-paper-white px-3 py-2 text-xs text-ink-black rounded-none focus:outline-none focus:border-ink-black cursor-pointer">
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="SUSPENDED">Ditangguhkan</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Directory Table -->
      <div class="border border-stone bg-paper-white rounded-none overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-bone border-b border-stone text-[11px] font-semibold uppercase tracking-wider text-slate">
                <th class="py-3 px-4">NAME &amp; EMAIL</th>
                <th class="py-3 px-4">ROLE</th>
                <th class="py-3 px-4">STATUS</th>
                <th class="py-3 px-4">TOKENS</th>
                <th class="py-3 px-4">JOINED</th>
                <th class="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone bg-paper-white text-xs">
              <!-- Loading Skeleton -->
              <tr v-if="loading && users.length === 0">
                <td colspan="6" class="py-12 text-center text-slate font-mono-accent text-xs">
                  Memuat direktori pengguna...
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="users.length === 0">
                <td colspan="6" class="py-12 text-center text-slate font-mono-accent text-xs">
                  Tidak ada pengguna ditemukan dengan kriteria filter saat ini.
                </td>
              </tr>

              <!-- User Rows -->
              <tr 
                v-for="user in users" 
                :key="user.id" 
                class="hover:bg-bone/40 transition-colors">
                <!-- Name & Email -->
                <td class="py-3.5 px-4">
                  <div class="font-semibold text-ink-black leading-tight">
                    {{ user.name }}
                  </div>
                  <div class="font-mono-accent text-[11px] text-slate mt-0.5">
                    {{ user.email }}
                  </div>
                </td>

                <!-- Role -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span class="badge-pill-stamp inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-bone text-ink-black border border-stone">
                    {{ user.role === 'ADMIN' ? 'Admin' : 'Engineer' }}
                  </span>
                </td>

                <!-- Status -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span 
                    v-if="user.status === 'ACTIVE'"
                    class="badge-pill-stamp inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    ACTIVE
                  </span>
                  <span 
                    v-else
                    class="badge-pill-stamp inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-rose-50 text-rose-800 border border-rose-300">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    SUSPENDED
                  </span>
                </td>

                <!-- Tokens -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span class="font-mono-accent font-bold text-ink-black">
                    {{ formatNumber(user.wallet?.balance ?? 0) }}
                  </span>
                  <span class="font-mono-accent text-[11px] text-slate ml-1">Token</span>
                </td>

                <!-- Joined -->
                <td class="py-3.5 px-4 whitespace-nowrap font-mono-accent text-[11px] text-slate">
                  {{ formatDate(user.createdAt) }}
                </td>

                <!-- Actions -->
                <td class="py-3.5 px-4 text-right whitespace-nowrap">
                  <button 
                    @click="openManageUser(user.id)" 
                    class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold hover:border-ink-black transition-colors cursor-pointer">
                    MANAGE
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls Footer -->
        <div class="bg-bone border-t border-stone px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div class="font-mono-accent text-slate text-[11px]">
            Menampilkan <span class="font-semibold text-ink-black">{{ users.length }}</span> dari <span class="font-semibold text-ink-black">{{ pagination.total }}</span> pengguna
          </div>

          <div class="flex items-center gap-3">
            <span class="font-mono-accent text-slate text-[11px]">
              Halaman {{ pagination.page }} dari {{ pagination.totalPages }}
            </span>

            <div class="flex items-center gap-1.5">
              <button 
                @click="goToPage(currentPage - 1)" 
                :disabled="currentPage <= 1 || loading"
                class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink-black transition-colors cursor-pointer">
                Previous
              </button>
              <button 
                @click="goToPage(currentPage + 1)" 
                :disabled="currentPage >= pagination.totalPages || loading"
                class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink-black transition-colors cursor-pointer">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

    </main>

    <!-- User Support Drawer & Action Modals -->
    <UserSupportDrawer 
      :user-id="selectedUserId" 
      :is-open="isDrawerOpen" 
      @close="isDrawerOpen = false" 
      @user-updated="fetchUsers" 
    />
  </div>
</template>
