<script setup>
import { ref } from "vue";
import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import EmptyState from "../../components/ui/EmptyState.vue";
import { formatDate, slugify } from "../../utils/format";

const toast = useToastStore();

const collections = ref([]);
const loading = ref(true);
const saving = ref(false);
const editing = ref(null);
const confirmDelete = ref(null);

async function load() {
  loading.value = true;
  try {
    collections.value = await api.adminCollections();
  } catch (e) {
    toast.error(e.message);
  } finally {
    loading.value = false;
  }
}
load();

function startNew() {
  editing.value = { id: null, name: "", slug: "", description: "" };
}

function startEdit(c) {
  editing.value = { id: c.id, name: c.name, slug: c.slug, description: c.description };
}

async function save() {
  if (!editing.value.name.trim()) {
    toast.error("A name is required.");
    return;
  }
  saving.value = true;
  try {
    await api.saveCollection({ ...editing.value, slug: editing.value.slug || slugify(editing.value.name) });
    toast.success(editing.value.id ? "Collection updated." : "Collection created.");
    editing.value = null;
    load();
  } catch (e) {
    toast.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function doDelete() {
  const c = confirmDelete.value;
  confirmDelete.value = null;
  try {
    await api.deleteCollection(c.id);
    toast.success(`Deleted “${c.name}”.`);
    load();
  } catch (e) {
    toast.error(e.message);
  }
}
</script>

<template>
  <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
    <p class="text-secondary small mb-0">
      Curated sets. A reel can belong to any number of them.
    </p>
    <button class="btn btn-sm btn-primary" @click="startNew">
      <i class="bi bi-plus-lg me-1"></i>New collection
    </button>
  </div>

  <LoadingSpinner v-if="loading" />

  <EmptyState v-else-if="!collections.length" icon="bi-collection" title="No collections yet">
    <button class="btn btn-sm btn-primary" @click="startNew">Create one</button>
  </EmptyState>

  <div v-else class="row g-3 row-cols-1 row-cols-md-2 row-cols-xxl-3">
    <div v-for="c in collections" :key="c.id" class="col">
      <div class="reel-surface p-3 h-100 d-flex gap-3">
        <img
          :src="c.coverUrl"
          :alt="c.name"
          loading="lazy"
          class="rounded flex-shrink-0"
          style="width: 88px; height: 66px; object-fit: cover"
        />
        <div class="flex-grow-1" style="min-width: 0">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div style="min-width: 0">
              <div class="fw-semibold text-truncate">{{ c.name }}</div>
              <small class="text-tertiary">/c/{{ c.slug }}</small>
            </div>
            <div class="btn-group btn-group-sm flex-shrink-0">
              <button class="btn btn-outline-secondary" title="Edit" @click="startEdit(c)">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" title="Delete" @click="confirmDelete = c">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <p class="small text-secondary mt-1 mb-1">{{ c.description }}</p>
          <small class="text-tertiary">
            <i class="bi bi-film me-1"></i>{{ c.reelIds.length }} reel(s) ·
            created {{ formatDate(c.createdAt) }}
          </small>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="editing"
    class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
    style="background: rgba(0, 0, 0, 0.6); z-index: 1080"
    @click.self="editing = null"
  >
    <form class="reel-surface p-4" style="width: 100%; max-width: 460px" @submit.prevent="save">
      <h2 class="h6 mb-3">{{ editing.id ? "Edit collection" : "New collection" }}</h2>

      <div class="mb-3">
        <label class="form-label" for="cname">Name</label>
        <input
          id="cname"
          v-model="editing.name"
          class="form-control"
          required
          @input="!editing.id && (editing.slug = slugify(editing.name))"
        />
      </div>

      <div class="mb-3">
        <label class="form-label" for="cslug">Slug</label>
        <div class="input-group">
          <span class="input-group-text text-tertiary">/c/</span>
          <input id="cslug" v-model="editing.slug" class="form-control" />
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="cdesc">Description</label>
        <textarea id="cdesc" v-model="editing.description" class="form-control" rows="3"></textarea>
      </div>

      <div class="d-flex gap-2 justify-content-end">
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="editing = null">
          Cancel
        </button>
        <button class="btn btn-sm btn-primary" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Save
        </button>
      </div>
    </form>
  </div>

  <div
    v-if="confirmDelete"
    class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
    style="background: rgba(0, 0, 0, 0.6); z-index: 1080"
    @click.self="confirmDelete = null"
  >
    <div class="reel-surface p-4" style="max-width: 420px" role="dialog" aria-modal="true">
      <h2 class="h6">Delete this collection?</h2>
      <p class="text-secondary small">
        “{{ confirmDelete.name }}” will be removed and its reels un-grouped. The reels themselves
        are not deleted.
      </p>
      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-sm btn-outline-secondary" @click="confirmDelete = null">Cancel</button>
        <button class="btn btn-sm btn-danger" @click="doDelete">Delete</button>
      </div>
    </div>
  </div>
</template>
