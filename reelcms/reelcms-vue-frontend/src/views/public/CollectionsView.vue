<script setup>
import { ref } from "vue";
import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import EmptyState from "../../components/ui/EmptyState.vue";

const toast = useToastStore();
const collections = ref([]);
const loading = ref(true);

api
  .listCollections()
  .then((c) => (collections.value = c))
  .catch((e) => toast.error(e.message))
  .finally(() => (loading.value = false));
</script>

<template>
  <h2 class="h4 mb-1">Collections</h2>
  <p class="text-secondary small mb-4">Curated highlight sets.</p>

  <LoadingSpinner v-if="loading" />
  <EmptyState v-else-if="!collections.length" icon="bi-collection" title="No collections yet" />

  <div v-else class="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-4">
    <div v-for="c in collections" :key="c.id" class="col">
      <RouterLink
        class="reel-card d-block text-decoration-none text-body h-100"
        :to="{ name: 'collection', params: { slug: c.slug } }"
      >
        <div style="aspect-ratio: 16 / 10; overflow: hidden">
          <img :src="c.coverUrl" :alt="c.name" loading="lazy" class="w-100 h-100" style="object-fit: cover" />
        </div>
        <div class="p-3">
          <div class="fw-semibold">{{ c.name }}</div>
          <p class="text-secondary small mb-2">{{ c.description }}</p>
          <small class="text-tertiary">
            <i class="bi bi-film me-1"></i>{{ c.reelIds.length }} reel(s)
          </small>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
