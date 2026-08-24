<script setup>
import { computed } from "vue";
import { STATUS_META } from "../../utils/format";

const props = defineProps({ status: { type: String, required: true } });
const meta = computed(() => STATUS_META[props.status] ?? { label: props.status, variant: "secondary", icon: "bi-question" });
</script>

<template>
  <span class="badge d-inline-flex align-items-center gap-1" :class="`text-bg-${meta.variant}`">
    <i class="bi" :class="meta.icon"></i>{{ meta.label }}
  </span>
</template>
