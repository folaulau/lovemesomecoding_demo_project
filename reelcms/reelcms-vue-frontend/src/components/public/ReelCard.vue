<script setup>
import { formatCount, formatDuration, timeAgo } from "../../utils/format";

defineProps({ reel: { type: Object, required: true } });
</script>

<template>
  <RouterLink
    class="reel-card d-block text-decoration-none text-body h-100"
    :to="{ name: 'reel', params: { slug: reel.slug } }"
  >
    <div class="position-relative" style="aspect-ratio: 9 / 14; overflow: hidden">
      <!-- loading="lazy" matters here: Explore renders a grid of these and every
           poster is a full-size image. -->
      <img
        :src="reel.video.posterUrl"
        :alt="reel.title"
        loading="lazy"
        class="w-100 h-100"
        style="object-fit: cover"
      />
      <span class="badge text-bg-dark bg-opacity-75 position-absolute bottom-0 end-0 m-2 text-tabular">
        {{ formatDuration(reel.video.durationSeconds) }}
      </span>
      <span class="badge text-bg-dark bg-opacity-75 position-absolute top-0 start-0 m-2 text-tabular">
        <i class="bi bi-play-fill me-1"></i>{{ formatCount(reel.stats.views) }}
      </span>
    </div>

    <div class="p-2 p-md-3">
      <div class="fw-semibold small lh-sm mb-1 text-truncate-2">{{ reel.title }}</div>
      <div class="d-flex align-items-center gap-2">
        <img class="avatar" :src="reel.creator.avatarUrl" :alt="reel.creator.displayName" width="20" height="20" />
        <small class="text-secondary text-truncate">{{ reel.creator.displayName }}</small>
      </div>
      <div class="d-flex align-items-center gap-3 mt-2 text-tertiary" style="font-size: 0.74rem">
        <span class="text-tabular"><i class="bi bi-heart me-1"></i>{{ formatCount(reel.stats.likes) }}</span>
        <span class="text-tabular"><i class="bi bi-chat me-1"></i>{{ formatCount(reel.stats.comments) }}</span>
        <span class="ms-auto">{{ timeAgo(reel.publishedAt) }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
/* Two-line clamp so a long title never changes the card height and breaks the
   grid alignment. */
.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.4em;
}
</style>
