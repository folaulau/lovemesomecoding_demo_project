<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const q = ref("");

/* The feed is a full-bleed scroll-snap pager and owns the whole viewport, so it
   opts out of the normal page chrome via meta.chrome === false. Every other
   public route gets the navbar and a centred container. */
const showChrome = computed(() => route.meta.chrome !== false);

function submitSearch() {
  const term = q.value.trim();
  if (!term) return;
  router.push({ name: "explore", query: { q: term } });
}
</script>

<template>
  <div :class="showChrome ? 'min-vh-100 d-flex flex-column' : ''">
    <nav
      class="navbar navbar-expand-md border-bottom"
      :class="showChrome ? '' : 'position-absolute top-0 start-0 end-0 border-0'"
      :style="showChrome
        ? 'background: var(--reel-surface);'
        : 'z-index: 20; background: linear-gradient(to bottom, rgba(0,0,0,.66), transparent);'"
    >
      <div class="container-fluid px-3 px-lg-4">
        <RouterLink class="navbar-brand d-flex align-items-center gap-2 fw-bold" :to="{ name: 'feed' }">
          <span class="reel-brand-dot"></span>
          <span>Reel<span class="reel-gradient-text">CMS</span></span>
        </RouterLink>

        <button
          class="navbar-toggler border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#publicNav"
          aria-controls="publicNav"
          aria-label="Toggle navigation"
        >
          <i class="bi bi-list fs-4"></i>
        </button>

        <div id="publicNav" class="collapse navbar-collapse">
          <ul class="navbar-nav me-auto gap-md-1">
            <li class="nav-item">
              <RouterLink class="nav-link" :to="{ name: 'feed' }">
                <i class="bi bi-play-btn me-1"></i>Feed
              </RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" :to="{ name: 'explore' }">
                <i class="bi bi-grid-3x3-gap me-1"></i>Explore
              </RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" :to="{ name: 'collections' }">
                <i class="bi bi-collection-play me-1"></i>Collections
              </RouterLink>
            </li>
          </ul>

          <form class="d-flex me-md-3 my-2 my-md-0" role="search" @submit.prevent="submitSearch">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-transparent border-end-0">
                <i class="bi bi-search"></i>
              </span>
              <input
                v-model="q"
                class="form-control border-start-0"
                type="search"
                placeholder="Search reels…"
                aria-label="Search reels"
              />
            </div>
          </form>

          <RouterLink
            class="btn btn-sm"
            :class="auth.isAuthenticated ? 'btn-primary' : 'btn-outline-light'"
            :to="{ name: auth.isAuthenticated ? 'admin-dashboard' : 'admin-login' }"
          >
            <i class="bi bi-sliders me-1"></i>{{ auth.isAuthenticated ? "Studio" : "Sign in" }}
          </RouterLink>
        </div>
      </div>
    </nav>

    <main :class="showChrome ? 'flex-grow-1 py-4' : ''">
      <div :class="showChrome ? 'container-fluid px-3 px-lg-4' : ''">
        <RouterView />
      </div>
    </main>

    <footer v-if="showChrome" class="border-top py-3 mt-4">
      <div class="container-fluid px-3 px-lg-4 d-flex flex-wrap gap-2 justify-content-between">
        <small class="text-secondary">
          ReelCMS — a MongoDB demo for
          <a href="https://lovemesomecoding.com" class="link-secondary">lovemesomecoding.com</a>
        </small>
        <small class="text-tertiary">Vue 3 · Bootstrap 5 · Spring Boot · MongoDB</small>
      </div>
    </footer>
  </div>
</template>
