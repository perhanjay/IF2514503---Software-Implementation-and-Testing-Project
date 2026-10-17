<script setup>
defineProps({
  label: {
    type: String,
    required: true
  },
  pulse: {
    type: Boolean,
    default: true
  }
})
</script>

<template>
  <div class="inline-flex items-center gap-2.5 rounded-full border border-[#0052FF]/25 bg-[#0052FF]/5 px-4 py-1.5 backdrop-blur-sm">
    <span 
      v-if="pulse" 
      class="h-2 w-2 rounded-full bg-[#0052FF] animate-pulse-dot" 
    />
    <span 
      v-else 
      class="h-2 w-2 rounded-full bg-[#0052FF]" 
    />
    <span class="font-mono-accent text-xs font-semibold uppercase tracking-[0.15em] text-[#0052FF]">
      {{ label }}
    </span>
  </div>
</template>
