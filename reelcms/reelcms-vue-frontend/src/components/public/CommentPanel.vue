<script setup>
import { ref } from "vue";
import { timeAgo, formatCount } from "../../utils/format";
import LoadingSpinner from "../ui/LoadingSpinner.vue";
import EmptyState from "../ui/EmptyState.vue";

defineProps({
  comments: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  posting: { type: Boolean, default: false },
});
const emit = defineEmits(["submit"]);

const draft = ref("");

function submit() {
  const body = draft.value.trim();
  if (!body) return;
  emit("submit", body);
  draft.value = "";
}
</script>

<template>
  <div>
    <form class="d-flex gap-2 mb-3" @submit.prevent="submit">
      <input
        v-model="draft"
        class="form-control form-control-sm"
        placeholder="Add a comment…"
        maxlength="500"
        aria-label="Add a comment"
      />
      <button class="btn btn-sm btn-primary" :disabled="posting || !draft.trim()">
        <span v-if="posting" class="spinner-border spinner-border-sm"></span>
        <i v-else class="bi bi-send"></i>
      </button>
    </form>

    <LoadingSpinner v-if="loading" compact label="Loading comments…" />

    <EmptyState
      v-else-if="!comments.length"
      icon="bi-chat-square-text"
      title="No comments yet"
      message="Be the first to say something."
    />

    <ul v-else class="list-unstyled d-flex flex-column gap-3 mb-0">
      <li v-for="c in comments" :key="c.id" class="d-flex gap-2">
        <img class="avatar flex-shrink-0" :src="c.author.avatarUrl" :alt="c.author.displayName" width="32" height="32" />
        <div class="small">
          <div class="d-flex align-items-baseline gap-2 flex-wrap">
            <span class="fw-semibold">{{ c.author.displayName }}</span>
            <span class="text-tertiary" style="font-size: 0.74rem">{{ timeAgo(c.createdAt) }}</span>
          </div>
          <p class="mb-1">{{ c.body }}</p>
          <span class="text-tertiary" style="font-size: 0.74rem">
            <i class="bi bi-heart me-1"></i>{{ formatCount(c.likes) }}
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>
