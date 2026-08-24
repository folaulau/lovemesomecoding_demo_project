/* Presentation helpers. No state, no imports - safe to use anywhere. */

/** 1_240_600 -> "1.2M". Used everywhere a raw view count would be noise. */
export function formatCount(n) {
  if (n === null || n === undefined) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return String(n);
}

function trim(v) {
  // 1.0M reads worse than 1M; 1.2M is worth the decimal.
  const r = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return String(r);
}

/** Full number with thousands separators, for tables where precision matters. */
export function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(n ?? 0);
}

/** 28 -> "0:28", 192 -> "3:12" */
export function formatDuration(seconds) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDate(iso, opts = {}) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3 days ago". Deliberately coarse - nobody needs "2 days, 4 hours ago". */
export function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function formatPercent(v, digits = 0) {
  return `${(Number(v ?? 0) * 100).toFixed(digits)}%`;
}

export function formatBytes(bytes) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** URL-safe slug. Mirrors the backend's SlugService so a slug previewed in the
 *  editor is the slug that actually gets saved. */
export function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

export const STATUS_META = {
  PUBLISHED: { label: "Published", variant: "success", icon: "bi-broadcast" },
  DRAFT: { label: "Draft", variant: "secondary", icon: "bi-pencil" },
  SCHEDULED: { label: "Scheduled", variant: "info", icon: "bi-clock" },
  ARCHIVED: { label: "Archived", variant: "dark", icon: "bi-archive" },
};
