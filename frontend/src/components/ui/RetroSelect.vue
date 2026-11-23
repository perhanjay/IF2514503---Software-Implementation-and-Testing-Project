<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: 'Pilih...'
  },
  ariaLabel: {
    type: String,
    default: 'Pilih opsi'
  },
  compact: {
    type: Boolean,
    default: false
  },
  dropUp: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const rootRef = ref(null)

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue) || null
})

function toggleOpen() {
  isOpen.value = !isOpen.value
}

function selectOption(opt) {
  emit('update:modelValue', opt.value)
  isOpen.value = false
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

function handleClickOutside(e) {
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div ref="rootRef" class="relative font-sans" :class="compact ? 'min-w-[180px]' : 'w-full'">
    <button
      type="button"
      @click="toggleOpen"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
      class="w-full bg-white border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_#111111] flex items-center justify-between gap-2 text-left text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20afff]"
      :class="[
        compact ? 'rounded-[10px] px-3 py-1.5' : 'rounded-[12px] px-3.5 py-2.5',
        isOpen ? 'bg-[#fcfcfb] translate-y-[1px] shadow-[1px_1px_0_#111111]' : 'hover:-translate-y-[0.5px]'
      ]"
    >
      <span
        class="truncate"
        :class="selectedOption ? 'text-[#111111] font-bold' : 'text-[#60605e] font-medium'"
      >
        {{ selectedOption ? selectedOption.label : placeholder }}
      </span>
      <ChevronDown
        class="w-3.5 h-3.5 text-[#111111] shrink-0 transition-transform duration-150"
        :class="{ 'rotate-180': isOpen }"
        :stroke-width="2.2"
      />
    </button>

    <div
      v-if="isOpen"
      role="listbox"
      :aria-label="ariaLabel"
      :class="dropUp ? 'bottom-full mb-1.5' : 'mt-1.5'"
      class="absolute left-0 right-0 z-50 min-w-[200px] bg-white/98 backdrop-blur-xl border-2 border-[#111111] rounded-[14px] shadow-[3px_4px_0_#111111] p-1.5 max-h-56 overflow-y-auto animate-fade-in"
    >
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        role="option"
        :aria-selected="opt.value === modelValue"
        @click="selectOption(opt)"
        class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[9px] text-xs text-left transition-colors cursor-pointer"
        :class="opt.value === modelValue
          ? 'bg-[#87d7ff]/45 text-[#111111] font-bold border border-[#111111]/20'
          : 'text-[#111111] font-medium hover:bg-[#f5f3eb]'"
      >
        <span class="truncate">{{ opt.label }}</span>
        <Check v-if="opt.value === modelValue" class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>
