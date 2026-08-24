<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import ReelCard from "../../components/public/ReelCard.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import EmptyState from "../../components/ui/EmptyState.vue";
import { formatCount } from "../../utils/format";

const route = useRoute();
const toast = useToastStore();

const creator = ref(null);
const reels = ref([]);
const loading = ref(true);
const notFound = ref(false);

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    const res = await api.creatorByUsername(route.params.username);
    creator.value = res.creator;
    reels.value = res.reels;
  } catch (e) {
    if (e.status === 404) notFound.value = true;
    else toast.error(e.message);
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.username, load, { immediate: true });
</script>

<template>
  <LoadingSpinner v-if="loading" label="Loading creator…" />

  <EmptyState v-else-if="notFound" icon="bi-person-x" title="No such creator" />

  <template v-else>
    <div class="reel-surface p-3 p-lg-4 mb-4 d-flex flex-wrap align-items-center gap-3">
      <img class="avatar" :src="creator.avatarUrl" :alt="creator.displayName" width="86" height="86" />
      <div class="flex-grow-1" style="min-width: 220px">
        <h1 class="h4 mb-0">{{ creator.displayName }}</h1>
        <div class="text-secondary small mb-2">@{{ creator.username }}</div>
        <p class="mb-0 small" style="max-width: 62ch">{{ creator.bio }}</p>
      </div>
      <div class="d-flex gap-4 text-center">
        <div>
          <div class="fs-5 fw-bold text-tabular">{{ formatCount(creator.followerCount) }}</div>
          <small class="text-tertiary">Followers</small>
        </div>
        <div>
          <div class="fs-5 fw-bold text-tabular">{{ reels.length }}</div>
          <small class="text-tertiary">Reels</small>
        </div>
        <div>
          <div class="fs-5 fw-bold text-tabular">
            {{ formatCount(reels.reduce((s, r) => s + r.stats.views, 0)) }}
          </div>
          <small class="text-tertiary">Views</small>
        </div>
      </div>
    </div>

    <EmptyState
      v-if="!reels.length"
      icon="bi-film"
      title="Nothing published yet"
      message="This creator has no published reels."
    />

    <div v-else class="row g-3 row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xxl-6">
      <div v-for="reel in reels" :key="reel.id" class="col">
        <ReelCard :reel="reel" />
      </div>
    </div>
  </template>
</template>
