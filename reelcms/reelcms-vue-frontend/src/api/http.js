/*
 * The real transport: fetch against the Spring Boot API.
 *
 * Method-for-method identical to `mockApi`, because the frontend was built
 * first and this file exists to satisfy the contract the UI already assumes.
 * If a signature here drifts from the mock, the swap in api/index.js stops being
 * a one-line change - so keep them in lockstep.
 */

import { clearSession, readToken } from "./session";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8087";

export class ApiError extends Error {
  constructor(status, message, fieldErrors = []) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const token = readToken();
  const headers = {};
  // Setting Content-Type on a FormData body is actively harmful: fetch has to
  // generate the multipart boundary itself, and a hand-set header omits it.
  if (!isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    // fetch only rejects on a genuine network failure, never on a 4xx/5xx.
    // Distinguishing the two matters: "the API is down" needs a different
    // message from "you typed the wrong password".
    throw new ApiError(0, "Cannot reach the API. Is the backend running on 8087?");
  }

  // A 401 means two very different things depending on whether we sent a token.
  //
  //   token sent      -> it was rejected: the session really has expired.
  //   no token sent   -> this IS the sign-in attempt, and the credentials were
  //                      wrong. Treating it as an expiry replaces the server's
  //                      "Invalid email or password" with a nonsensical "Your
  //                      session expired" on the login form.
  if (res.status === 401 && token) {
    // notify: the auth store listens and clears its refs, which bounces the
    // router guard back to the login screen.
    clearSession({ notify: true });
    throw new ApiError(401, "Your session expired. Please sign in again.");
  }

  if (!res.ok) {
    // The backend's RestExceptionHandler returns { message, subErrors[] }.
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      payload.message ?? `Request failed (${res.status})`,
      payload.subErrors ?? []
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const httpApi = {
  /* ---- public ---- */
  feed: (params) => request(`/api/feed${qs(params)}`),
  reelBySlug: (slug) => request(`/api/reels/${encodeURIComponent(slug)}`),
  search: (params) => request(`/api/reels${qs(params)}`),
  trendingTags: () => request("/api/tags/trending"),
  commentsForReel: (reelId) => request(`/api/reels/${reelId}/comments`),
  addComment: (reelId, body) =>
    request(`/api/reels/${reelId}/comments`, { method: "POST", body: { body } }),
  like: (reelId, liked) =>
    request(`/api/reels/${reelId}/like`, { method: "POST", body: { liked } }),
  recordView: (reelId, watchSeconds = 0) =>
    request(`/api/reels/${reelId}/views`, { method: "POST", body: { watchSeconds } }),
  creatorByUsername: (username) => request(`/api/creators/${encodeURIComponent(username)}`),
  listCollections: () => request("/api/collections"),
  collectionBySlug: (slug) => request(`/api/collections/${encodeURIComponent(slug)}`),

  /* ---- auth ---- */
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),

  /* ---- admin ---- */
  adminReels: (params) => request(`/api/admin/reels${qs(params)}`),
  adminReel: (id) => request(`/api/admin/reels/${id}`),
  createReel: (payload) => request("/api/admin/reels", { method: "POST", body: payload }),
  updateReel: (id, payload) => request(`/api/admin/reels/${id}`, { method: "PUT", body: payload }),
  deleteReel: (id) => request(`/api/admin/reels/${id}`, { method: "DELETE" }),
  setReelStatus: (id, status) =>
    request(`/api/admin/reels/${id}/status`, { method: "PATCH", body: { status } }),

  adminCollections: () => request("/api/admin/collections"),
  saveCollection: (payload) =>
    payload.id
      ? request(`/api/admin/collections/${payload.id}`, { method: "PUT", body: payload })
      : request("/api/admin/collections", { method: "POST", body: payload }),
  deleteCollection: (id) => request(`/api/admin/collections/${id}`, { method: "DELETE" }),

  adminCreators: () => request("/api/admin/creators"),
  saveCreator: (payload) =>
    payload.id
      ? request(`/api/admin/creators/${payload.id}`, { method: "PUT", body: payload })
      : request("/api/admin/creators", { method: "POST", body: payload }),

  reports: () => request("/api/admin/reports"),

  uploadVideo: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/api/admin/uploads/video", { method: "POST", body: fd, isForm: true });
  },
  uploadPoster: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/api/admin/uploads/poster", { method: "POST", body: fd, isForm: true });
  },

  /**
   * Live stats, fed by a MongoDB change stream on the server side.
   *
   * EventSource cannot send an Authorization header - that is a limitation of
   * the API, not an oversight here - so the token rides as a query parameter and
   * the endpoint accepts it there. Returns an unsubscribe function, matching the
   * mock's contract.
   */
  subscribeToStats(onEvent) {
    const url = `${BASE}/api/admin/stream/stats${qs({ token: readToken() })}`;
    const es = new EventSource(url);
    es.addEventListener("stats", (e) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        /* a malformed frame should not kill the stream */
      }
    });
    // EventSource reconnects on its own; log once so a persistent failure is
    // visible in the console rather than silently doing nothing.
    es.onerror = () => console.warn("[reelcms] stats stream interrupted, retrying...");
    return () => es.close();
  },
};
