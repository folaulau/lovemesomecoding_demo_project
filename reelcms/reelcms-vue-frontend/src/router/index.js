import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

import PublicLayout from "../layouts/PublicLayout.vue";
import AdminLayout from "../layouts/AdminLayout.vue";

/*
 * Two surfaces in one app, split by layout rather than by build:
 *
 *   /        public - the feed, explore, reel permalinks, creator pages
 *   /admin   the CMS, behind a JWT guard
 *
 * Every view except the feed is lazily imported. The feed is eager because it is
 * the landing route, and a lazy chunk there just adds a round trip before the
 * first pixel.
 */

const routes = [
  {
    path: "/",
    component: PublicLayout,
    children: [
      {
        path: "",
        name: "feed",
        component: () => import("../views/public/FeedView.vue"),
        meta: { title: "Feed", chrome: false },
      },
      {
        path: "explore",
        name: "explore",
        component: () => import("../views/public/ExploreView.vue"),
        meta: { title: "Explore" },
      },
      {
        path: "r/:slug",
        name: "reel",
        component: () => import("../views/public/ReelView.vue"),
        meta: { title: "Reel" },
      },
      {
        path: "u/:username",
        name: "creator",
        component: () => import("../views/public/CreatorView.vue"),
        meta: { title: "Creator" },
      },
      {
        path: "c",
        name: "collections",
        component: () => import("../views/public/CollectionsView.vue"),
        meta: { title: "Collections" },
      },
      {
        path: "c/:slug",
        name: "collection",
        component: () => import("../views/public/CollectionView.vue"),
        meta: { title: "Collection" },
      },
    ],
  },

  {
    path: "/admin/login",
    name: "admin-login",
    component: () => import("../views/admin/LoginView.vue"),
    meta: { title: "Sign in" },
  },

  {
    path: "/admin",
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "admin-dashboard",
        component: () => import("../views/admin/DashboardView.vue"),
        meta: { title: "Dashboard" },
      },
      {
        path: "reels",
        name: "admin-reels",
        component: () => import("../views/admin/ReelListView.vue"),
        meta: { title: "Reels" },
      },
      {
        path: "reels/new",
        name: "admin-reel-new",
        component: () => import("../views/admin/ReelEditView.vue"),
        meta: { title: "New reel" },
      },
      {
        path: "reels/:id",
        name: "admin-reel-edit",
        component: () => import("../views/admin/ReelEditView.vue"),
        meta: { title: "Edit reel" },
      },
      {
        path: "collections",
        name: "admin-collections",
        component: () => import("../views/admin/CollectionListView.vue"),
        meta: { title: "Collections" },
      },
      {
        path: "creators",
        name: "admin-creators",
        component: () => import("../views/admin/CreatorListView.vue"),
        // ADMIN only: a creator has no business renaming other creators.
        meta: { title: "Creators", requiresAdmin: true },
      },
    ],
  },

  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("../views/NotFoundView.vue"),
    meta: { title: "Not found" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    // The feed is its own scroll-snap container; restoring a window scroll
    // position into it would fight the snapping.
    if (to.name === "feed") return false;
    return saved ?? { top: 0 };
  },
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    // Remember where they were headed so login can bounce them back.
    return { name: "admin-login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: "admin-dashboard" };
  }

  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ReelCMS` : "ReelCMS";
});

export default router;
