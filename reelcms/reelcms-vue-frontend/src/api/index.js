/*
 * The single place the app talks to a backend.
 *
 * Phase 1 points this at the in-memory mock so the UI can be built and reviewed
 * with no server running. Set VITE_USE_MOCK=false to swap in the HTTP client.
 * Nothing else in the app imports `mock.js` or `http.js` directly - that is what
 * keeps the switch a one-line change instead of a hunt through thirty components.
 *
 * Both are imported statically rather than with a dynamic import + top-level
 * await: top-level await forces the whole module graph to become async, which
 * breaks Vite's dependency pre-bundling in dev for a saving of a few KB.
 */

import { mockApi } from "./mock";
import { httpApi } from "./http";

export const usingMock = import.meta.env.VITE_USE_MOCK !== "false";
export const api = usingMock ? mockApi : httpApi;
