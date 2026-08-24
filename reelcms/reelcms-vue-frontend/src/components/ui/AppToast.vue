<script setup>
import { storeToRefs } from "pinia";
import { useToastStore } from "../../stores/toast";

const toast = useToastStore();
const { items } = storeToRefs(toast);
</script>

<template>
  <!-- position-fixed + a high z-index so this floats over the feed, which is its
       own scroll container and would otherwise clip an absolutely-placed child. -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1090">
    <TransitionGroup name="toast">
      <div
        v-for="t in items"
        :key="t.id"
        class="toast show align-items-center border-0 mb-2"
        :class="`text-bg-${t.variant}`"
        role="alert"
        aria-live="polite"
      >
        <div class="d-flex">
          <div class="toast-body">{{ t.message }}</div>
          <button
            type="button"
            class="btn-close btn-close-white me-2 m-auto"
            aria-label="Dismiss"
            @click="toast.dismiss(t.id)"
          ></button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(18px);
}
</style>
