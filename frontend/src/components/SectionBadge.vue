<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div class="inline-flex items-center rounded-md bg-blue-50 border border-blue-200/80 px-2.5 py-1 text-xs font-medium text-[#0052FF]">
    <span>{{ label }}</span>
  </div>
</template>
