<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div class="inline-flex items-center rounded-none bg-[#f1f0eb] border border-[#c1c0bc] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-black">
    <span>{{ label }}</span>
  </div>
</template>
