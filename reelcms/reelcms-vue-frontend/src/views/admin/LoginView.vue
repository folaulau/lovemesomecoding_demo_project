<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref("admin@reelcms.test");
const password = ref("admin123");

async function submit() {
  try {
    await auth.login(email.value, password.value);
    // Honour ?redirect= so a deep link into the admin survives the login hop.
    router.push(route.query.redirect ?? { name: "admin-dashboard" });
  } catch {
    /* auth.error is rendered below */
  }
}

function fill(as) {
  email.value = as === "admin" ? "admin@reelcms.test" : "creator@reelcms.test";
  password.value = as === "admin" ? "admin123" : "creator123";
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center p-3">
    <div class="reel-surface p-4 p-lg-5" style="width: 100%; max-width: 400px">
      <div class="d-flex align-items-center gap-2 mb-1 fw-bold fs-5">
        <span class="reel-brand-dot"></span>
        <span>Reel<span class="reel-gradient-text">CMS</span></span>
      </div>
      <p class="text-secondary small mb-4">Sign in to the studio.</p>

      <form @submit.prevent="submit">
        <div class="mb-3">
          <label class="form-label" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-control"
            autocomplete="username"
            required
          />
        </div>

        <div class="mb-3">
          <label class="form-label" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control"
            autocomplete="current-password"
            required
          />
        </div>

        <div v-if="auth.error" class="alert alert-danger py-2 small">{{ auth.error }}</div>

        <button class="btn btn-primary w-100" :disabled="auth.loading">
          <span v-if="auth.loading" class="spinner-border spinner-border-sm me-1"></span>
          Sign in
        </button>
      </form>

      <hr class="my-4" />

      <p class="text-tertiary small mb-2">Demo accounts:</p>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-secondary flex-grow-1" @click="fill('admin')">
          Admin
        </button>
        <button class="btn btn-sm btn-outline-secondary flex-grow-1" @click="fill('creator')">
          Creator
        </button>
      </div>

      <RouterLink class="d-block text-center small mt-4 link-secondary" :to="{ name: 'feed' }">
        ← Back to the site
      </RouterLink>
    </div>
  </div>
</template>
