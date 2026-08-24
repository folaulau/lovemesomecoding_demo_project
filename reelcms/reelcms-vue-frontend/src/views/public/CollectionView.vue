<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import ReelCard from "../../components/public/ReelCard.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import EmptyState from "../../components/ui/EmptyState.vue";

const route = useRoute();
const toast = useToastStore();

const collection = ref(null);
const reels = ref([]);
const loading = ref(true);
const notFound = ref(false);

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    const res = await api.collectionBySlug(route.params.slug);
    collection.value = res.collection;
    reels.value = res.reels;
  } catch (e) {
    if (e.status === 404) notFound.value = true;
    else toast.error(e.message);
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.slug, load, { immediate: true });
</script>

<template>
  <LoadingSpinner v-if="loading" />
  <EmptyState v-else-if="notFound" icon="bi-collection" title="No such collection" />

  <template v-else>
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb small">
        <li class="breadcrumb-item">
          <RouterLink :to="{ name: 'collections' }">Collections</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">{{ collection.name }}</li>
      </ol>
    </nav>

    <h2 class="h4 mb-1">{{ collection.name }}</h2>
    <p class="text-secondary small mb-4">
      {{ collection.description }} · {{ reels.length }} reel(s)
    </p>

    <EmptyState
      v-if="!reels.length"
      icon="bi-film"
      title="Nothing in here yet"
      message="No published reels have been added to this collection."
    />

    <div v-else class="row g-3 row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xxl-6">
      <div v-for="reel in reels" :key="reel.id" class="col">
        <ReelCard :reel="reel" />
      </div>
    </div>
  </template>
</template>
