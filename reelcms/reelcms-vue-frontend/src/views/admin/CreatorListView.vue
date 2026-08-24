<script setup>
import { ref } from "vue";
import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import { formatCount, formatNumber, slugify } from "../../utils/format";

/*
 * Creator admin — and the honest face of the denormalization trade-off.
 *
 * Every reel carries a COPY of its creator's display name and username. That is
 * what makes the feed a single query with no $lookup. The bill comes due right
 * here: renaming a creator has to fan out and rewrite that snapshot on every one
 * of their reels. The warning in the edit dialog is not decoration - it is the
 * cost, shown to the person paying it.
 */

const toast = useToastStore();

const creators = ref([]);
const loading = ref(true);
const saving = ref(false);
const editing = ref(null);

async function load() {
  loading.value = true;
  try {
    creators.value = await api.adminCreators();
  } catch (e) {
    toast.error(e.message);
  } finally {
    loading.value = false;
  }
}
load();

function startNew() {
  editing.value = { id: null, displayName: "", username: "", bio: "", reelCount: 0 };
}

function startEdit(c) {
  editing.value = {
    id: c.id,
    displayName: c.displayName,
    username: c.username,
    bio: c.bio,
    reelCount: c.reelCount,
  };
}

async function save() {
  if (!editing.value.displayName.trim() || !editing.value.username.trim()) {
    toast.error("Display name and username are both required.");
    return;
  }
  saving.value = true;
  try {
    await api.saveCreator(editing.value);
    const fanout = editing.value.id ? editing.value.reelCount : 0;
    toast.success(
      editing.value.id
        ? `Saved. The creator snapshot was rewritten on ${fanout} reel(s).`
        : "Creator created."
    );
    editing.value = null;
    load();
  } catch (e) {
    toast.error(e.message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
    <p class="text-secondary small mb-0">
      Reels carry a copy of the creator's name, so renaming one rewrites every reel it owns.
    </p>
    <button class="btn btn-sm btn-primary" @click="startNew">
      <i class="bi bi-plus-lg me-1"></i>New creator
    </button>
  </div>

  <LoadingSpinner v-if="loading" />

  <div v-else class="reel-surface p-0 overflow-hidden">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead>
          <tr class="text-tertiary" style="font-size: 0.76rem">
            <th scope="col"></th>
            <th scope="col">Creator</th>
            <th scope="col" class="d-none d-lg-table-cell">Bio</th>
            <th scope="col" class="text-end">Reels</th>
            <th scope="col" class="text-end d-none d-md-table-cell">Followers</th>
            <th scope="col" class="text-end d-none d-md-table-cell">Views</th>
            <th scope="col" class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in creators" :key="c.id">
            <td style="width: 52px">
              <img class="avatar" :src="c.avatarUrl" :alt="c.displayName" width="36" height="36" />
            </td>
            <td>
              <div class="fw-semibold small">{{ c.displayName }}</div>
              <small class="text-tertiary">@{{ c.username }}</small>
            </td>
            <td class="d-none d-lg-table-cell">
              <small class="text-secondary">{{ c.bio }}</small>
            </td>
            <td class="text-end text-tabular small">{{ c.reelCount }}</td>
            <td class="text-end text-tabular small d-none d-md-table-cell">
              {{ formatCount(c.followerCount) }}
            </td>
            <td class="text-end text-tabular small d-none d-md-table-cell">
              {{ formatNumber(c.totalViews) }}
            </td>
            <td class="text-end">
              <div class="btn-group btn-group-sm">
                <RouterLink
                  class="btn btn-outline-secondary"
                  :to="{ name: 'creator', params: { username: c.username } }"
                  target="_blank"
                  title="View profile"
                >
                  <i class="bi bi-box-arrow-up-right"></i>
                </RouterLink>
                <button class="btn btn-outline-secondary" title="Edit" @click="startEdit(c)">
                  <i class="bi bi-pencil"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div
    v-if="editing"
    class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
    style="background: rgba(0, 0, 0, 0.6); z-index: 1080"
    @click.self="editing = null"
  >
    <form class="reel-surface p-4" style="width: 100%; max-width: 460px" @submit.prevent="save">
      <h2 class="h6 mb-3">{{ editing.id ? "Edit creator" : "New creator" }}</h2>

      <div class="mb-3">
        <label class="form-label" for="dname">Display name</label>
        <input id="dname" v-model="editing.displayName" class="form-control" required />
      </div>

      <div class="mb-3">
        <label class="form-label" for="uname">Username</label>
        <div class="input-group">
          <span class="input-group-text text-tertiary">@</span>
          <input
            id="uname"
            v-model="editing.username"
            class="form-control"
            required
            @blur="editing.username = slugify(editing.username)"
          />
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="bio">Bio</label>
        <textarea id="bio" v-model="editing.bio" class="form-control" rows="3" maxlength="280"></textarea>
      </div>

      <div v-if="editing.id && editing.reelCount > 0" class="alert alert-warning py-2 small">
        <i class="bi bi-exclamation-triangle me-1"></i>
        Saving rewrites the denormalized creator snapshot on
        <strong>{{ editing.reelCount }} reel(s)</strong>. That fan-out is the price of a feed
        that renders with no <code>$lookup</code>.
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
</template>
