<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import ReelPlayer from "../../components/public/ReelPlayer.vue";
import CommentPanel from "../../components/public/CommentPanel.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import { formatCount, formatDate, formatDuration } from "../../utils/format";

/* A reel permalink: the player, its metadata, and the comment thread.
   Comments load in a SECOND request rather than being embedded in the reel
   response - the same split the database uses, for the same reason. */

const route = useRoute();
const toast = useToastStore();

const reel = ref(null);
const comments = ref([]);
const loading = ref(true);
const loadingComments = ref(false);
const posting = ref(false);
const liked = ref(false);
const muted = ref(true);
const notFound = ref(false);

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    reel.value = await api.reelBySlug(route.params.slug);
    loadComments();
  } catch (e) {
    if (e.status === 404) notFound.value = true;
    else toast.error(e.message);
  } finally {
    loading.value = false;
  }
}

async function loadComments() {
  loadingComments.value = true;
  try {
    comments.value = await api.commentsForReel(reel.value.id);
  } catch (e) {
    toast.error(e.message);
  } finally {
    loadingComments.value = false;
  }
}

async function postComment(body) {
  posting.value = true;
  try {
    const c = await api.addComment(reel.value.id, body);
    comments.value.unshift(c);
    reel.value.stats.comments += 1;
  } catch (e) {
    toast.error(e.message);
  } finally {
    posting.value = false;
  }
}

async function onLike() {
  liked.value = !liked.value;
  reel.value.stats.likes += liked.value ? 1 : -1;
  try {
    await api.like(reel.value.id, liked.value);
  } catch (e) {
    liked.value = !liked.value;
    reel.value.stats.likes += liked.value ? 1 : -1;
    toast.error(e.message);
  }
}

async function onShare() {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: reel.value.title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  } catch { /* dismissed */ }
}

watch(() => route.params.slug, load, { immediate: true });
</script>

<template>
  <LoadingSpinner v-if="loading" label="Loading reel…" />

  <div v-else-if="notFound" class="text-center py-5">
    <i class="bi bi-film fs-1 text-tertiary d-block mb-2"></i>
    <h5>That reel does not exist</h5>
    <p class="text-secondary small">It may have been unpublished or removed.</p>
    <RouterLink class="btn btn-sm btn-primary" :to="{ name: 'explore' }">Browse reels</RouterLink>
  </div>

  <div v-else class="row g-4 justify-content-center">
    <div class="col-auto">
      <ReelPlayer
        :reel="reel"
        :active="true"
        :muted="muted"
        :liked="liked"
        @like="onLike"
        @share="onShare"
        @toggle-mute="muted = !muted"
        @view="(id) => api.recordView(id).catch(() => {})"
      />
    </div>

    <div class="col-12 col-lg-5 col-xxl-4">
      <div class="reel-surface p-3 p-lg-4 mb-3">
        <h1 class="h5 mb-2">{{ reel.title }}</h1>

        <RouterLink
          class="d-flex align-items-center gap-2 text-decoration-none text-body mb-3"
          :to="{ name: 'creator', params: { username: reel.creator.username } }"
        >
          <img class="avatar" :src="reel.creator.avatarUrl" :alt="reel.creator.displayName" width="40" height="40" />
          <div class="lh-sm">
            <div class="fw-semibold">{{ reel.creator.displayName }}</div>
            <small class="text-secondary">@{{ reel.creator.username }}</small>
          </div>
        </RouterLink>

        <p class="text-secondary small">{{ reel.description }}</p>

        <div class="d-flex flex-wrap gap-1 mb-3">
          <RouterLink
            v-for="tag in reel.tags"
            :key="tag"
            class="tag-chip"
            :to="{ name: 'explore', query: { tag } }"
          >#{{ tag }}</RouterLink>
        </div>

        <div class="row g-2 text-center border-top pt-3">
          <div class="col">
            <div class="fw-bold text-tabular">{{ formatCount(reel.stats.views) }}</div>
            <small class="text-tertiary">Views</small>
          </div>
          <div class="col">
            <div class="fw-bold text-tabular">{{ formatCount(reel.stats.likes) }}</div>
            <small class="text-tertiary">Likes</small>
          </div>
          <div class="col">
            <div class="fw-bold text-tabular">{{ formatCount(reel.stats.comments) }}</div>
            <small class="text-tertiary">Comments</small>
          </div>
          <div class="col">
            <div class="fw-bold text-tabular">{{ formatDuration(reel.video.durationSeconds) }}</div>
            <small class="text-tertiary">Length</small>
          </div>
        </div>

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-sm flex-grow-1" :class="liked ? 'btn-primary' : 'btn-outline-light'" @click="onLike">
            <i class="bi me-1" :class="liked ? 'bi-heart-fill' : 'bi-heart'"></i>{{ liked ? "Liked" : "Like" }}
          </button>
          <button class="btn btn-sm btn-outline-light flex-grow-1" @click="onShare">
            <i class="bi bi-send me-1"></i>Share
          </button>
        </div>

        <small class="text-tertiary d-block mt-3">
          Published {{ formatDate(reel.publishedAt) }}
        </small>
      </div>

      <div id="comments" class="reel-surface p-3 p-lg-4">
        <h2 class="h6 mb-3">
          Comments <span class="text-tertiary fw-normal">({{ formatCount(reel.stats.comments) }})</span>
        </h2>
        <CommentPanel
          :comments="comments"
          :loading="loadingComments"
          :posting="posting"
          @submit="postComment"
        />
      </div>
    </div>
  </div>
</template>
