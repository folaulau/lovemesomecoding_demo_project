<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, default: "bi-graph-up" },
  /** Fractional change vs the previous period, e.g. 0.104 for +10.4%. */
  delta: { type: Number, default: null },
  live: { type: Boolean, default: false },
});

const deltaClass = computed(() =>
  props.delta === null ? "" : props.delta >= 0 ? "text-success" : "text-danger"
);
</script>

<template>
  <div class="stat-card h-100">
    <div class="d-flex align-items-start justify-content-between mb-2">
      <span class="stat-label">{{ label }}</span>
      <i class="bi text-primary" :class="icon"></i>
    </div>
    <!-- :key on the value re-creates the node when it changes, which restarts the
         flash animation. Without it the class is already applied and nothing
         re-triggers. -->
    <div :key="String(value)" class="stat-value" :class="{ 'is-live': live }">{{ value }}</div>
    <small v-if="delta !== null" :class="deltaClass">
      <i class="bi" :class="delta >= 0 ? 'bi-arrow-up-short' : 'bi-arrow-down-short'"></i>
      {{ Math.abs(delta * 100).toFixed(1) }}% vs previous period
    </small>
  </div>
</template>
