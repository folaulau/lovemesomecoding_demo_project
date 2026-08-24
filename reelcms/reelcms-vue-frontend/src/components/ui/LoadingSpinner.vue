<script setup>
defineProps({
  label: { type: String, default: "Loading…" },
  compact: { type: Boolean, default: false },
});
</script>

<template>
  <div class="text-center text-secondary" :class="compact ? 'py-3' : 'py-5'">
    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
    <div class="small mt-2">{{ label }}</div>
  </div>
</template>
