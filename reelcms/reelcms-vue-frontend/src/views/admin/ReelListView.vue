<script setup>
import { ref, watch } from "vue";
import { api } from "../../api";
import { useAuthStore } from "../../stores/auth";
import { useToastStore } from "../../stores/toast";
import StatusBadge from "../../components/ui/StatusBadge.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import EmptyState from "../../components/ui/EmptyState.vue";
import PaginationBar from "../../components/ui/PaginationBar.vue";
import { formatDateTime, formatNumber, formatDuration } from "../../utils/format";

const auth = useAuthStore();
const toast = useToastStore();

const page = ref({ content: [], page: 1, totalPages: 1, totalElements: 0 });
const creators = ref([]);
const loading = ref(true);
const busyId = ref(null);
const confirmDelete = ref(null);

const filters = ref({ q: "", status: "", creatorId: "", page: 1, size: 10 });

const STATUSES = ["PUBLISHED", "DRAFT", "SCHEDULED", "ARCHIVED"];

async function load() {
  loading.value = true;
  try {
    page.value = await api.adminReels(filters.value);
  } catch (e) {
    toast.error(e.message);
  } finally {
    loading.value = false;
  }
}

/* ADMIN only. /api/admin/creators is restricted to admins, so calling it as a
   creator logs a 403 on every visit and populates an empty, useless filter.
   A creator has no need to filter by creator either - they can only edit their
   own reels - so the control is hidden for them entirely. */
if (auth.isAdmin) {
  api.adminCreators()
    .then((c) => (creators.value = c))
    .catch((e) => toast.error(e.message));
}

/* Debounced so typing in the search box does not fire a request per keystroke.
   250ms is short enough to feel instant and long enough to collapse a word. */
let debounce;
watch(
  () => filters.value.q,
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters.value.page = 1;
      load();
    }, 250);
  }
);

watch(
  () => [filters.value.status, filters.value.creatorId],
  () => {
    filters.value.page = 1;
    load();
  }
);

watch(() => filters.value.page, load);

load();

async function setStatus(reel, status) {
  busyId.value = reel.id;
  try {
    const updated = await api.setReelStatus(reel.id, status);
    Object.assign(reel, updated);
    toast.success(`“${reel.title}” is now ${status.toLowerCase()}.`);
  } catch (e) {
    toast.error(e.message);
  } finally {
    busyId.value = null;
  }
}

async function doDelete() {
  const reel = confirmDelete.value;
  confirmDelete.value = null;
  busyId.value = reel.id;
  try {
    await api.deleteReel(reel.id);
    toast.success(`Deleted “${reel.title}”.`);
    // Stepping back a page when the last row on it goes avoids landing on an
    // empty page that looks like the list broke.
    if (page.value.content.length === 1 && filters.value.page > 1) filters.value.page -= 1;
    else load();
  } catch (e) {
    toast.error(e.message);
  } finally {
    busyId.value = null;
  }
}

function resetFilters() {
  filters.value = { q: "", status: "", creatorId: "", page: 1, size: 10 };
  load();
}
</script>

<template>
  <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
    <p class="text-secondary small mb-0">
      {{ page.totalElements }} reel(s)
      <span v-if="!auth.isAdmin"> · you can only edit your own</span>
    </p>
    <RouterLink class="btn btn-sm btn-primary" :to="{ name: 'admin-reel-new' }">
      <i class="bi bi-plus-lg me-1"></i>New reel
    </RouterLink>
  </div>

  <div class="reel-surface p-3 mb-3">
    <div class="row g-2 align-items-end">
      <div class="col-12" :class="auth.isAdmin ? 'col-md-5' : 'col-md-8'">
        <label class="form-label form-label-sm mb-1" for="q">Search</label>
        <div class="input-group input-group-sm">
          <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search"></i></span>
          <input
            id="q"
            v-model="filters.q"
            class="form-control border-start-0"
            type="search"
            placeholder="Title, tag or creator…"
          />
        </div>
      </div>

      <div class="col-6 col-md-3">
        <label class="form-label form-label-sm mb-1" for="status">Status</label>
        <select id="status" v-model="filters.status" class="form-select form-select-sm">
          <option value="">All statuses</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div v-if="auth.isAdmin" class="col-6 col-md-3">
        <label class="form-label form-label-sm mb-1" for="creator">Creator</label>
        <select id="creator" v-model="filters.creatorId" class="form-select form-select-sm">
          <option value="">All creators</option>
          <option v-for="c in creators" :key="c.id" :value="c.id">{{ c.displayName }}</option>
        </select>
      </div>

      <div class="col-12 col-md-1">
        <button class="btn btn-sm btn-outline-secondary w-100" title="Reset filters" @click="resetFilters">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
      </div>
    </div>
  </div>

  <LoadingSpinner v-if="loading" />

  <EmptyState
    v-else-if="!page.content.length"
    icon="bi-film"
    title="No reels match"
    message="Adjust the filters, or create the first one."
  >
    <RouterLink class="btn btn-sm btn-primary" :to="{ name: 'admin-reel-new' }">New reel</RouterLink>
  </EmptyState>

  <template v-else>
    <div class="reel-surface p-0 overflow-hidden">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr class="text-tertiary" style="font-size: 0.76rem">
              <th scope="col"></th>
              <th scope="col">Title</th>
              <th scope="col" class="d-none d-lg-table-cell">Creator</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-end d-none d-md-table-cell">Views</th>
              <th scope="col" class="d-none d-xl-table-cell">Updated</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="reel in page.content" :key="reel.id" :class="{ 'opacity-50': busyId === reel.id }">
              <td style="width: 56px">
                <img class="admin-thumb" :src="reel.video.posterUrl" :alt="reel.title" loading="lazy" />
              </td>
              <td>
                <div class="fw-semibold small lh-sm">{{ reel.title }}</div>
                <small class="text-tertiary">
                  /{{ reel.slug }} · {{ formatDuration(reel.video.durationSeconds) }}
                  <span v-if="!reel.video.url" class="text-warning ms-1">
                    <i class="bi bi-exclamation-triangle"></i> no video
                  </span>
                </small>
              </td>
              <td class="d-none d-lg-table-cell">
                <small>{{ reel.creator.displayName }}</small>
              </td>
              <td><StatusBadge :status="reel.status" /></td>
              <td class="text-end text-tabular small d-none d-md-table-cell">
                {{ formatNumber(reel.stats.views) }}
              </td>
              <td class="d-none d-xl-table-cell">
                <small class="text-tertiary">{{ formatDateTime(reel.updatedAt) }}</small>
              </td>
              <td class="text-end">
                <div class="btn-group btn-group-sm">
                  <RouterLink
                    class="btn btn-outline-secondary"
                    :class="{ disabled: !auth.canEdit(reel) }"
                    :to="{ name: 'admin-reel-edit', params: { id: reel.id } }"
                    title="Edit"
                  >
                    <i class="bi bi-pencil"></i>
                  </RouterLink>
                  <button
                    v-if="reel.status !== 'PUBLISHED'"
                    class="btn btn-outline-success"
                    :disabled="!auth.canEdit(reel) || !reel.video.url"
                    :title="reel.video.url ? 'Publish' : 'Upload a video first'"
                    @click="setStatus(reel, 'PUBLISHED')"
                  >
                    <i class="bi bi-broadcast"></i>
                  </button>
                  <button
                    v-else
                    class="btn btn-outline-warning"
                    :disabled="!auth.canEdit(reel)"
                    title="Unpublish"
                    @click="setStatus(reel, 'DRAFT')"
                  >
                    <i class="bi bi-eye-slash"></i>
                  </button>
                  <button
                    class="btn btn-outline-danger"
                    :disabled="!auth.canEdit(reel)"
                    title="Delete"
                    @click="confirmDelete = reel"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <PaginationBar
      :page="page.page"
      :total-pages="page.totalPages"
      :total-elements="page.totalElements"
      @update:page="(p) => (filters.page = p)"
    />
  </template>

  <!-- Hand-rolled rather than Bootstrap's Modal: a native confirm() blocks the
       event loop, and the JS Modal needs imperative show/hide that fights Vue's
       rendering. A v-if'd overlay is less code and easier to test.

       VUE CONCEPT: <Teleport> moves the rendered DOM to the end of <body> while
       leaving the component tree alone -- `confirmDelete`, the click handlers
       and the scoped styles all still belong to THIS component.

       An overlay is `position: fixed`, which sounds like it is already immune to
       its ancestors. It is not. A `transform`, `filter`, `perspective`,
       `backdrop-filter` or `contain` on ANY ancestor makes that ancestor the
       containing block, and the overlay is then positioned and clipped relative
       to it instead of the viewport. Nothing in this layout does that today, and
       nothing has to: the failure arrives the day someone adds a hover
       transform to a wrapper three levels up, and it looks like a CSS bug in the
       modal rather than in the thing that actually changed.

       Teleporting to <body> means there are no ancestors to get it wrong. -->
  <Teleport to="body">
  <div
    v-if="confirmDelete"
    class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
    style="background: rgba(0, 0, 0, 0.6); z-index: 1080"
    @click.self="confirmDelete = null"
  >
    <div class="reel-surface p-4" style="max-width: 420px" role="dialog" aria-modal="true">
      <h2 class="h6">Delete this reel?</h2>
      <p class="text-secondary small">
        “{{ confirmDelete.title }}” and its comments will be removed. This cannot be undone.
      </p>
      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-sm btn-outline-secondary" @click="confirmDelete = null">Cancel</button>
        <button class="btn btn-sm btn-danger" @click="doDelete">
          <i class="bi bi-trash me-1"></i>Delete
        </button>
      </div>
    </div>
  </div>
  </Teleport>
</template>
