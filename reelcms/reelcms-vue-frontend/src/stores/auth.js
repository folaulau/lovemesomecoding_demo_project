import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api } from "../api";
import { SESSION_EXPIRED, clearSession, readToken, readUser, writeSession } from "../api/session";

export const useAuthStore = defineStore("auth", () => {
  // Seeded from storage so a refresh does not sign you out. The token is the
  // only thing the server trusts; the cached user is purely so the sidebar can
  // render a name before any request completes.
  const token = ref(readToken());
  const user = ref(readUser());
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => Boolean(token.value));
  const roles = computed(() => user.value?.roles ?? []);
  const isAdmin = computed(() => roles.value.includes("ADMIN"));
  const isCreator = computed(() => roles.value.includes("CREATOR"));

  /** A CREATOR may only touch their own reels; an ADMIN may touch anything.
   *  The server enforces this too - this is only so the UI does not offer
   *  buttons that are going to come back 403. */
  function canEdit(reel) {
    if (isAdmin.value) return true;
    if (!isCreator.value) return false;
    return reel?.creator?.id === user.value?.creatorId;
  }

  async function login(email, password) {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.login(email, password);
      token.value = res.token;
      user.value = res.user;
      writeSession(res.token, res.user);
      return res.user;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    clearSession();
  }

  // The HTTP client clears storage on a 401 but cannot touch these refs without
  // importing this store, which would be a cycle. It fires an event instead.
  window.addEventListener(SESSION_EXPIRED, () => {
    token.value = null;
    user.value = null;
  });

  return {
    token, user, loading, error,
    isAuthenticated, roles, isAdmin, isCreator,
    canEdit, login, logout,
  };
});
