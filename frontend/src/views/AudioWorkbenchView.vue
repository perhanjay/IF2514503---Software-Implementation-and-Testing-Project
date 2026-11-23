<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { AlertTriangle, ArrowRight, X } from 'lucide-vue-next'
import AppNavbar from '../components/AppNavbar.vue'
import StemSeparatorTab from '../components/workbench/StemSeparatorTab.vue'
import SilenceTrimmerTab from '../components/workbench/SilenceTrimmerTab.vue'
import { useAuthStore } from '../stores/auth'
import { useWorkbenchStore } from '../stores/workbench'

const authStore = useAuthStore()
const workbenchStore = useWorkbenchStore()

const separatorTabRef = ref(null)
const trimmerTabRef = ref(null)
const errorBannerRef = ref(null)

watch(
  () => workbenchStore.error,
  async (newErr) => {
    if (newErr) {
      await nextTick()
      errorBannerRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }
  }
)

const folderTabs = [
  {
    id: 'separator',
    num: '01',
    label: 'AI Stem Separator',
    glassBg: 'rgba(32, 175, 255, 0.86)'
  },
  {
    id: 'trimmer',
    num: '02',
    label: 'Smart Silence Trimmer',
    glassBg: 'rgba(255, 218, 64, 0.90)'
  }
]

const activeTabMeta = computed(() => {
  return folderTabs.find((t) => t.id === workbenchStore.activeTab) || folderTabs[0]
})

function selectTab(tabId) {
  if (tabId === workbenchStore.activeTab) return
  separatorTabRef.value?.stopPlayback?.()
  trimmerTabRef.value?.stopPlayback?.()
  workbenchStore.setActiveTab(tabId)
}

function handleTabKeyDown(e, currentId) {
  const currentIdx = folderTabs.findIndex((t) => t.id === currentId)
  if (currentIdx === -1) return

  let targetIdx = null
  if (e.key === 'ArrowRight') {
    targetIdx = (currentIdx + 1) % folderTabs.length
  } else if (e.key === 'ArrowLeft') {
    targetIdx = (currentIdx - 1 + folderTabs.length) % folderTabs.length
  } else if (e.key === 'Home') {
    targetIdx = 0
  } else if (e.key === 'End') {
    targetIdx = folderTabs.length - 1
  }

  if (targetIdx === null) return
  e.preventDefault()
  const nextTab = folderTabs[targetIdx]
  selectTab(nextTab.id)
  const el = document.getElementById(`workbench-tab-${nextTab.id}`)
  if (el) el.focus()
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await authStore.fetchMe()
  }
  if (!authStore.isAuthenticated) {
    try {
      const res = await axios.post('/api/v1/auth/guest-session')
      authStore.setAuth(res.data.user, res.data.token, res.data.wallet.balance)
    } catch (err) {
      console.warn('Guest initialization failed', err)
    }
  }
  if (workbenchStore.isJobRunning && workbenchStore.job?.jobId) {
    workbenchStore.pollJob(workbenchStore.job.jobId)
  }
})

onUnmounted(() => {
  separatorTabRef.value?.stopPlayback?.()
  trimmerTabRef.value?.stopPlayback?.()
  workbenchStore.stopPolling()
})
</script>

<template>
  <div class="min-h-screen notebook-paper relative overflow-x-clip text-[#111111] flex flex-col selection:bg-[#ff82c2] selection:text-[#111111] font-sans">
    <!-- Subtle Ambient Pastel Halos -->
    <div aria-hidden="true" class="pointer-events-none fixed -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#20afff]/12 blur-[110px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed top-[32%] -right-28 w-[420px] h-[420px] rounded-full bg-[#ffda40]/14 blur-[120px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed -bottom-28 left-[18%] w-[380px] h-[380px] rounded-full bg-[#ff82c2]/10 blur-[120px]"></div>

    <AppNavbar :fluid="true" />

    <main class="relative z-10 flex-1 w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 py-7 md:py-9 space-y-6">
      <!-- Workbench Header -->
      <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div class="space-y-1.5">
          <h1 class="font-editorial font-bold text-3xl sm:text-4xl text-[#111111] tracking-[-0.03em] leading-none">
            Audio Workbench
          </h1>
          <p class="text-xs sm:text-sm text-[#60605e] max-w-2xl leading-relaxed">
            Pisahkan trek campuran menjadi 4 stem terisolasi dengan AI, pangkas hening secara presisi dengan de-clicker, lalu kirim ke Studio Workspace.
          </p>
        </div>

        <router-link
          to="/dashboard"
          class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs whitespace-nowrap shrink-0"
        >
          <span>Studio Workspace</span>
          <ArrowRight class="w-3.5 h-3.5" :stroke-width="2.2" />
        </router-link>
      </header>

      <!-- Error Alert Banner -->
      <div
        v-if="workbenchStore.error"
        ref="errorBannerRef"
        role="alert"
        aria-live="assertive"
        class="rounded-[14px] border-2 border-[#111111] bg-rose-50/95 shadow-[3px_4px_0_#111111] px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold text-rose-950 animate-fade-in"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <AlertTriangle class="w-4 h-4 text-rose-700 shrink-0" :stroke-width="2.2" />
          <span class="leading-relaxed">{{ workbenchStore.error }}</span>
        </div>
        <button
          type="button"
          @click="workbenchStore.clearError()"
          class="btn-keycap btn-keycap-mini btn-keycap-white w-7 h-7 shrink-0"
          aria-label="Tutup pesan kesalahan"
        >
          <X class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
        </button>
      </div>

      <!-- Retro Die-Cut Folder Tab Container -->
      <section class="w-full relative pt-1">
        <!-- Back Translucent Folder Layers -->
        <div aria-hidden="true" class="hidden sm:block mx-6 h-2.5 rounded-t-[10px] bg-[#ff82c2]/50 backdrop-blur-sm border-t border-x border-white/60"></div>
        <div aria-hidden="true" class="hidden sm:block mx-8 h-1 bg-white/85 backdrop-blur-xs"></div>

        <!-- Folder Tab Pills (01 AI Stem Separator · 02 Smart Silence Trimmer) -->
        <div
          role="tablist"
          aria-label="Alat Audio Workbench"
          class="relative z-30 flex items-end pl-2 sm:pl-5 overflow-x-auto no-scrollbar"
        >
          <button
            v-for="(tab, idx) in folderTabs"
            :key="tab.id"
            :id="`workbench-tab-${tab.id}`"
            type="button"
            role="tab"
            :aria-selected="workbenchStore.activeTab === tab.id"
            aria-controls="workbench-tabpanel"
            @click="selectTab(tab.id)"
            @keydown="handleTabKeyDown($event, tab.id)"
            :class="[
              idx > 0 ? '-ml-3' : '',
              workbenchStore.activeTab === tab.id ? 'z-30 h-11 opacity-100' : 'z-10 h-9 opacity-80 hover:opacity-100'
            ]"
            class="group relative min-w-[185px] sm:min-w-[240px] px-4 sm:px-5 pr-8 flex items-center justify-start gap-2.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] transition-all"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 220 44"
              preserveAspectRatio="none"
              class="absolute inset-0 w-full h-full pointer-events-none"
            >
              <path
                d="M0,44 L0,10 Q0,0 10,0 L190,0 Q198,0 203,10 L220,44 Z"
                :fill="tab.glassBg"
              />
              <path
                d="M1,43 L1,10 Q1,1 10,1 L190,1 Q197,1 202,10 L218,43"
                fill="none"
                stroke="#ffffff"
                stroke-opacity="0.65"
                stroke-width="1.2"
              />
            </svg>
            <span class="relative z-10 font-sans text-xs font-extrabold text-[#111111] tabular-nums">
              {{ tab.num }}
            </span>
            <span class="relative z-10 font-sans text-xs font-bold text-[#111111] truncate">
              {{ tab.label }}
            </span>
          </button>
        </div>

        <!-- Active Folder Sheet Body -->
        <div
          id="workbench-tabpanel"
          role="tabpanel"
          :aria-labelledby="`workbench-tab-${workbenchStore.activeTab}`"
          :style="{ backgroundColor: activeTabMeta.glassBg }"
          :class="workbenchStore.activeTab === 'separator' ? 'rounded-b-[16px] rounded-tr-[16px] rounded-tl-none sm:rounded-tl-[16px]' : 'rounded-[16px]'"
          class="relative z-20 backdrop-blur-md border-2 border-[#111111] text-[#111111] transition-colors duration-200 shadow-[3px_4px_0_#111111,inset_0_1px_0_rgba(255,255,255,0.75)] p-4 sm:p-6"
        >
          <div class="border-t border-dotted border-[#111111]/30 pt-4 sm:pt-5">
            <StemSeparatorTab
              v-show="workbenchStore.activeTab === 'separator'"
              ref="separatorTabRef"
            />
            <SilenceTrimmerTab
              v-show="workbenchStore.activeTab === 'trimmer'"
              ref="trimmerTabRef"
            />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
