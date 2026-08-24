<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { formatCount, formatDuration } from "../../utils/format";

/*
 * One reel on the 9:16 stage: video (or poster fallback), caption overlay, and
 * the right-hand action rail.
 *
 * `active` is driven by the feed's IntersectionObserver. Only the active slide
 * plays - autoplaying every <video> in a pager would have a dozen decoders
 * running at once, which stutters badly on a laptop and drains a phone.
 */

const props = defineProps({
  reel: { type: Object, required: true },
  active: { type: Boolean, default: false },
  muted: { type: Boolean, default: true },
  liked: { type: Boolean, default: false },
});

const emit = defineEmits(["like", "comment", "share", "view", "toggle-mute"]);

const videoEl = ref(null);
const progress = ref(0);
const isPlaying = ref(false);
// Counted once per reel per mount, so scrolling back and forth does not inflate it.
const viewCounted = ref(false);

const hasVideo = computed(() => Boolean(props.reel.video?.url));

watch(
  () => props.active,
  (isActive) => {
    const el = videoEl.value;
    if (!el) {
      // No <video> at all (poster-only reel): the view still counts, because the
      // user did look at it.
      if (isActive) countView();
      return;
    }
    if (isActive) {
      // play() rejects if the browser blocks autoplay. Muted autoplay is allowed
      // everywhere, which is why `muted` defaults to true - but a user who
      // unmutes and then scrolls can still hit the block, so swallow it rather
      // than letting an unhandled rejection surface.
      el.play().then(() => (isPlaying.value = true)).catch(() => (isPlaying.value = false));
      countView();
    } else {
      el.pause();
      el.currentTime = 0;
      progress.value = 0;
      isPlaying.value = false;
    }
  },
  { immediate: true }
);

function countView() {
  if (viewCounted.value) return;
  viewCounted.value = true;
  emit("view", props.reel.id);
}

function onTimeUpdate() {
  const el = videoEl.value;
  if (!el?.duration) return;
  progress.value = (el.currentTime / el.duration) * 100;
}

function togglePlay() {
  const el = videoEl.value;
  if (!el) return;
  if (el.paused) {
    el.play().then(() => (isPlaying.value = true)).catch(() => {});
  } else {
    el.pause();
    isPlaying.value = false;
  }
}

onBeforeUnmount(() => videoEl.value?.pause());
</script>

<template>
  <div class="reel-stage">
    <video
      v-if="hasVideo"
      ref="videoEl"
      :src="reel.video.url"
      :poster="reel.video.posterUrl"
      :muted="muted"
      loop
      playsinline
      preload="metadata"
      @timeupdate="onTimeUpdate"
      @click="togglePlay"
    ></video>

    <!-- Fallback for a reel with no rendered video yet. Production hits this too,
         between the poster being generated and the transcode finishing. -->
    <img v-else class="reel-poster" :src="reel.video.posterUrl" :alt="reel.title" />

    <div class="reel-overlay">
      <div class="d-flex align-items-center gap-2 mb-2">
        <RouterLink :to="{ name: 'creator', params: { username: reel.creator.username } }">
          <img class="avatar" :src="reel.creator.avatarUrl" :alt="reel.creator.displayName" width="38" height="38" />
        </RouterLink>
        <div class="lh-sm">
          <RouterLink
            class="fw-semibold text-white text-decoration-none d-block"
            :to="{ name: 'creator', params: { username: reel.creator.username } }"
          >
            {{ reel.creator.displayName }}
          </RouterLink>
          <small class="text-white-50">@{{ reel.creator.username }}</small>
        </div>
      </div>

      <RouterLink
        class="text-white text-decoration-none fw-semibold d-block mb-1"
        :to="{ name: 'reel', params: { slug: reel.slug } }"
      >
        {{ reel.title }}
      </RouterLink>
      <p class="text-white-50 small mb-2 d-none d-sm-block" style="max-width: 42ch">
        {{ reel.description }}
      </p>

      <div class="d-flex flex-wrap gap-1 mb-1">
        <RouterLink
          v-for="tag in reel.tags"
          :key="tag"
          class="tag-chip"
          :to="{ name: 'explore', query: { tag } }"
        >
          #{{ tag }}
        </RouterLink>
      </div>
    </div>

    <div class="reel-actions">
      <div>
        <button
          class="reel-action-btn"
          :class="{ 'is-active': liked }"
          :aria-pressed="liked"
          aria-label="Like"
          @click="emit('like', reel)"
        >
          <i class="bi" :class="liked ? 'bi-heart-fill' : 'bi-heart'"></i>
        </button>
        <div class="reel-action-count">{{ formatCount(reel.stats.likes) }}</div>
      </div>
      <div>
        <button class="reel-action-btn" aria-label="Comments" @click="emit('comment', reel)">
          <i class="bi bi-chat"></i>
        </button>
        <div class="reel-action-count">{{ formatCount(reel.stats.comments) }}</div>
      </div>
      <div>
        <button class="reel-action-btn" aria-label="Share" @click="emit('share', reel)">
          <i class="bi bi-send"></i>
        </button>
        <div class="reel-action-count">{{ formatCount(reel.stats.shares) }}</div>
      </div>
      <div>
        <button
          class="reel-action-btn"
          :aria-label="muted ? 'Unmute' : 'Mute'"
          @click="emit('toggle-mute')"
        >
          <i class="bi" :class="muted ? 'bi-volume-mute' : 'bi-volume-up'"></i>
        </button>
      </div>
    </div>

    <!-- Big play affordance while paused, so a click target is obvious. -->
    <button
      v-if="hasVideo && !isPlaying && active"
      class="btn position-absolute top-50 start-50 translate-middle rounded-circle d-grid"
      style="width: 66px; height: 66px; background: rgba(0, 0, 0, 0.45); place-items: center"
      aria-label="Play"
      @click="togglePlay"
    >
      <i class="bi bi-play-fill fs-2 text-white"></i>
    </button>

    <div class="position-absolute top-0 end-0 m-2">
      <span class="badge text-bg-dark bg-opacity-75 text-tabular">
        <i class="bi bi-eye me-1"></i>{{ formatCount(reel.stats.views) }}
      </span>
    </div>
    <div class="position-absolute top-0 start-0 m-2">
      <span class="badge text-bg-dark bg-opacity-75 text-tabular">
        {{ formatDuration(reel.video.durationSeconds) }}
      </span>
    </div>

    <div class="reel-progress"><div :style="{ width: `${progress}%` }"></div></div>
  </div>
</template>
