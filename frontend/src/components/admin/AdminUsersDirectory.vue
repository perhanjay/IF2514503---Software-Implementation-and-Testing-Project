<script setup>
import { AlertTriangle, Ban, CheckCircle2, ChevronLeft, ChevronRight, RotateCw, SearchX, Shield } from 'lucide-vue-next'
import { formatDateId, formatNumberId, getRoleBadgeMeta, getStatusBadgeMeta } from '../../utils/adminFormatters'

defineProps({
  users: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  pagination: { type: Object, default: () => ({ page: 1, limit: 20, total: 0, totalPages: 1 }) },
  currentPage: { type: Number, default: 1 },
  hasActiveFilters: { type: Boolean, default: false }
})

const emit = defineEmits(['manage-user', 'page-change', 'retry', 'clear-filters'])
const PILL_CLS = 'inline-flex items-center gap-1 rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 text-[10px] font-bold leading-none'
</script>

<template>
  <section aria-label="Direktori Pengguna" class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] overflow-hidden">
    <div v-if="loading && users.length === 0" aria-busy="true" aria-live="polite" class="p-5 space-y-3">
      <div v-for="n in 5" :key="n" class="h-14 rounded-[12px] border border-[#111111]/10 bg-[#f5f3eb] animate-pulse"></div>
    </div>

    <div v-else-if="error && users.length === 0" role="alert" class="px-6 py-12 text-center space-y-3">
      <div class="w-11 h-11 mx-auto rounded-[12px] border-[1.5px] border-[#111111] bg-[#ffcae6] shadow-[1.5px_2px_0_#111111] flex items-center justify-center">
        <AlertTriangle class="w-5 h-5 text-[#111111]" :stroke-width="2.2" />
      </div>
      <p class="text-sm font-bold text-[#111111]">{{ error }}</p>
      <button type="button" @click="emit('retry')" class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs">
        <RotateCw class="w-3.5 h-3.5" :stroke-width="2.2" />
        <span>Coba Lagi</span>
      </button>
    </div>

    <div v-else-if="users.length === 0" class="px-6 py-12 text-center space-y-3">
      <div class="w-11 h-11 mx-auto rounded-[12px] border-[1.5px] border-[#111111] bg-[#fff099] shadow-[1.5px_2px_0_#111111] flex items-center justify-center">
        <SearchX class="w-5 h-5 text-[#111111]" :stroke-width="2.2" />
      </div>
      <p class="text-sm font-bold text-[#111111]">Tidak ada pengguna ditemukan</p>
      <button v-if="hasActiveFilters" type="button" @click="emit('clear-filters')" class="btn-keycap btn-keycap-sm btn-keycap-yellow px-4 py-2 text-xs">
        <span>Reset Filter</span>
      </button>
    </div>

    <template v-else>
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[#f5f3eb] border-b-2 border-[#111111]/15 text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
              <th class="py-3.5 px-4">Pengguna</th>
              <th class="py-3.5 px-4">Peran</th>
              <th class="py-3.5 px-4">Status</th>
              <th class="py-3.5 px-4">Kuota</th>
              <th class="py-3.5 px-4">Bergabung</th>
              <th class="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#111111]/10 text-xs">
            <tr v-for="user in users" :key="user.id" class="hover:bg-[#f5f3eb]/60 transition-colors">
              <td class="py-3.5 px-4">
                <div class="font-bold text-sm text-[#111111] leading-snug">{{ user.name }}</div>
                <div class="text-xs font-medium text-[#60605e] mt-0.5">{{ user.email }}</div>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span :class="[PILL_CLS, getRoleBadgeMeta(user.role).badgeClass]">
                  <Shield class="w-3 h-3 shrink-0" :stroke-width="2.2" />
                  <span>{{ getRoleBadgeMeta(user.role).label }}</span>
                </span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span :class="[PILL_CLS, getStatusBadgeMeta(user.status).badgeClass]">
                  <CheckCircle2 v-if="user.status === 'ACTIVE'" class="w-3 h-3 shrink-0" :stroke-width="2.2" />
                  <Ban v-else class="w-3 h-3 shrink-0" :stroke-width="2.2" />
                  <span>{{ getStatusBadgeMeta(user.status).label }}</span>
                </span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="font-bold text-sm text-[#111111] tabular-nums">{{ formatNumberId(user.wallet?.balance ?? 0) }}</span>
                <span class="text-xs font-medium text-[#60605e] ml-1">Token</span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-[#60605e] tabular-nums">
                {{ formatDateId(user.createdAt) }}
              </td>
              <td class="py-3.5 px-4 text-right whitespace-nowrap">
                <button type="button" @click="emit('manage-user', user.id)" class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs">
                  Kelola
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="md:hidden divide-y divide-[#111111]/10">
        <div v-for="user in users" :key="user.id" class="p-4 space-y-2.5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold text-sm text-[#111111] truncate">{{ user.name }}</div>
              <div class="text-xs font-medium text-[#60605e] truncate">{{ user.email }}</div>
            </div>
            <button type="button" @click="emit('manage-user', user.id)" class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs shrink-0">
              Kelola
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <span :class="[PILL_CLS, getRoleBadgeMeta(user.role).badgeClass]">
              <Shield class="w-3 h-3 shrink-0" :stroke-width="2.2" />
              <span>{{ getRoleBadgeMeta(user.role).label }}</span>
            </span>
            <span :class="[PILL_CLS, getStatusBadgeMeta(user.status).badgeClass]">
              <CheckCircle2 v-if="user.status === 'ACTIVE'" class="w-3 h-3 shrink-0" :stroke-width="2.2" />
              <Ban v-else class="w-3 h-3 shrink-0" :stroke-width="2.2" />
              <span>{{ getStatusBadgeMeta(user.status).label }}</span>
            </span>
          </div>
          <div class="flex items-center justify-between text-xs text-[#60605e] pt-0.5">
            <span>Kuota: <strong class="text-[#111111] tabular-nums">{{ formatNumberId(user.wallet?.balance ?? 0) }} Token</strong></span>
            <span class="tabular-nums">{{ formatDateId(user.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-[#f5f3eb] border-t-2 border-[#111111]/15 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div class="font-medium text-[#60605e]">
          Menampilkan <strong class="text-[#111111] tabular-nums">{{ formatNumberId(users.length) }}</strong> dari
          <strong class="text-[#111111] tabular-nums">{{ formatNumberId(pagination.total) }}</strong> pengguna
        </div>
        <div class="flex items-center gap-3">
          <span class="font-medium text-[#60605e] tabular-nums">
            Halaman <strong class="text-[#111111]">{{ formatNumberId(pagination.page || 1) }}</strong> dari <strong class="text-[#111111]">{{ formatNumberId(pagination.totalPages || 1) }}</strong>
          </span>
          <div class="flex items-center gap-2">
            <button type="button" @click="emit('page-change', currentPage - 1)" :disabled="currentPage <= 1 || loading" class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs">
              <ChevronLeft class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>Sebelumnya</span>
            </button>
            <button type="button" @click="emit('page-change', currentPage + 1)" :disabled="currentPage >= (pagination.totalPages || 1) || loading" class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs">
              <span>Berikutnya</span>
              <ChevronRight class="w-3.5 h-3.5" :stroke-width="2.2" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
