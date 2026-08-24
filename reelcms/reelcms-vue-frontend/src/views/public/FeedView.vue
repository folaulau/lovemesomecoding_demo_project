<script setup>
import { nextTick, onMounted, ref } from "vue";
import { api } from "../../api";
import { useIntersectionObserver } from "../../composables/useIntersectionObserver";
import { useToastStore } from "../../stores/toast";
import ReelPlayer from "../../components/public/ReelPlayer.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";

/*
 * The vertical pager.
 *
 * Scrolling and snapping are pure CSS (see .feed-scroller in styles.css). The
 * only JavaScript here answers one question: which slide is on screen? An
 * IntersectionObserver does that far more cheaply than a scroll listener, which
 * would fire on every frame of a flick and need throttling.
 *
 * Pagination is CURSOR-based, not offset-based, and that is a deliberate
 * MongoDB point. `skip(4000)` makes the server walk and discard 4000 documents;
 * a cursor turns the same query into `{publishedAt: {$lt: <last seen>}}`, which
 * the {status, publishedAt} index answers by seeking straight to the right spot.
 * In an infinite feed the difference is the whole ballgame.
 */

const toast = useToastStore();

const reels = ref([]);
const activeIndex = ref(0);
const cursor = ref(null);
const loading = ref(true);
const loadingMore = ref(false);
const exhausted = ref(false);
const muted = ref(true);
const liked = ref(new Set());

const scroller = ref(null);
const slideEls = ref([]);

async function loadPage() {
  if (loadingMore.value || exhausted.value) return;
  loadingMore.value = true;
  try {
    const res = await api.feed({ cursor: cursor.value, limit: 4 });
    reels.value.push(...res.items);
    cursor.value = res.nextCursor;
    if (!res.nextCursor) exhausted.value = true;
    await nextTick();
    observeSlides();
  } catch (e) {
    toast.error(e.message);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

// Creating the observer, buffering targets until the DOM exists and
// disconnecting on unmount all live in the composable. What stays here is the
// only part that is about the feed: what "on screen" means for a slide.
const { observe } = useIntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      // 0.6 rather than 0.5: at exactly half, two slides can both qualify
      // mid-scroll and the active index flickers between them.
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        const idx = Number(entry.target.dataset.index);
        activeIndex.value = idx;
        // Prefetch a page before hitting the end, so the scroll never stalls.
        if (idx >= reels.value.length - 2) loadPage();
      }
    });
  },
  { root: scroller, threshold: [0.6] }
);

function observeSlides() {
  // Re-observing an element already under observation is a no-op, so appending
  // a page does not need any bookkeeping about what was observed before.
  slideEls.value.forEach((el) => observe(el));
}

onMounted(loadPage);

async function onLike(reel) {
  const nowLiked = !liked.value.has(reel.id);
  // Optimistic: the heart fills instantly and the count moves, then the request
  // goes out. A like that takes 200ms to appear feels broken.
  if (nowLiked) liked.value.add(reel.id);
  else liked.value.delete(reel.id);
  liked.value = new Set(liked.value);
  reel.stats.likes += nowLiked ? 1 : -1;
  try {
    await api.like(reel.id, nowLiked);
  } catch (e) {
    // Roll back so the UI does not keep showing a like the server rejected.
    reel.stats.likes += nowLiked ? -1 : 1;
    if (nowLiked) liked.value.delete(reel.id);
    else liked.value.add(reel.id);
    liked.value = new Set(liked.value);
    toast.error(e.message);
  }
}

function onView(reelId) {
  // Fire and forget - a failed view count is not worth interrupting playback for.
  api.recordView(reelId).catch(() => {});
}

async function onShare(reel) {
  const url = `${location.origin}/r/${reel.slug}`;
  try {
    // navigator.share exists on mobile and some desktop browsers; clipboard is
    // the fallback. Both reject when the user simply cancels, hence the catch.
    if (navigator.share) await navigator.share({ title: reel.title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
    reel.stats.shares += 1;
  } catch {
    /* user dismissed the share sheet */
  }
}

function scrollToComments(reel) {
  window.location.href = `/r/${reel.slug}#comments`;
}
</script>

<template>
  <LoadingSpinner v-if="loading" label="Loading the feed…" />

  <div v-else ref="scroller" class="feed-scroller">
    <div
      v-for="(reel, i) in reels"
      :key="reel.id"
      :ref="(el) => (slideEls[i] = el)"
      :data-index="i"
      class="feed-slide"
    >
      <ReelPlayer
        :reel="reel"
        :active="i === activeIndex"
        :muted="muted"
        :liked="liked.has(reel.id)"
        @like="onLike"
        @view="onView"
        @share="onShare"
        @comment="scrollToComments"
        @toggle-mute="muted = !muted"
      />
    </div>

    <div v-if="loadingMore" class="feed-slide">
      <LoadingSpinner label="Loading more…" />
    </div>

    <div v-else-if="exhausted" class="feed-slide flex-column text-center">
      <i class="bi bi-check2-circle fs-1 text-primary mb-2"></i>
      <h5>You are all caught up</h5>
      <p class="text-secondary mb-3">That is every published reel.</p>
      <RouterLink class="btn btn-outline-light btn-sm" :to="{ name: 'explore' }">
        Browse the archive
      </RouterLink>
    </div>

    <!-- Keyboard/scroll hint, desktop only. -->
    <div
      class="position-fixed bottom-0 start-50 translate-middle-x mb-3 d-none d-lg-block text-white-50 small"
      style="pointer-events: none"
    >
      <i class="bi bi-mouse me-1"></i>Scroll for the next reel
    </div>
  </div>
</template>
