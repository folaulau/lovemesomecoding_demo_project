<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import ReelCard from "../../components/public/ReelCard.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import EmptyState from "../../components/ui/EmptyState.vue";
import PaginationBar from "../../components/ui/PaginationBar.vue";

/*
 * Search + tag browse, backed by a MongoDB text index on title/description/tags.
 *
 * The query lives in the URL rather than in component state, which is what makes
 * a search result shareable and the back button behave. The watcher below is the
 * single source of truth: everything that changes a filter pushes a route, and
 * the route change triggers the fetch.
 */

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const results = ref({ content: [], page: 1, totalPages: 1, totalElements: 0 });
const tags = ref([]);
const loading = ref(true);
const term = ref(route.query.q ?? "");

async function load() {
  loading.value = true;
  try {
    results.value = await api.search({
      q: route.query.q ?? "",
      tag: route.query.tag ?? null,
      page: Number(route.query.page ?? 1),
      size: 12,
    });
  } catch (e) {
    toast.error(e.message);
  } finally {
    loading.value = false;
  }
}

api.trendingTags().then((t) => (tags.value = t)).catch(() => {});

watch(
  () => route.query,
  () => {
    term.value = route.query.q ?? "";
    load();
  },
  { immediate: true, deep: true }
);

/** Merge one filter into the URL, always resetting to page 1 - staying on page 4
 *  while changing the search term shows an empty page and looks like a bug. */
function setFilter(patch) {
  const query = { ...route.query, ...patch, page: undefined };
  Object.keys(query).forEach((k) => (query[k] === null || query[k] === "") && delete query[k]);
  router.push({ name: "explore", query });
}

function setPage(page) {
  router.push({ name: "explore", query: { ...route.query, page } });
}
</script>

<template>
  <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
    <div>
      <h2 class="h4 mb-1">Explore</h2>
      <p class="text-secondary small mb-0">
        Full-text search across titles, descriptions and tags.
      </p>
    </div>

    <form class="d-flex gap-2" style="max-width: 420px; flex: 1 1 280px" @submit.prevent="setFilter({ q: term })">
      <div class="input-group input-group-sm">
        <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search"></i></span>
        <input
          v-model="term"
          class="form-control border-start-0"
          type="search"
          placeholder="Try “buzzer” or “overtake”…"
          aria-label="Search reels"
        />
      </div>
      <button class="btn btn-sm btn-primary flex-shrink-0">Search</button>
    </form>
  </div>

  <div class="d-flex flex-wrap gap-2 mb-4">
    <button
      class="tag-chip border-0"
      :class="{ 'text-bg-primary': !route.query.tag }"
      @click="setFilter({ tag: null })"
    >
      All
    </button>
    <button
      v-for="tag in tags"
      :key="tag"
      class="tag-chip border-0"
      :class="{ 'text-bg-primary': route.query.tag === tag }"
      @click="setFilter({ tag })"
    >
      #{{ tag }}
    </button>
  </div>

  <div v-if="route.query.q || route.query.tag" class="mb-3 small text-secondary">
    <template v-if="route.query.q">Results for “<strong>{{ route.query.q }}</strong>”</template>
    <template v-if="route.query.tag">Tagged <strong>#{{ route.query.tag }}</strong></template>
    · {{ results.totalElements }} reel(s)
    <button class="btn btn-link btn-sm p-0 ms-2" @click="router.push({ name: 'explore' })">Clear</button>
  </div>

  <LoadingSpinner v-if="loading" label="Searching…" />

  <EmptyState
    v-else-if="!results.content.length"
    icon="bi-search"
    title="Nothing matched"
    message="Try a broader term, or clear the filters."
  >
    <button class="btn btn-sm btn-outline-light" @click="router.push({ name: 'explore' })">
      Clear filters
    </button>
  </EmptyState>

  <template v-else>
    <div class="row g-3 row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xxl-6">
      <div v-for="reel in results.content" :key="reel.id" class="col">
        <ReelCard :reel="reel" />
      </div>
    </div>
    <PaginationBar
      :page="results.page"
      :total-pages="results.totalPages"
      :total-elements="results.totalElements"
      @update:page="setPage"
    />
  </template>
</template>
