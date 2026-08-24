<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { usingMock } from "../api";

const auth = useAuthStore();
const router = useRouter();
const sidebarOpen = ref(false);

/*
 * `exact` on Dashboard is load-bearing. Its route is the empty-path child of
 * /admin, and Vue Router treats a link to an index child as active whenever ANY
 * sibling is - so on /admin/reels both "Dashboard" and "Reels" light up. Giving
 * that one entry an inert activeClass leaves only exactActiveClass to style it.
 */
const NAV = [
  { to: { name: "admin-dashboard" }, icon: "bi-speedometer2", label: "Dashboard", exact: true },
  { to: { name: "admin-reels" }, icon: "bi-film", label: "Reels" },
  { to: { name: "admin-collections" }, icon: "bi-collection", label: "Collections" },
  { to: { name: "admin-creators" }, icon: "bi-people", label: "Creators", adminOnly: true },
];

function signOut() {
  auth.logout();
  router.push({ name: "admin-login" });
}
</script>

<template>
  <div class="d-flex">
    <!-- Sidebar. Off-canvas below md via a translate, rather than Bootstrap's
         Offcanvas component: this needs to stay in the flow on desktop, and
         Offcanvas is always overlaid. -->
    <aside class="admin-sidebar d-flex flex-column p-3" :class="{ 'is-open': sidebarOpen }">
      <RouterLink
        class="navbar-brand d-flex align-items-center gap-2 fw-bold mb-4 text-decoration-none"
        :to="{ name: 'admin-dashboard' }"
      >
        <span class="reel-brand-dot"></span>
        <span>Reel<span class="reel-gradient-text">CMS</span></span>
      </RouterLink>

      <nav class="d-flex flex-column gap-1 flex-grow-1">
        <template v-for="item in NAV" :key="item.label">
          <RouterLink
            v-if="!item.adminOnly || auth.isAdmin"
            class="admin-nav-link"
            :to="item.to"
            :active-class="item.exact ? 'is-ancestor' : 'is-current'"
            exact-active-class="is-current"
            @click="sidebarOpen = false"
          >
            <i class="bi" :class="item.icon"></i>{{ item.label }}
          </RouterLink>
        </template>

        <hr class="my-3" />

        <RouterLink class="admin-nav-link" :to="{ name: 'feed' }">
          <i class="bi bi-box-arrow-up-right"></i>View the site
        </RouterLink>
      </nav>

      <div class="mt-auto pt-3 border-top">
        <div class="d-flex align-items-center gap-2 mb-2">
          <div
            class="avatar d-grid place-items-center fw-semibold"
            style="width: 34px; height: 34px; background: var(--reel-accent-grad); display: grid; place-items: center"
          >
            {{ (auth.user?.displayName ?? "?").charAt(0) }}
          </div>
          <div class="small lh-sm overflow-hidden">
            <div class="fw-semibold text-truncate">{{ auth.user?.displayName }}</div>
            <div class="text-tertiary text-truncate" style="font-size: 0.72rem">
              {{ auth.roles.join(", ") }}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline-secondary w-100" @click="signOut">
          <i class="bi bi-box-arrow-left me-1"></i>Sign out
        </button>
      </div>
    </aside>

    <!-- Backdrop for the mobile sidebar. -->
    <div
      v-if="sidebarOpen"
      class="position-fixed top-0 start-0 w-100 h-100 d-md-none"
      style="background: rgba(0, 0, 0, 0.5); z-index: 1035"
      @click="sidebarOpen = false"
    ></div>

    <div class="flex-grow-1 min-vh-100 d-flex flex-column" style="min-width: 0">
      <header
        class="d-flex align-items-center gap-2 px-3 px-lg-4 py-2 border-bottom"
        style="background: var(--reel-surface)"
      >
        <button
          class="btn btn-sm btn-outline-secondary d-md-none"
          aria-label="Toggle menu"
          @click="sidebarOpen = !sidebarOpen"
        >
          <i class="bi bi-list"></i>
        </button>
        <h1 class="h6 mb-0 flex-grow-1">{{ $route.meta.title }}</h1>

        <!-- A standing reminder of which data source is live. Getting this wrong
             is the single most confusing state to debug in Phase 4. -->
        <span
          class="badge"
          :class="usingMock ? 'text-bg-warning' : 'text-bg-success'"
          :title="usingMock ? 'Serving src/api/mock.js' : 'Serving the Spring Boot API'"
        >
          <i class="bi" :class="usingMock ? 'bi-cone-striped' : 'bi-database-check'"></i>
          {{ usingMock ? "Mock data" : "Live API" }}
        </span>
      </header>

      <main class="flex-grow-1 p-3 p-lg-4">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 767.98px) {
  .admin-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 1040;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .admin-sidebar.is-open {
    transform: translateX(0);
  }
}
</style>
