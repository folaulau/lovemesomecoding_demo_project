<script setup>
import AppToast from "./components/ui/AppToast.vue";
</script>

<template>
  <!-- Layout is chosen per route (see router/index.js meta.layout), so this
       component stays a shell: the router view plus app-wide chrome. -->
  <RouterView />
  <AppToast />
</template>
