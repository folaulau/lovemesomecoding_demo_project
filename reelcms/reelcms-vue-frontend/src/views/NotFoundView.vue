<script setup></script>

<template>
  <div class="min-vh-100 d-flex flex-column align-items-center justify-content-center text-center p-4">
    <span class="reel-brand-dot mb-3" style="width: 2.4rem; height: 2.4rem"></span>
    <h1 class="display-6 fw-bold reel-gradient-text">404</h1>
    <p class="text-secondary mb-4">That page does not exist.</p>
    <RouterLink class="btn btn-primary" :to="{ name: 'feed' }">
      <i class="bi bi-play-btn me-1"></i>Back to the feed
    </RouterLink>
  </div>
</template>
