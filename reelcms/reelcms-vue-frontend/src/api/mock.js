/*
 * Mock data + a mock transport.
 *
 * Phase 1 of this project builds the whole UI against this file, with no backend
 * running at all. Every function here mirrors the signature of its real
 * counterpart in the sibling api/*.js modules, so switching over in Phase 4 is a
 * change to api/client.js and nothing else.
 *
 * Two rules kept this honest:
 *   - Shapes match the documented Mongo documents exactly (see progress_report.md),
 *     including the denormalized `creator` snapshot on each reel. Building the UI
 *     against a prettier shape than the database actually returns is how you find
 *     out in Phase 4 that half your components need rewriting.
 *   - Every call goes through `delay()`. Instant mock responses hide every missing
 *     loading state.
 */

import { slugify } from "../utils/format";

/* ------------------------------------------------------------------ helpers */

/** XML-escape text going into an inline SVG.
 *
 *  Not optional: a raw "&" in a label ("4th & Inches") makes the SVG malformed,
 *  the data: URI fails to parse, and the <img> falls back to its alt text - which
 *  in a table blows the row height out and looks like a layout bug rather than a
 *  broken image. Cost half an hour the first time. */
function xml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Deterministic placeholder poster: a gradient with the title baked in.
 *  Inline SVG rather than a placeholder service so the app works offline. */
function poster(from, to, label, sub = "") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#g)"/>
    <circle cx="880" cy="300" r="240" fill="rgba(255,255,255,0.08)"/>
    <circle cx="150" cy="1640" r="330" fill="rgba(0,0,0,0.12)"/>
    <text x="540" y="940" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
          font-size="96" font-weight="800" fill="rgba(255,255,255,0.96)">${xml(label)}</text>
    <text x="540" y="1040" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
          font-size="46" font-weight="500" fill="rgba(255,255,255,0.72)">${xml(sub)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, " "))}`;
}

/** Deterministic square avatar from initials. */
function avatar(from, to, initials) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="160" height="160" fill="url(#a)"/>
    <text x="80" y="104" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
          font-size="66" font-weight="700" fill="rgba(255,255,255,0.95)">${xml(initials)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, " "))}`;
}

/** Network latency, so loading states are actually exercised during development. */
const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));

/** Days back from a fixed "today", as an ISO string. Fixed rather than Date.now()
 *  so screenshots and Playwright assertions stay stable. */
const TODAY = new Date("2026-08-24T12:00:00Z");
function daysAgo(n, hour = 9) {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}
function daysAhead(n, hour = 9) {
  return daysAgo(-n, hour);
}

/* ----------------------------------------------------------------- creators */

export const creators = [
  {
    id: "66c1a0000000000000000001",
    username: "hoopsdaily",
    displayName: "Hoops Daily",
    avatarUrl: avatar("#f97316", "#e0397f", "HD"),
    bio: "Every bucket that mattered, cut to 30 seconds. Not affiliated with anybody.",
    followerCount: 184300,
    createdAt: daysAgo(600),
  },
  {
    id: "66c1a0000000000000000002",
    username: "pitchside",
    displayName: "Pitchside",
    avatarUrl: avatar("#10b981", "#0ea5e9", "PS"),
    bio: "Football highlights, tactical clips, and the occasional wonder goal.",
    followerCount: 96700,
    createdAt: daysAgo(430),
  },
  {
    id: "66c1a0000000000000000003",
    username: "gridironcut",
    displayName: "Gridiron Cut",
    avatarUrl: avatar("#7c3aed", "#2563eb", "GC"),
    bio: "Fourth-down decisions, explained badly. Film room on Tuesdays.",
    followerCount: 61200,
    createdAt: daysAgo(310),
  },
  {
    id: "66c1a0000000000000000004",
    username: "thelastlap",
    displayName: "The Last Lap",
    avatarUrl: avatar("#ef4444", "#f59e0b", "LL"),
    bio: "Motorsport. Overtakes, strategy calls, radio meltdowns.",
    followerCount: 142800,
    createdAt: daysAgo(520),
  },
  {
    id: "66c1a0000000000000000005",
    username: "courtreport",
    displayName: "Court Report",
    avatarUrl: avatar("#14b8a6", "#8b5cf6", "CR"),
    bio: "Tennis rallies worth watching twice.",
    followerCount: 38400,
    createdAt: daysAgo(190),
  },
];

const byUsername = Object.fromEntries(creators.map((c) => [c.username, c]));

/** The denormalized snapshot that lives on every reel document.
 *  Note it is a COPY of three display fields, not the whole creator - that is the
 *  point of the pattern and worth seeing spelled out. */
function snapshot(username) {
  const c = byUsername[username];
  return {
    id: c.id,
    username: c.username,
    displayName: c.displayName,
    avatarUrl: c.avatarUrl,
  };
}

/* -------------------------------------------------------------- collections */

export const collections = [
  {
    id: "66c1b0000000000000000001",
    slug: "buzzer-beaters",
    name: "Buzzer Beaters",
    description: "Shots released with the horn already going.",
    coverUrl: poster("#f97316", "#e0397f", "Buzzer Beaters", "18 clips"),
    reelIds: [],
    createdAt: daysAgo(120),
  },
  {
    id: "66c1b0000000000000000002",
    slug: "wonder-goals",
    name: "Wonder Goals",
    description: "From outside the box, and from another postcode.",
    coverUrl: poster("#10b981", "#0ea5e9", "Wonder Goals", "24 clips"),
    reelIds: [],
    createdAt: daysAgo(96),
  },
  {
    id: "66c1b0000000000000000003",
    slug: "last-lap-overtakes",
    name: "Last Lap Overtakes",
    description: "Positions changing after the final board goes out.",
    coverUrl: poster("#ef4444", "#f59e0b", "Last Lap", "11 clips"),
    reelIds: [],
    createdAt: daysAgo(64),
  },
  {
    id: "66c1b0000000000000000004",
    slug: "rookie-watch",
    name: "Rookie Watch",
    description: "First-year players who look like they have been here for years.",
    coverUrl: poster("#7c3aed", "#2563eb", "Rookie Watch", "9 clips"),
    reelIds: [],
    createdAt: daysAgo(31),
  },
];

/* ------------------------------------------------------------------- reels */

function reel(o) {
  return {
    collectionIds: [],
    tags: [],
    stats: { views: 0, likes: 0, comments: 0, shares: 0 },
    ...o,
    video: {
      // Phase 1 has no real files. `url: null` makes ReelPlayer fall back to the
      // poster, which is exactly what it must also do in production for a reel
      // whose upload has not finished.
      url: null,
      width: 1080,
      height: 1920,
      sizeBytes: 0,
      ...o.video,
    },
  };
}

export const reels = [
  reel({
    id: "66c1c0000000000000000001",
    slug: "fadeaway-over-two-defenders",
    title: "Fadeaway over two defenders with 1.2 left",
    description:
      "Double-teamed at the elbow, no timeouts, and he still gets it off clean. Watch the footwork on the pivot - the whole shot is set up before he ever turns.",
    status: "PUBLISHED",
    publishedAt: daysAgo(2, 14),
    video: { posterUrl: poster("#f97316", "#e0397f", "Fadeaway", "0:28"), durationSeconds: 28 },
    creator: snapshot("hoopsdaily"),
    tags: ["basketball", "buzzer-beater", "clutch"],
    collectionIds: ["66c1b0000000000000000001"],
    stats: { views: 412300, likes: 38200, comments: 1840, shares: 6100 },
    createdAt: daysAgo(2, 12),
    updatedAt: daysAgo(2, 14),
  }),
  reel({
    id: "66c1c0000000000000000002",
    slug: "forty-yard-curler",
    title: "Forty yards, off the underside of the bar",
    description: "He looks up once, from inside his own half. That is the whole decision.",
    status: "PUBLISHED",
    publishedAt: daysAgo(3, 10),
    video: { posterUrl: poster("#10b981", "#0ea5e9", "40 Yards", "0:19"), durationSeconds: 19 },
    creator: snapshot("pitchside"),
    tags: ["football", "wonder-goal", "long-range"],
    collectionIds: ["66c1b0000000000000000002"],
    stats: { views: 987400, likes: 91300, comments: 4210, shares: 22400 },
    createdAt: daysAgo(3, 9),
    updatedAt: daysAgo(3, 10),
  }),
  reel({
    id: "66c1c0000000000000000003",
    slug: "around-the-outside-final-lap",
    title: "Around the outside on the final lap",
    description:
      "Nobody makes that corner work from the outside line. He carries two extra tenths through the entry and it holds.",
    status: "PUBLISHED",
    publishedAt: daysAgo(1, 16),
    video: { posterUrl: poster("#ef4444", "#f59e0b", "Final Lap", "0:34"), durationSeconds: 34 },
    creator: snapshot("thelastlap"),
    tags: ["motorsport", "overtake", "final-lap"],
    collectionIds: ["66c1b0000000000000000003"],
    stats: { views: 1240600, likes: 118900, comments: 7320, shares: 31800 },
    createdAt: daysAgo(1, 15),
    updatedAt: daysAgo(1, 16),
  }),
  reel({
    id: "66c1c0000000000000000004",
    slug: "fourth-and-inches-fake",
    title: "Fourth and inches, and they fake the sneak",
    description: "Everyone on the field bites. Everyone in the stadium bites. 46 yards.",
    status: "PUBLISHED",
    publishedAt: daysAgo(5, 11),
    video: { posterUrl: poster("#7c3aed", "#2563eb", "4th & Inches", "0:41"), durationSeconds: 41 },
    creator: snapshot("gridironcut"),
    tags: ["football-us", "trick-play", "fourth-down"],
    stats: { views: 356200, likes: 29400, comments: 2110, shares: 5400 },
    createdAt: daysAgo(5, 10),
    updatedAt: daysAgo(5, 11),
  }),
  reel({
    id: "66c1c0000000000000000005",
    slug: "twenty-eight-shot-rally",
    title: "A 28-shot rally that ends with a drop shot",
    description: "Both of them are done after this point. You can see it in the walk back.",
    status: "PUBLISHED",
    publishedAt: daysAgo(4, 13),
    video: { posterUrl: poster("#14b8a6", "#8b5cf6", "28 Shots", "0:52"), durationSeconds: 52 },
    creator: snapshot("courtreport"),
    tags: ["tennis", "rally", "drop-shot"],
    stats: { views: 208700, likes: 19600, comments: 940, shares: 3100 },
    createdAt: daysAgo(4, 12),
    updatedAt: daysAgo(4, 13),
  }),
  reel({
    id: "66c1c0000000000000000006",
    slug: "rookie-first-career-dunk",
    title: "Rookie's first career dunk is a poster",
    description: "Nineteen years old. Picks the wrong guy to go over, and it works anyway.",
    status: "PUBLISHED",
    publishedAt: daysAgo(7, 15),
    video: { posterUrl: poster("#e0397f", "#7c3aed", "Rookie", "0:22"), durationSeconds: 22 },
    creator: snapshot("hoopsdaily"),
    tags: ["basketball", "dunk", "rookie"],
    collectionIds: ["66c1b0000000000000000004"],
    stats: { views: 674100, likes: 61800, comments: 3390, shares: 14200 },
    createdAt: daysAgo(7, 14),
    updatedAt: daysAgo(7, 15),
  }),
  reel({
    id: "66c1c0000000000000000007",
    slug: "keeper-saves-three-in-nine-seconds",
    title: "Keeper saves three shots in nine seconds",
    description: "Point blank, then the rebound, then the follow-up from six yards. Somehow.",
    status: "PUBLISHED",
    publishedAt: daysAgo(9, 12),
    video: { posterUrl: poster("#0ea5e9", "#10b981", "Triple Save", "0:16"), durationSeconds: 16 },
    creator: snapshot("pitchside"),
    tags: ["football", "goalkeeper", "save"],
    stats: { views: 543800, likes: 47200, comments: 1980, shares: 9700 },
    createdAt: daysAgo(9, 11),
    updatedAt: daysAgo(9, 12),
  }),
  reel({
    id: "66c1c0000000000000000008",
    slug: "pit-stop-eighteen-seconds",
    title: "The strategy call that cost them the race",
    description: "Boxing here loses eleven seconds of track position for two tenths of tyre life.",
    status: "PUBLISHED",
    publishedAt: daysAgo(11, 9),
    video: { posterUrl: poster("#f59e0b", "#ef4444", "Bad Call", "1:04"), durationSeconds: 64 },
    creator: snapshot("thelastlap"),
    tags: ["motorsport", "strategy", "analysis"],
    stats: { views: 189400, likes: 14100, comments: 2860, shares: 2200 },
    createdAt: daysAgo(11, 8),
    updatedAt: daysAgo(11, 9),
  }),
  reel({
    id: "66c1c0000000000000000009",
    slug: "half-court-heave",
    title: "Half-court heave to end the third",
    description: "One dribble, one step, forty-six feet.",
    status: "PUBLISHED",
    publishedAt: daysAgo(14, 17),
    video: { posterUrl: poster("#8b5cf6", "#e0397f", "Half Court", "0:14"), durationSeconds: 14 },
    creator: snapshot("hoopsdaily"),
    tags: ["basketball", "buzzer-beater", "three-pointer"],
    collectionIds: ["66c1b0000000000000000001"],
    stats: { views: 823900, likes: 72400, comments: 2740, shares: 18600 },
    createdAt: daysAgo(14, 16),
    updatedAt: daysAgo(14, 17),
  }),
  reel({
    id: "66c1c000000000000000000a",
    slug: "bicycle-kick-injury-time",
    title: "Bicycle kick in the 94th minute",
    description: "Relegation on the line, and he tries this. Corner comes in flat and hard.",
    status: "PUBLISHED",
    publishedAt: daysAgo(18, 20),
    video: { posterUrl: poster("#22c55e", "#0ea5e9", "94'", "0:24"), durationSeconds: 24 },
    creator: snapshot("pitchside"),
    tags: ["football", "wonder-goal", "late-drama"],
    collectionIds: ["66c1b0000000000000000002"],
    stats: { views: 1560200, likes: 148700, comments: 9140, shares: 47300 },
    createdAt: daysAgo(18, 19),
    updatedAt: daysAgo(18, 20),
  }),
  reel({
    id: "66c1c000000000000000000b",
    slug: "one-handed-sideline-catch",
    title: "One-handed catch with a foot on the line",
    description: "Replay confirms it by about an inch. The toe drag is the whole play.",
    status: "PUBLISHED",
    publishedAt: daysAgo(21, 14),
    video: { posterUrl: poster("#2563eb", "#7c3aed", "One Hand", "0:31"), durationSeconds: 31 },
    creator: snapshot("gridironcut"),
    tags: ["football-us", "catch", "highlight"],
    stats: { views: 431500, likes: 39800, comments: 1620, shares: 7900 },
    createdAt: daysAgo(21, 13),
    updatedAt: daysAgo(21, 14),
  }),
  reel({
    id: "66c1c000000000000000000c",
    slug: "serve-and-volley-set-point",
    title: "Serve and volley on set point, in 2026",
    description: "Nobody does this anymore, which is precisely why it works.",
    status: "PUBLISHED",
    publishedAt: daysAgo(26, 11),
    video: { posterUrl: poster("#06b6d4", "#8b5cf6", "S&V", "0:27"), durationSeconds: 27 },
    creator: snapshot("courtreport"),
    tags: ["tennis", "serve-volley", "set-point"],
    stats: { views: 116300, likes: 9800, comments: 610, shares: 1400 },
    createdAt: daysAgo(26, 10),
    updatedAt: daysAgo(26, 11),
  }),

  /* ---- non-published, so the admin list has something to filter ---- */
  reel({
    id: "66c1c000000000000000000d",
    slug: "film-room-pick-and-roll-coverage",
    title: "Film room: why the drop coverage keeps failing",
    description: "Four possessions, same read, same result. Draft - needs the voiceover re-cut.",
    status: "DRAFT",
    publishedAt: null,
    video: { posterUrl: poster("#475569", "#1e293b", "Film Room", "3:12"), durationSeconds: 192 },
    creator: snapshot("hoopsdaily"),
    tags: ["basketball", "analysis", "film-room"],
    stats: { views: 0, likes: 0, comments: 0, shares: 0 },
    createdAt: daysAgo(1, 8),
    updatedAt: daysAgo(0, 10),
  }),
  reel({
    id: "66c1c000000000000000000e",
    slug: "season-opener-preview",
    title: "Season opener preview: three things to watch",
    description: "Scheduled to go out the morning of the opener.",
    status: "SCHEDULED",
    publishedAt: null,
    scheduledFor: daysAhead(3, 8),
    video: { posterUrl: poster("#334155", "#7c3aed", "Preview", "1:48"), durationSeconds: 108 },
    creator: snapshot("gridironcut"),
    tags: ["football-us", "preview", "season-opener"],
    stats: { views: 0, likes: 0, comments: 0, shares: 0 },
    createdAt: daysAgo(2, 9),
    updatedAt: daysAgo(1, 16),
  }),
  reel({
    id: "66c1c000000000000000000f",
    slug: "qualifying-lap-onboard",
    title: "Onboard: the lap that took pole by 0.004s",
    description: "Waiting on a rights check before this can go out.",
    status: "DRAFT",
    publishedAt: null,
    video: { posterUrl: poster("#7f1d1d", "#f59e0b", "Onboard", "1:22"), durationSeconds: 82 },
    creator: snapshot("thelastlap"),
    tags: ["motorsport", "onboard", "qualifying"],
    stats: { views: 0, likes: 0, comments: 0, shares: 0 },
    createdAt: daysAgo(4, 14),
    updatedAt: daysAgo(3, 11),
  }),
  reel({
    id: "66c1c000000000000000001a",
    slug: "old-season-recap",
    title: "Last season in ninety seconds",
    description: "Archived once the new season started - kept for the back catalogue.",
    status: "ARCHIVED",
    publishedAt: daysAgo(210, 12),
    video: { posterUrl: poster("#1e293b", "#334155", "Recap", "1:30"), durationSeconds: 90 },
    creator: snapshot("pitchside"),
    tags: ["football", "recap", "season"],
    stats: { views: 298400, likes: 21300, comments: 870, shares: 4100 },
    createdAt: daysAgo(212, 10),
    updatedAt: daysAgo(60, 9),
  }),
];

/* Backfill collection membership from the reels, so the two never disagree. */
for (const c of collections) {
  c.reelIds = reels.filter((r) => r.collectionIds.includes(c.id)).map((r) => r.id);
}

/* ---------------------------------------------------------------- comments */

const COMMENT_BODIES = [
  "The footwork on the pivot is the part nobody talks about.",
  "Watched this twelve times and I still do not understand the angle.",
  "Commentator completely losing it is half the clip.",
  "This is going straight into the end-of-season package.",
  "Genuinely do not know how that stayed in.",
  "Whoever cut this deserves a raise, the timing on the slow-mo is perfect.",
  "Been following since the account had 200 followers. Still the best edits out there.",
  "The defender's reaction at 0:14 says everything.",
  "Somebody explain the physics here because I refuse to accept it.",
  "Not the best of the season but top five easily.",
];

const COMMENT_AUTHORS = [
  { username: "mid_court_mark", displayName: "Mark" },
  { username: "sundayleague", displayName: "Priya" },
  { username: "boxscorebrain", displayName: "Dee" },
  { username: "tifosi_tam", displayName: "Tam" },
  { username: "backpage", displayName: "Jules" },
  { username: "the_third_man", displayName: "Ade" },
];

export const comments = [];
reels
  .filter((r) => r.status === "PUBLISHED")
  .forEach((r, ri) => {
    const n = 3 + (ri % 4);
    for (let i = 0; i < n; i += 1) {
      const a = COMMENT_AUTHORS[(ri + i) % COMMENT_AUTHORS.length];
      comments.push({
        id: `66c1d${String(comments.length).padStart(19, "0")}`,
        reelId: r.id,
        author: {
          id: `66c1e${String((ri + i) % COMMENT_AUTHORS.length).padStart(19, "0")}`,
          username: a.username,
          displayName: a.displayName,
          avatarUrl: avatar("#334155", "#64748b", a.displayName[0]),
        },
        body: COMMENT_BODIES[(ri * 3 + i) % COMMENT_BODIES.length],
        likes: ((ri + 1) * (i + 3) * 7) % 240,
        createdAt: daysAgo(Math.max(0, ri - i), 12 + i),
      });
    }
  });

/* --------------------------------------------------------------- analytics
 *
 * In production every one of these comes out of an aggregation pipeline over
 * view_events. Shapes here match what those pipelines return, field for field.
 */

const published = reels.filter((r) => r.status === "PUBLISHED");

export const analytics = {
  /* $group by $dateTrunc day. A gentle sine keeps the chart from looking random. */
  viewsOverTime: Array.from({ length: 30 }, (_, i) => {
    const day = 29 - i;
    const base = 96000 + Math.round(Math.sin(i / 3.4) * 21000) + i * 1450;
    return {
      date: daysAgo(day, 0).slice(0, 10),
      views: base,
      completions: Math.round(base * (0.51 + (i % 7) * 0.012)),
    };
  }),

  /* $group by metadata.reelId -> $sort -> $limit -> $lookup into reels */
  topReels: [...published]
    .sort((a, b) => b.stats.views - a.stats.views)
    .slice(0, 8)
    .map((r) => ({
      reelId: r.id,
      slug: r.slug,
      title: r.title,
      posterUrl: r.video.posterUrl,
      creator: r.creator.displayName,
      views: r.stats.views,
      likes: r.stats.likes,
      completionRate: 0.42 + ((r.stats.likes % 37) / 100),
    })),

  /* $unwind tags -> $group -> $sort */
  engagementByTag: (() => {
    const acc = {};
    published.forEach((r) =>
      r.tags.forEach((t) => {
        acc[t] ??= { tag: t, reels: 0, views: 0, likes: 0 };
        acc[t].reels += 1;
        acc[t].views += r.stats.views;
        acc[t].likes += r.stats.likes;
      })
    );
    return Object.values(acc)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  })(),

  /* One $facet with four sub-pipelines, one round trip. */
  totals: {
    totalReels: reels.length,
    publishedReels: published.length,
    totalViews: published.reduce((s, r) => s + r.stats.views, 0),
    totalLikes: published.reduce((s, r) => s + r.stats.likes, 0),
    totalComments: published.reduce((s, r) => s + r.stats.comments, 0),
    totalCreators: creators.length,
    avgCompletionRate: 0.563,
    viewsLast7Days: 812400,
    viewsPrev7Days: 736100,
  },

  statusBreakdown: ["PUBLISHED", "DRAFT", "SCHEDULED", "ARCHIVED"].map((status) => ({
    status,
    count: reels.filter((r) => r.status === status).length,
  })),
};

/* ------------------------------------------------------------------- users */

export const users = [
  {
    id: "66c1f0000000000000000001",
    email: "admin@reelcms.test",
    password: "admin123", // mock only - the real backend stores a bcrypt hash
    displayName: "Site Admin",
    roles: ["ADMIN"],
    creatorId: null,
  },
  {
    id: "66c1f0000000000000000002",
    email: "creator@reelcms.test",
    password: "creator123",
    displayName: "Hoops Daily",
    roles: ["CREATOR"],
    creatorId: "66c1a0000000000000000001",
  },
];

/* ------------------------------------------------------------- mock transport
 *
 * Operates on in-memory copies so edits made in the admin UI survive navigation
 * within a session, the way they would against a real API.
 */

let reelStore = reels.map((r) => structuredClone(r));
let collectionStore = collections.map((c) => structuredClone(c));
let creatorStore = creators.map((c) => structuredClone(c));
let commentStore = comments.map((c) => structuredClone(c));

const clone = (v) => structuredClone(v);

function paginate(items, page = 1, size = 10) {
  const start = (page - 1) * size;
  return {
    content: items.slice(start, start + size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  };
}

export const mockApi = {
  /* ---- public ---- */

  async feed({ cursor = null, limit = 6 } = {}) {
    await delay();
    const live = reelStore
      .filter((r) => r.status === "PUBLISHED")
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const start = cursor ? live.findIndex((r) => r.id === cursor) + 1 : 0;
    const slice = live.slice(start, start + limit);
    return clone({
      items: slice,
      nextCursor: start + limit < live.length ? slice.at(-1)?.id ?? null : null,
    });
  },

  async reelBySlug(slug) {
    await delay();
    const r = reelStore.find((x) => x.slug === slug);
    if (!r) throw new ApiError(404, "Reel not found");
    return clone(r);
  },

  async search({ q = "", tag = null, page = 1, size = 12 } = {}) {
    await delay();
    const needle = q.trim().toLowerCase();
    let items = reelStore.filter((r) => r.status === "PUBLISHED");
    if (tag) items = items.filter((r) => r.tags.includes(tag));
    if (needle) {
      // Stands in for Mongo's $text score. The real one weights title 10,
      // tags 8, description 5 - mirrored here so the ordering looks the same.
      items = items
        .map((r) => {
          let score = 0;
          if (r.title.toLowerCase().includes(needle)) score += 10;
          if (r.tags.some((t) => t.includes(needle))) score += 8;
          if (r.description.toLowerCase().includes(needle)) score += 5;
          if (r.creator.displayName.toLowerCase().includes(needle)) score += 3;
          return { r, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.r);
    } else {
      items = items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    }
    return clone(paginate(items, page, size));
  },

  async trendingTags() {
    await delay(120);
    return clone(analytics.engagementByTag.slice(0, 8).map((t) => t.tag));
  },

  async commentsForReel(reelId) {
    await delay();
    return clone(
      commentStore
        .filter((c) => c.reelId === reelId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    );
  },

  async addComment(reelId, body) {
    await delay(180);
    const c = {
      id: `66c1d${String(commentStore.length + 500).padStart(19, "0")}`,
      reelId,
      author: {
        id: "66c1e0000000000000000099",
        username: "you",
        displayName: "You",
        avatarUrl: avatar("#e0397f", "#7c3aed", "Y"),
      },
      body,
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    commentStore.unshift(c);
    const reel = reelStore.find((r) => r.id === reelId);
    if (reel) reel.stats.comments += 1;
    return clone(c);
  },

  async like(reelId, liked) {
    await delay(90);
    const r = reelStore.find((x) => x.id === reelId);
    if (r) r.stats.likes += liked ? 1 : -1;
    return clone({ likes: r?.stats.likes ?? 0 });
  },

  async recordView(reelId) {
    await delay(60);
    const r = reelStore.find((x) => x.id === reelId);
    if (r) r.stats.views += 1;
    return { ok: true };
  },

  async creatorByUsername(username) {
    await delay();
    const c = creatorStore.find((x) => x.username === username);
    if (!c) throw new ApiError(404, "Creator not found");
    const items = reelStore
      .filter((r) => r.creator.username === username && r.status === "PUBLISHED")
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return clone({ creator: c, reels: items });
  },

  async listCollections() {
    await delay();
    return clone(collectionStore);
  },

  async collectionBySlug(slug) {
    await delay();
    const c = collectionStore.find((x) => x.slug === slug);
    if (!c) throw new ApiError(404, "Collection not found");
    const items = c.reelIds
      .map((id) => reelStore.find((r) => r.id === id))
      .filter((r) => r && r.status === "PUBLISHED");
    return clone({ collection: c, reels: items });
  },

  /* ---- auth ---- */

  async login(email, password) {
    await delay(300);
    const u = users.find((x) => x.email === email && x.password === password);
    if (!u) throw new ApiError(401, "Invalid email or password");
    const { password: _pw, ...safe } = u;
    return clone({ token: `mock-jwt-for-${u.id}`, user: safe });
  },

  /* ---- admin ---- */

  async adminReels({ q = "", status = "", creatorId = "", page = 1, size = 10 } = {}) {
    await delay();
    let items = [...reelStore];
    if (status) items = items.filter((r) => r.status === status);
    if (creatorId) items = items.filter((r) => r.creator.id === creatorId);
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(n) ||
          r.tags.some((t) => t.includes(n)) ||
          r.creator.displayName.toLowerCase().includes(n)
      );
    }
    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return clone(paginate(items, page, size));
  },

  async adminReel(id) {
    await delay();
    const r = reelStore.find((x) => x.id === id);
    if (!r) throw new ApiError(404, "Reel not found");
    return clone(r);
  },

  async createReel(payload) {
    await delay(320);
    const now = new Date().toISOString();
    const creator = creatorStore.find((c) => c.id === payload.creatorId) ?? creatorStore[0];
    const created = {
      id: `66c1c${String(reelStore.length + 900).padStart(19, "0")}`,
      slug: payload.slug || slugify(payload.title),
      title: payload.title,
      description: payload.description ?? "",
      status: payload.status ?? "DRAFT",
      publishedAt: payload.status === "PUBLISHED" ? now : null,
      scheduledFor: payload.scheduledFor ?? null,
      video: {
        url: payload.video?.url ?? null,
        posterUrl: payload.video?.posterUrl ?? poster("#334155", "#7c3aed", payload.title.slice(0, 14), ""),
        durationSeconds: payload.video?.durationSeconds ?? 0,
        width: 1080,
        height: 1920,
        sizeBytes: payload.video?.sizeBytes ?? 0,
      },
      creator: {
        id: creator.id,
        username: creator.username,
        displayName: creator.displayName,
        avatarUrl: creator.avatarUrl,
      },
      tags: payload.tags ?? [],
      collectionIds: payload.collectionIds ?? [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0 },
      createdAt: now,
      updatedAt: now,
    };
    reelStore.unshift(created);
    syncCollections();
    return clone(created);
  },

  async updateReel(id, payload) {
    await delay(280);
    const r = reelStore.find((x) => x.id === id);
    if (!r) throw new ApiError(404, "Reel not found");
    const creator = payload.creatorId
      ? creatorStore.find((c) => c.id === payload.creatorId)
      : null;
    Object.assign(r, {
      title: payload.title ?? r.title,
      slug: payload.slug ?? r.slug,
      description: payload.description ?? r.description,
      status: payload.status ?? r.status,
      scheduledFor: payload.scheduledFor ?? r.scheduledFor,
      tags: payload.tags ?? r.tags,
      collectionIds: payload.collectionIds ?? r.collectionIds,
      updatedAt: new Date().toISOString(),
    });
    if (payload.video) Object.assign(r.video, payload.video);
    if (creator) {
      r.creator = {
        id: creator.id,
        username: creator.username,
        displayName: creator.displayName,
        avatarUrl: creator.avatarUrl,
      };
    }
    if (r.status === "PUBLISHED" && !r.publishedAt) r.publishedAt = new Date().toISOString();
    syncCollections();
    return clone(r);
  },

  async deleteReel(id) {
    await delay(200);
    reelStore = reelStore.filter((r) => r.id !== id);
    commentStore = commentStore.filter((c) => c.reelId !== id);
    syncCollections();
    return { ok: true };
  },

  async setReelStatus(id, status) {
    await delay(200);
    const r = reelStore.find((x) => x.id === id);
    if (!r) throw new ApiError(404, "Reel not found");
    r.status = status;
    r.updatedAt = new Date().toISOString();
    if (status === "PUBLISHED" && !r.publishedAt) r.publishedAt = r.updatedAt;
    return clone(r);
  },

  async adminCollections() {
    await delay();
    return clone(collectionStore);
  },

  async saveCollection(payload) {
    await delay(240);
    if (payload.id) {
      const c = collectionStore.find((x) => x.id === payload.id);
      Object.assign(c, {
        name: payload.name,
        slug: payload.slug || slugify(payload.name),
        description: payload.description,
      });
      return clone(c);
    }
    const created = {
      id: `66c1b${String(collectionStore.length + 900).padStart(19, "0")}`,
      slug: payload.slug || slugify(payload.name),
      name: payload.name,
      description: payload.description ?? "",
      coverUrl: poster("#334155", "#e0397f", payload.name.slice(0, 14), ""),
      reelIds: [],
      createdAt: new Date().toISOString(),
    };
    collectionStore.push(created);
    return clone(created);
  },

  async deleteCollection(id) {
    await delay(180);
    collectionStore = collectionStore.filter((c) => c.id !== id);
    reelStore.forEach((r) => {
      r.collectionIds = r.collectionIds.filter((cid) => cid !== id);
    });
    return { ok: true };
  },

  async adminCreators() {
    await delay();
    return clone(
      creatorStore.map((c) => ({
        ...c,
        reelCount: reelStore.filter((r) => r.creator.id === c.id).length,
        totalViews: reelStore
          .filter((r) => r.creator.id === c.id)
          .reduce((s, r) => s + r.stats.views, 0),
      }))
    );
  },

  async saveCreator(payload) {
    await delay(240);
    if (payload.id) {
      const c = creatorStore.find((x) => x.id === payload.id);
      Object.assign(c, {
        displayName: payload.displayName,
        username: payload.username,
        bio: payload.bio,
      });
      // The denormalization fan-out, made visible. See progress_report.md.
      reelStore
        .filter((r) => r.creator.id === c.id)
        .forEach((r) => {
          r.creator.displayName = c.displayName;
          r.creator.username = c.username;
        });
      return clone(c);
    }
    const created = {
      id: `66c1a${String(creatorStore.length + 900).padStart(19, "0")}`,
      username: payload.username,
      displayName: payload.displayName,
      avatarUrl: avatar("#475569", "#e0397f", payload.displayName[0] ?? "?"),
      bio: payload.bio ?? "",
      followerCount: 0,
      createdAt: new Date().toISOString(),
    };
    creatorStore.push(created);
    return clone(created);
  },

  async reports() {
    await delay(340);
    // Recomputed from the live store so admin edits move the numbers.
    const live = reelStore.filter((r) => r.status === "PUBLISHED");
    return clone({
      ...analytics,
      totals: {
        ...analytics.totals,
        totalReels: reelStore.length,
        publishedReels: live.length,
        totalViews: live.reduce((s, r) => s + r.stats.views, 0),
        totalLikes: live.reduce((s, r) => s + r.stats.likes, 0),
        totalComments: live.reduce((s, r) => s + r.stats.comments, 0),
        totalCreators: creatorStore.length,
      },
      statusBreakdown: ["PUBLISHED", "DRAFT", "SCHEDULED", "ARCHIVED"].map((status) => ({
        status,
        count: reelStore.filter((r) => r.status === status).length,
      })),
    });
  },

  /** Stands in for the change-stream SSE endpoint: nudges a random published
   *  reel's view count every couple of seconds. Returns an unsubscribe fn, the
   *  same contract the real EventSource wrapper exposes. */
  subscribeToStats(onEvent) {
    const timer = setInterval(() => {
      const live = reelStore.filter((r) => r.status === "PUBLISHED");
      if (!live.length) return;
      const r = live[Math.floor(Math.random() * live.length)];
      const delta = 1 + Math.floor(Math.random() * 40);
      r.stats.views += delta;
      onEvent({ reelId: r.id, slug: r.slug, title: r.title, views: r.stats.views, delta });
    }, 2200);
    return () => clearInterval(timer);
  },
};

function syncCollections() {
  collectionStore.forEach((c) => {
    c.reelIds = reelStore.filter((r) => r.collectionIds.includes(c.id)).map((r) => r.id);
  });
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
