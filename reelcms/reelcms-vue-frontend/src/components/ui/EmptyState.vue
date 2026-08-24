<script setup>
defineProps({
  icon: { type: String, default: "bi-inbox" },
  title: { type: String, required: true },
  message: { type: String, default: "" },
});
</script>

<template>
  <div class="text-center py-5">
    <i class="bi fs-1 text-tertiary d-block mb-2" :class="icon" style="opacity: 0.5"></i>
    <h6 class="mb-1">{{ title }}</h6>
    <p v-if="message" class="text-secondary small mb-3">{{ message }}</p>
    <!-- Callers drop a primary action in here. -->
    <slot />
  </div>
</template>
