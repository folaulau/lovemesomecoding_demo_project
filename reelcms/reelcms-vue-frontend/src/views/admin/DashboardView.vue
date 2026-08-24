<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Line, Doughnut, Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import { api } from "../../api";
import { useToastStore } from "../../stores/toast";
import StatCard from "../../components/admin/StatCard.vue";
import LoadingSpinner from "../../components/ui/LoadingSpinner.vue";
import { formatCount, formatNumber, formatPercent } from "../../utils/format";

/*
 * Every number on this page comes from an aggregation pipeline over `view_events`
 * and `reels` - never from a hard-coded figure. See progress_report.md for the
 * pipeline behind each panel.
 *
 * Chart.js is tree-shaken, so each element type has to be registered explicitly.
 * Miss one and the chart renders as a blank canvas with no error, which is a
 * genuinely annoying half hour to debug.
 */
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler
);

const toast = useToastStore();
const report = ref(null);
const loading = ref(true);

/** Reel ids whose counter just moved, so StatCard can flash them. */
const liveHits = ref(new Set());
const liveFeed = ref([]);
let unsubscribe = null;

const PALETTE = ["#e0397f", "#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#8b5cf6"];
const GRID = "rgba(255,255,255,0.07)";
const TICK = "rgba(230,230,238,0.55)";

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: TICK, boxWidth: 12 } } },
  scales: {
    x: { grid: { color: GRID }, ticks: { color: TICK, maxRotation: 0, autoSkipPadding: 16 } },
    y: { grid: { color: GRID }, ticks: { color: TICK }, beginAtZero: true },
  },
};

const viewsChart = computed(() => ({
  labels: report.value.viewsOverTime.map((d) => d.date.slice(5)),
  datasets: [
    {
      label: "Views",
      data: report.value.viewsOverTime.map((d) => d.views),
      borderColor: "#e0397f",
      backgroundColor: "rgba(224,57,127,0.16)",
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
    },
    {
      label: "Completions",
      data: report.value.viewsOverTime.map((d) => d.completions),
      borderColor: "#7c3aed",
      backgroundColor: "transparent",
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
      borderDash: [4, 4],
    },
  ],
}));

const tagChart = computed(() => ({
  labels: report.value.engagementByTag.map((t) => `#${t.tag}`),
  datasets: [
    {
      label: "Views",
      data: report.value.engagementByTag.map((t) => t.views),
      backgroundColor: PALETTE,
      borderRadius: 4,
    },
  ],
}));

// Keyed BY STATUS, not by array position. The API returns statusBreakdown in
// enum order (DRAFT, SCHEDULED, PUBLISHED, ARCHIVED) while the mock happened to
// return it published-first, so a positional colour array silently painted
// PUBLISHED in the DRAFT colour the moment the real backend was wired up.
const STATUS_COLOR = {
  PUBLISHED: "#10b981",
  DRAFT: "#64748b",
  SCHEDULED: "#0ea5e9",
  ARCHIVED: "#334155",
};

const statusChart = computed(() => ({
  labels: report.value.statusBreakdown.map((s) => s.status),
  datasets: [
    {
      data: report.value.statusBreakdown.map((s) => s.count),
      backgroundColor: report.value.statusBreakdown.map((s) => STATUS_COLOR[s.status] ?? "#475569"),
      borderWidth: 0,
    },
  ],
}));

const weekDelta = computed(() => {
  const t = report.value.totals;
  if (!t.viewsPrev7Days) return null;
  return (t.viewsLast7Days - t.viewsPrev7Days) / t.viewsPrev7Days;
});

onMounted(async () => {
  try {
    report.value = await api.reports();
  } catch (e) {
    toast.error(e.message);
    return;
  } finally {
    loading.value = false;
  }

  // Live counters, fed by a change stream on the server.
  unsubscribe = api.subscribeToStats((evt) => {
    report.value.totals.totalViews += evt.delta;

    const row = report.value.topReels.find((r) => r.reelId === evt.reelId);
    if (row) row.views = evt.views;

    liveHits.value = new Set([...liveHits.value, evt.reelId]);
    // Keep the activity strip short - it is a pulse indicator, not a log.
    liveFeed.value = [{ ...evt, at: Date.now() }, ...liveFeed.value].slice(0, 6);
  });
});

// Not closing the stream leaves an EventSource (or an interval, under the mock)
// running for the life of the tab every time you visit this route.
onBeforeUnmount(() => unsubscribe?.());
</script>

<template>
  <LoadingSpinner v-if="loading" label="Running aggregations…" />

  <template v-else-if="report">
    <div class="row g-3 mb-4 row-cols-2 row-cols-lg-4">
      <div class="col">
        <StatCard
          label="Total views"
          :value="formatCount(report.totals.totalViews)"
          icon="bi-eye"
          :delta="weekDelta"
          live
        />
      </div>
      <div class="col">
        <StatCard label="Published reels" :value="report.totals.publishedReels" icon="bi-broadcast" />
      </div>
      <div class="col">
        <StatCard label="Total likes" :value="formatCount(report.totals.totalLikes)" icon="bi-heart" />
      </div>
      <div class="col">
        <StatCard
          label="Avg completion"
          :value="formatPercent(report.totals.avgCompletionRate, 1)"
          icon="bi-check2-circle"
        />
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12 col-xl-8">
        <div class="reel-surface p-3 h-100">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h2 class="h6 mb-0">Views over the last 30 days</h2>
            <small class="text-tertiary d-none d-sm-block">
              <code class="text-tertiary">$group</code> by
              <code class="text-tertiary">$dateTrunc</code>
            </small>
          </div>
          <div style="height: 280px"><Line :data="viewsChart" :options="baseOptions" /></div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-4">
        <div class="reel-surface p-3 h-100">
          <h2 class="h6 mb-3">Reels by status</h2>
          <div style="height: 280px">
            <Doughnut
              :data="statusChart"
              :options="{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: { legend: { position: 'bottom', labels: { color: TICK, boxWidth: 12 } } },
              }"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-xl-7">
        <div class="reel-surface p-3 h-100">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h2 class="h6 mb-0">Top reels</h2>
            <small class="text-tertiary d-none d-sm-block">
              <code class="text-tertiary">$group → $sort → $lookup</code>
            </small>
          </div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr class="text-tertiary" style="font-size: 0.76rem">
                  <th scope="col"></th>
                  <th scope="col">Reel</th>
                  <th scope="col" class="text-end">Views</th>
                  <th scope="col" class="text-end d-none d-sm-table-cell">Likes</th>
                  <th scope="col" class="text-end d-none d-md-table-cell">Completion</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in report.topReels" :key="r.reelId">
                  <td style="width: 52px">
                    <img class="admin-thumb" :src="r.posterUrl" :alt="r.title" loading="lazy" />
                  </td>
                  <td>
                    <RouterLink
                      class="text-body text-decoration-none fw-semibold small d-block"
                      :to="{ name: 'reel', params: { slug: r.slug } }"
                    >{{ r.title }}</RouterLink>
                    <small class="text-tertiary">{{ r.creator }}</small>
                  </td>
                  <td class="text-end text-tabular" :class="{ 'text-primary fw-semibold': liveHits.has(r.reelId) }">
                    {{ formatNumber(r.views) }}
                  </td>
                  <td class="text-end text-tabular d-none d-sm-table-cell">{{ formatNumber(r.likes) }}</td>
                  <td class="text-end text-tabular d-none d-md-table-cell">
                    {{ formatPercent(r.completionRate, 1) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-12 col-xl-5">
        <div class="reel-surface p-3 mb-3">
          <h2 class="h6 mb-3">Engagement by tag</h2>
          <div style="height: 240px">
            <Bar
              :data="tagChart"
              :options="{ ...baseOptions, indexAxis: 'y', plugins: { legend: { display: false } } }"
            />
          </div>
        </div>

        <div class="reel-surface p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="spinner-grow spinner-grow-sm text-primary"></span>
            <h2 class="h6 mb-0">Live views</h2>
            <small class="text-tertiary ms-auto">MongoDB change stream</small>
          </div>
          <p v-if="!liveFeed.length" class="text-tertiary small mb-0">Waiting for activity…</p>
          <ul v-else class="list-unstyled small mb-0 d-flex flex-column gap-1">
            <li v-for="e in liveFeed" :key="e.at" class="d-flex gap-2">
              <span class="badge text-bg-primary text-tabular flex-shrink-0">+{{ e.delta }}</span>
              <span class="text-truncate">{{ e.title }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </template>
</template>
