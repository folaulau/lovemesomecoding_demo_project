<script setup>
import { computed, ref } from "vue";
import { usingMock } from "../../api";
import { formatBytes, formatDuration } from "../../utils/format";

/*
 * Video + poster picker.
 *
 * Against the mock there is no server to upload to, so the file is turned into
 * an object URL and its duration read locally. That is not a shortcut for its
 * own sake: reading `videoWidth`/`videoHeight`/`duration` client-side is exactly
 * what the real flow does too, to show a preview before the upload finishes.
 *
 * Object URLs are revoked on replace. Skipping that leaks the whole decoded file
 * for the lifetime of the page, which for a 40 MB video is very noticeable.
 */

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["update:modelValue"]);

const uploading = ref(false);
const error = ref("");
const videoInput = ref(null);
const posterInput = ref(null);
let objectUrls = [];

const video = computed(() => props.modelValue ?? {});

const MAX_BYTES = 100 * 1024 * 1024; // matches the backend's multipart limit

function patch(fields) {
  emit("update:modelValue", { ...props.modelValue, ...fields });
}

function trackUrl(url) {
  objectUrls.push(url);
  return url;
}

function releaseUrls() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
}

/** Read duration + intrinsic size without decoding the whole file. */
function probe(file) {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      resolve({
        durationSeconds: Math.round(el.duration),
        width: el.videoWidth,
        height: el.videoHeight,
      });
    // A codec the browser cannot decode still uploads fine; just skip the probe.
    el.onerror = () => resolve({ durationSeconds: 0, width: 0, height: 0 });
    el.src = URL.createObjectURL(file);
  });
}

async function onVideo(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  error.value = "";

  if (!file.type.startsWith("video/")) {
    error.value = "That is not a video file.";
    return;
  }
  if (file.size > MAX_BYTES) {
    error.value = `Too large — ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}.`;
    return;
  }

  uploading.value = true;
  try {
    const meta = await probe(file);
    if (usingMock) {
      releaseUrls();
      patch({ url: trackUrl(URL.createObjectURL(file)), sizeBytes: file.size, ...meta });
    } else {
      const { api } = await import("../../api");
      const res = await api.uploadVideo(file);
      patch({ ...meta, ...res });
    }
  } catch (err) {
    error.value = err.message ?? "Upload failed.";
  } finally {
    uploading.value = false;
  }
}

async function onPoster(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  error.value = "";
  if (!file.type.startsWith("image/")) {
    error.value = "That is not an image file.";
    return;
  }
  uploading.value = true;
  try {
    if (usingMock) {
      patch({ posterUrl: trackUrl(URL.createObjectURL(file)) });
    } else {
      const { api } = await import("../../api");
      const res = await api.uploadPoster(file);
      patch({ posterUrl: res.url });
    }
  } catch (err) {
    error.value = err.message ?? "Upload failed.";
  } finally {
    uploading.value = false;
  }
}

function clearVideo() {
  releaseUrls();
  patch({ url: null, durationSeconds: 0, sizeBytes: 0 });
  if (videoInput.value) videoInput.value.value = "";
}
</script>

<template>
  <div class="reel-surface p-3">
    <div class="row g-3">
      <div class="col-12 col-sm-5">
        <div class="ratio" style="--bs-aspect-ratio: 160%">
          <video
            v-if="video.url"
            :src="video.url"
            :poster="video.posterUrl"
            controls
            playsinline
            class="rounded"
            style="object-fit: cover; background: #000"
          ></video>
          <img
            v-else-if="video.posterUrl"
            :src="video.posterUrl"
            alt="Poster preview"
            class="rounded"
            style="object-fit: cover"
          />
          <div
            v-else
            class="rounded d-flex flex-column align-items-center justify-content-center text-tertiary"
            style="background: var(--reel-surface-2); border: 1px dashed var(--bs-border-color)"
          >
            <i class="bi bi-camera-reels fs-3 mb-1"></i>
            <small>No media yet</small>
          </div>
        </div>
      </div>

      <div class="col-12 col-sm-7 d-flex flex-column gap-2">
        <div>
          <label class="form-label form-label-sm mb-1" for="videoFile">Video file</label>
          <input
            id="videoFile"
            ref="videoInput"
            type="file"
            class="form-control form-control-sm"
            accept="video/mp4,video/webm,video/quicktime"
            :disabled="uploading"
            @change="onVideo"
          />
          <div class="form-text">MP4 or WebM, up to {{ formatBytes(MAX_BYTES) }}. Portrait 9:16 looks best.</div>
        </div>

        <div>
          <label class="form-label form-label-sm mb-1" for="posterFile">Poster image</label>
          <input
            id="posterFile"
            ref="posterInput"
            type="file"
            class="form-control form-control-sm"
            accept="image/jpeg,image/png,image/webp"
            :disabled="uploading"
            @change="onPoster"
          />
        </div>

        <div v-if="uploading" class="small text-secondary">
          <span class="spinner-border spinner-border-sm me-1"></span>Processing…
        </div>

        <div v-if="error" class="alert alert-danger py-1 px-2 small mb-0">{{ error }}</div>

        <ul v-if="video.url" class="list-unstyled small text-secondary mb-0 mt-auto">
          <li><i class="bi bi-clock me-1"></i>{{ formatDuration(video.durationSeconds) }}</li>
          <li><i class="bi bi-aspect-ratio me-1"></i>{{ video.width }} × {{ video.height }}</li>
          <li><i class="bi bi-hdd me-1"></i>{{ formatBytes(video.sizeBytes) }}</li>
        </ul>

        <button
          v-if="video.url"
          type="button"
          class="btn btn-sm btn-outline-danger align-self-start"
          @click="clearVideo"
        >
          <i class="bi bi-trash me-1"></i>Remove video
        </button>
      </div>
    </div>
  </div>
</template>
