<script setup>
import { computed } from "vue";

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  totalElements: { type: Number, default: 0 },
});
const emit = defineEmits(["update:page"]);

/** A sliding window of at most 5 page numbers, so 40 pages does not produce
 *  40 buttons. Clamped at both ends so the window never runs off the edge. */
const windowed = computed(() => {
  const total = props.totalPages;
  const span = Math.min(5, total);
  let start = Math.max(1, props.page - 2);
  if (start + span - 1 > total) start = total - span + 1;
  return Array.from({ length: span }, (_, i) => start + i);
});

function go(p) {
  if (p >= 1 && p <= props.totalPages && p !== props.page) emit("update:page", p);
}
</script>

<template>
  <div
    v-if="totalPages > 1"
    class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3"
  >
    <small class="text-secondary">
      Page {{ page }} of {{ totalPages }} · {{ totalElements }} total
    </small>
    <nav aria-label="Pagination">
      <ul class="pagination pagination-sm mb-0">
        <li class="page-item" :class="{ disabled: page === 1 }">
          <button class="page-link" @click="go(page - 1)" aria-label="Previous page">
            <i class="bi bi-chevron-left"></i>
          </button>
        </li>
        <li v-for="p in windowed" :key="p" class="page-item" :class="{ active: p === page }">
          <button class="page-link" @click="go(p)">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: page === totalPages }">
          <button class="page-link" @click="go(page + 1)" aria-label="Next page">
            <i class="bi bi-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>
