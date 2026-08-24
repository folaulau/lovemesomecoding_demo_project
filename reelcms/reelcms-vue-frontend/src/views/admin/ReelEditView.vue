<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../../api";
import { useAuthStore } from "../../stores/auth";
import { useToastStore } from "../../stores/toast";
import MediaUpload from "../../components/admin/MediaUpload.vue";
import TagInput from "../../components/admin/TagInput.vue";
import StatusBadge from "../../components/ui/StatusBadge.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import { formatNumber, slugify } from "../../utils/format";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const isNew = computed(() => route.name === "admin-reel-new");

const form = ref({
  title: "",
  slug: "",
  description: "",
  status: "DRAFT",
  scheduledFor: null,
  creatorId: "",
  tags: [],
  collectionIds: [],
  video: { url: null, posterUrl: null, durationSeconds: 0, width: 0, height: 0, sizeBytes: 0 },
});

const original = ref(null);
const creators = ref([]);
const collections = ref([]);
const loading = ref(!isNew.value);
const saving = ref(false);
const errors = ref({});
// True once the user edits the slug by hand, after which the title stops
// driving it - otherwise renaming a published reel would silently change its URL.
const slugTouched = ref(false);

const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

/* Only an admin may list creators (and only an admin may reassign a reel to
   one), so a creator neither needs nor is allowed that request. Making it
   unconditionally would 403 on every visit to the editor. */
api.adminCollections()
  .then((col) => (collections.value = col))
  .catch((e) => toast.error(e.message));

if (auth.isAdmin) {
  api.adminCreators()
    .then((c) => {
      creators.value = c;
      if (isNew.value && !form.value.creatorId) {
        form.value.creatorId = auth.user?.creatorId ?? c[0]?.id ?? "";
      }
    })
    .catch((e) => toast.error(e.message));
} else {
  // A creator always publishes as themselves. The select is disabled anyway, so
  // it just needs the one option to display.
  form.value.creatorId = auth.user?.creatorId ?? "";
  creators.value = [{ id: auth.user?.creatorId, displayName: auth.user?.displayName ?? "You" }];
}

async function load() {
  if (isNew.value) return;
  loading.value = true;
  try {
    const reel = await api.adminReel(route.params.id);
    original.value = reel;
    slugTouched.value = true;
    form.value = {
      title: reel.title,
      slug: reel.slug,
      description: reel.description,
      status: reel.status,
      scheduledFor: reel.scheduledFor ? reel.scheduledFor.slice(0, 16) : null,
      creatorId: reel.creator.id,
      tags: [...reel.tags],
      collectionIds: [...reel.collectionIds],
      video: { ...reel.video },
    };
  } catch (e) {
    toast.error(e.message);
    router.push({ name: "admin-reels" });
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.id, load, { immediate: true });

watch(
  () => form.value.title,
  (title) => {
    if (!slugTouched.value) form.value.slug = slugify(title);
  }
);

function validate() {
  const e = {};
  if (!form.value.title.trim()) e.title = "A title is required.";
  else if (form.value.title.length > 140) e.title = "140 characters maximum.";
  if (!form.value.slug.trim()) e.slug = "A slug is required.";
  if (!form.value.creatorId) e.creatorId = "Pick a creator.";
  if (form.value.status === "SCHEDULED" && !form.value.scheduledFor) {
    e.scheduledFor = "A scheduled reel needs a date.";
  }
  // Publishing without a video would put a broken card in the public feed.
  if (form.value.status === "PUBLISHED" && !form.value.video.url) {
    e.video = "Upload a video before publishing.";
  }
  errors.value = e;
  return Object.keys(e).length === 0;
}

async function save() {
  if (!validate()) {
    toast.error("Fix the highlighted fields.");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...form.value,
      scheduledFor: form.value.scheduledFor ? new Date(form.value.scheduledFor).toISOString() : null,
    };
    const saved = isNew.value
      ? await api.createReel(payload)
      : await api.updateReel(route.params.id, payload);
    toast.success(isNew.value ? "Reel created." : "Changes saved.");
    if (isNew.value) router.push({ name: "admin-reel-edit", params: { id: saved.id } });
    else original.value = saved;
  } catch (e) {
    toast.error(e.message);
  } finally {
    saving.value = false;
  }
}

function toggleCollection(id) {
  const list = form.value.collectionIds;
  form.value.collectionIds = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
</script>

<template>
  <LoadingSpinner v-if="loading" />

  <form v-else @submit.prevent="save">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div class="d-flex align-items-center gap-2">
        <RouterLink class="btn btn-sm btn-outline-secondary" :to="{ name: 'admin-reels' }">
          <i class="bi bi-arrow-left"></i>
        </RouterLink>
        <h2 class="h6 mb-0">{{ isNew ? "New reel" : form.title || "Untitled" }}</h2>
        <StatusBadge v-if="!isNew" :status="form.status" />
      </div>

      <div class="d-flex gap-2">
        <RouterLink
          v-if="original?.status === 'PUBLISHED'"
          class="btn btn-sm btn-outline-light"
          :to="{ name: 'reel', params: { slug: original.slug } }"
          target="_blank"
        >
          <i class="bi bi-box-arrow-up-right me-1"></i>View
        </RouterLink>
        <button class="btn btn-sm btn-primary" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-check-lg me-1"></i>{{ isNew ? "Create" : "Save" }}
        </button>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-xl-8">
        <div class="reel-surface p-3 p-lg-4 mb-3">
          <div class="mb-3">
            <label class="form-label" for="title">Title</label>
            <input
              id="title"
              v-model="form.title"
              class="form-control"
              :class="{ 'is-invalid': errors.title }"
              maxlength="140"
              placeholder="Fadeaway over two defenders with 1.2 left"
            />
            <div class="invalid-feedback">{{ errors.title }}</div>
            <div class="form-text">{{ form.title.length }} / 140</div>
          </div>

          <div class="mb-3">
            <label class="form-label" for="slug">Slug</label>
            <div class="input-group">
              <span class="input-group-text text-tertiary">/r/</span>
              <input
                id="slug"
                v-model="form.slug"
                class="form-control"
                :class="{ 'is-invalid': errors.slug }"
                @input="slugTouched = true"
              />
              <div class="invalid-feedback">{{ errors.slug }}</div>
            </div>
            <div class="form-text">
              Follows the title until you edit it. Changing it on a published reel breaks its
              existing links.
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label" for="description">Description</label>
            <textarea
              id="description"
              v-model="form.description"
              class="form-control"
              rows="4"
              maxlength="800"
              placeholder="What makes this clip worth watching?"
            ></textarea>
            <div class="form-text">{{ form.description.length }} / 800 · indexed for search</div>
          </div>

          <div>
            <label class="form-label">Tags</label>
            <TagInput v-model="form.tags" />
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Media</label>
          <MediaUpload v-model="form.video" />
          <div v-if="errors.video" class="text-danger small mt-1">
            <i class="bi bi-exclamation-circle me-1"></i>{{ errors.video }}
          </div>
        </div>
      </div>

      <div class="col-12 col-xl-4">
        <div class="reel-surface p-3 p-lg-4 mb-3">
          <h3 class="h6 mb-3">Publishing</h3>

          <div class="mb-3">
            <label class="form-label" for="status">Status</label>
            <select id="status" v-model="form.status" class="form-select">
              <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div v-if="form.status === 'SCHEDULED'" class="mb-3">
            <label class="form-label" for="scheduledFor">Goes live at</label>
            <input
              id="scheduledFor"
              v-model="form.scheduledFor"
              type="datetime-local"
              class="form-control"
              :class="{ 'is-invalid': errors.scheduledFor }"
            />
            <div class="invalid-feedback">{{ errors.scheduledFor }}</div>
          </div>

          <div class="mb-0">
            <label class="form-label" for="creatorId">Creator</label>
            <select
              id="creatorId"
              v-model="form.creatorId"
              class="form-select"
              :class="{ 'is-invalid': errors.creatorId }"
              :disabled="!auth.isAdmin"
            >
              <option value="">Select a creator…</option>
              <option v-for="c in creators" :key="c.id" :value="c.id">{{ c.displayName }}</option>
            </select>
            <div class="invalid-feedback">{{ errors.creatorId }}</div>
            <div v-if="!auth.isAdmin" class="form-text">Creators can only publish as themselves.</div>
          </div>
        </div>

        <div class="reel-surface p-3 p-lg-4 mb-3">
          <h3 class="h6 mb-3">Collections</h3>
          <div v-for="c in collections" :key="c.id" class="form-check">
            <input
              :id="`col-${c.id}`"
              class="form-check-input"
              type="checkbox"
              :checked="form.collectionIds.includes(c.id)"
              @change="toggleCollection(c.id)"
            />
            <label class="form-check-label small" :for="`col-${c.id}`">{{ c.name }}</label>
          </div>
          <p v-if="!collections.length" class="text-tertiary small mb-0">No collections yet.</p>
        </div>

        <div v-if="original" class="reel-surface p-3 p-lg-4">
          <h3 class="h6 mb-3">Performance</h3>
          <dl class="row mb-0 small">
            <dt class="col-7 fw-normal text-tertiary">Views</dt>
            <dd class="col-5 text-end text-tabular">{{ formatNumber(original.stats.views) }}</dd>
            <dt class="col-7 fw-normal text-tertiary">Likes</dt>
            <dd class="col-5 text-end text-tabular">{{ formatNumber(original.stats.likes) }}</dd>
            <dt class="col-7 fw-normal text-tertiary">Comments</dt>
            <dd class="col-5 text-end text-tabular">{{ formatNumber(original.stats.comments) }}</dd>
            <dt class="col-7 fw-normal text-tertiary">Shares</dt>
            <dd class="col-5 text-end text-tabular mb-0">{{ formatNumber(original.stats.shares) }}</dd>
          </dl>
        </div>
      </div>
    </div>
  </form>
</template>
