package com.reelcms.api.seed;

import com.reelcms.api.entity.comment.Comment;
import com.reelcms.api.entity.comment.CommentRepository;
import com.reelcms.api.entity.creator.AvatarFactory;
import com.reelcms.api.entity.creator.Creator;
import com.reelcms.api.entity.creator.CreatorRepository;
import com.reelcms.api.entity.reel.CreatorRef;
import com.reelcms.api.entity.reel.Reel;
import com.reelcms.api.entity.reel.ReelRepository;
import com.reelcms.api.entity.reel.ReelStats;
import com.reelcms.api.entity.reel.ReelStatus;
import com.reelcms.api.entity.reel.SlugService;
import com.reelcms.api.entity.reel.VideoAsset;
import com.reelcms.api.entity.reelcollection.CoverFactory;
import com.reelcms.api.entity.reelcollection.ReelCollection;
import com.reelcms.api.entity.reelcollection.ReelCollectionRepository;
import com.reelcms.api.entity.user.User;
import com.reelcms.api.entity.user.UserRepository;
import com.reelcms.api.entity.viewevent.ViewEvent;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds a working dataset on first start.
 *
 * <p>Mirrors src/api/mock.js so the app looks the same whether the frontend is running on mocks or
 * on the real API — which makes the Phase 4 switchover verifiable by eye rather than by faith.
 *
 * <p>Idempotent: it checks for existing reels and does nothing if any are present. Wipe and re-seed
 * with {@code docker compose down -v}.
 *
 * <p>The view_events it generates matter more than they look. Every dashboard number is an
 * aggregation over that collection, so with an empty one the reports are all zeroes and every
 * pipeline appears broken.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final ReelRepository reelRepository;
    private final CreatorRepository creatorRepository;
    private final CommentRepository commentRepository;
    private final ReelCollectionRepository collectionRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongo;
    private final PasswordEncoder passwordEncoder;
    private final SlugService slugService;

    /** Fixed seed, so the demo numbers are the same on every machine. */
    private final Random random = new Random(20260824L);

    @Override
    public void run(ApplicationArguments args) {
        if (reelRepository.count() > 0) {
            log.info("Data already present — skipping seed");
            return;
        }
        log.info("Seeding ReelCMS demo data…");

        List<Creator> creators = seedCreators();
        List<ReelCollection> collections = seedCollections();
        List<Integer> popularity = new ArrayList<>();
        List<Reel> reels = seedReels(creators, collections, popularity);
        linkCollections(collections, reels);
        seedComments(reels);
        seedViewEvents(reels, popularity);
        // Counters last: they are derived from what the two steps above inserted.
        reconcileStats(reels, popularity);
        seedUsers(creators);

        log.info("Seeded {} creators, {} collections, {} reels", creators.size(), collections.size(), reels.size());
    }

    /* --------------------------------------------------------------- creators */

    private List<Creator> seedCreators() {
        record Seed(String username, String displayName, String bio, long followers) {}
        List<Seed> seeds = List.of(
                new Seed("hoopsdaily", "Hoops Daily", "Every bucket that mattered, cut to 30 seconds.", 184_300),
                new Seed("pitchside", "Pitchside", "Football highlights, tactical clips, wonder goals.", 96_700),
                new Seed("gridironcut", "Gridiron Cut", "Fourth-down decisions, explained badly.", 61_200),
                new Seed("thelastlap", "The Last Lap", "Motorsport. Overtakes, strategy, radio meltdowns.", 142_800),
                new Seed("courtreport", "Court Report", "Tennis rallies worth watching twice.", 38_400));

        List<Creator> saved = new ArrayList<>();
        for (Seed s : seeds) {
            saved.add(creatorRepository.save(Creator.builder()
                    .username(s.username())
                    .displayName(s.displayName())
                    .bio(s.bio())
                    .avatarUrl(AvatarFactory.forName(s.displayName()))
                    .followerCount(s.followers())
                    .build()));
        }
        return saved;
    }

    /* ------------------------------------------------------------ collections */

    private List<ReelCollection> seedCollections() {
        record Seed(String name, String description) {}
        List<Seed> seeds = List.of(
                new Seed("Buzzer Beaters", "Shots released with the horn already going."),
                new Seed("Wonder Goals", "From outside the box, and from another postcode."),
                new Seed("Last Lap Overtakes", "Positions changing after the final board goes out."),
                new Seed("Rookie Watch", "First-year players who look like veterans."));

        List<ReelCollection> saved = new ArrayList<>();
        for (Seed s : seeds) {
            saved.add(collectionRepository.save(ReelCollection.builder()
                    .slug(slugService.slugify(s.name()))
                    .name(s.name())
                    .description(s.description())
                    .coverUrl(CoverFactory.forName(s.name()))
                    .reelIds(new ArrayList<>())
                    .build()));
        }
        return saved;
    }

    /* ------------------------------------------------------------------ reels */

    private List<Reel> seedReels(
            List<Creator> creators, List<ReelCollection> collections, List<Integer> popularityOut) {
        record Seed(
                String title,
                String description,
                int creator,
                int duration,
                List<String> tags,
                ReelStatus status,
                int daysAgo,
                long views,
                long likes,
                long comments,
                long shares,
                String posterLabel,
                String from,
                String to,
                List<Integer> collections) {}

        List<Seed> seeds = List.of(
                new Seed(
                        "Fadeaway over two defenders with 1.2 left",
                        "Double-teamed at the elbow, no timeouts, and he still gets it off clean.",
                        0,
                        28,
                        List.of("basketball", "buzzer-beater", "clutch"),
                        ReelStatus.PUBLISHED,
                        2,
                        412_300,
                        38_200,
                        1_840,
                        6_100,
                        "Fadeaway",
                        "#f97316",
                        "#e0397f",
                        List.of(0)),
                new Seed(
                        "Forty yards, off the underside of the bar",
                        "He looks up once, from inside his own half. That is the whole decision.",
                        1,
                        19,
                        List.of("football", "wonder-goal", "long-range"),
                        ReelStatus.PUBLISHED,
                        3,
                        987_400,
                        91_300,
                        4_210,
                        22_400,
                        "40 Yards",
                        "#10b981",
                        "#0ea5e9",
                        List.of(1)),
                new Seed(
                        "Around the outside on the final lap",
                        "Nobody makes that corner work from the outside line.",
                        3,
                        34,
                        List.of("motorsport", "overtake", "final-lap"),
                        ReelStatus.PUBLISHED,
                        1,
                        1_240_600,
                        118_900,
                        7_320,
                        31_800,
                        "Final Lap",
                        "#ef4444",
                        "#f59e0b",
                        List.of(2)),
                new Seed(
                        "Fourth and inches, and they fake the sneak",
                        "Everyone on the field bites. Everyone in the stadium bites. 46 yards.",
                        2,
                        41,
                        List.of("football-us", "trick-play", "fourth-down"),
                        ReelStatus.PUBLISHED,
                        5,
                        356_200,
                        29_400,
                        2_110,
                        5_400,
                        "4th & Inches",
                        "#7c3aed",
                        "#2563eb",
                        List.of()),
                new Seed(
                        "A 28-shot rally that ends with a drop shot",
                        "Both of them are done after this point. You can see it in the walk back.",
                        4,
                        52,
                        List.of("tennis", "rally", "drop-shot"),
                        ReelStatus.PUBLISHED,
                        4,
                        208_700,
                        19_600,
                        940,
                        3_100,
                        "28 Shots",
                        "#14b8a6",
                        "#8b5cf6",
                        List.of()),
                new Seed(
                        "Rookie's first career dunk is a poster",
                        "Nineteen years old. Picks the wrong guy to go over, and it works anyway.",
                        0,
                        22,
                        List.of("basketball", "dunk", "rookie"),
                        ReelStatus.PUBLISHED,
                        7,
                        674_100,
                        61_800,
                        3_390,
                        14_200,
                        "Rookie",
                        "#e0397f",
                        "#7c3aed",
                        List.of(3)),
                new Seed(
                        "Keeper saves three shots in nine seconds",
                        "Point blank, then the rebound, then the follow-up from six yards.",
                        1,
                        16,
                        List.of("football", "goalkeeper", "save"),
                        ReelStatus.PUBLISHED,
                        9,
                        543_800,
                        47_200,
                        1_980,
                        9_700,
                        "Triple Save",
                        "#0ea5e9",
                        "#10b981",
                        List.of()),
                new Seed(
                        "The strategy call that cost them the race",
                        "Boxing here loses eleven seconds of track position for two tenths of tyre life.",
                        3,
                        64,
                        List.of("motorsport", "strategy", "analysis"),
                        ReelStatus.PUBLISHED,
                        11,
                        189_400,
                        14_100,
                        2_860,
                        2_200,
                        "Bad Call",
                        "#f59e0b",
                        "#ef4444",
                        List.of()),
                new Seed(
                        "Half-court heave to end the third",
                        "One dribble, one step, forty-six feet.",
                        0,
                        14,
                        List.of("basketball", "buzzer-beater", "three-pointer"),
                        ReelStatus.PUBLISHED,
                        14,
                        823_900,
                        72_400,
                        2_740,
                        18_600,
                        "Half Court",
                        "#8b5cf6",
                        "#e0397f",
                        List.of(0)),
                new Seed(
                        "Bicycle kick in the 94th minute",
                        "Relegation on the line, and he tries this.",
                        1,
                        24,
                        List.of("football", "wonder-goal", "late-drama"),
                        ReelStatus.PUBLISHED,
                        18,
                        1_560_200,
                        148_700,
                        9_140,
                        47_300,
                        "94'",
                        "#22c55e",
                        "#0ea5e9",
                        List.of(1)),
                new Seed(
                        "One-handed catch with a foot on the line",
                        "Replay confirms it by about an inch. The toe drag is the whole play.",
                        2,
                        31,
                        List.of("football-us", "catch", "highlight"),
                        ReelStatus.PUBLISHED,
                        21,
                        431_500,
                        39_800,
                        1_620,
                        7_900,
                        "One Hand",
                        "#2563eb",
                        "#7c3aed",
                        List.of()),
                new Seed(
                        "Serve and volley on set point, in 2026",
                        "Nobody does this anymore, which is precisely why it works.",
                        4,
                        27,
                        List.of("tennis", "serve-volley", "set-point"),
                        ReelStatus.PUBLISHED,
                        26,
                        116_300,
                        9_800,
                        610,
                        1_400,
                        "S&V",
                        "#06b6d4",
                        "#8b5cf6",
                        List.of()),
                new Seed(
                        "Film room: why the drop coverage keeps failing",
                        "Four possessions, same read, same result. Needs the voiceover re-cut.",
                        0,
                        192,
                        List.of("basketball", "analysis", "film-room"),
                        ReelStatus.DRAFT,
                        1,
                        0,
                        0,
                        0,
                        0,
                        "Film Room",
                        "#475569",
                        "#1e293b",
                        List.of()),
                new Seed(
                        "Season opener preview: three things to watch",
                        "Scheduled to go out the morning of the opener.",
                        2,
                        108,
                        List.of("football-us", "preview", "season-opener"),
                        ReelStatus.SCHEDULED,
                        2,
                        0,
                        0,
                        0,
                        0,
                        "Preview",
                        "#334155",
                        "#7c3aed",
                        List.of()),
                new Seed(
                        "Onboard: the lap that took pole by 0.004s",
                        "Waiting on a rights check before this can go out.",
                        3,
                        82,
                        List.of("motorsport", "onboard", "qualifying"),
                        ReelStatus.DRAFT,
                        4,
                        0,
                        0,
                        0,
                        0,
                        "Onboard",
                        "#7f1d1d",
                        "#f59e0b",
                        List.of()),
                new Seed(
                        "Last season in ninety seconds",
                        "Archived once the new season started — kept for the back catalogue.",
                        1,
                        90,
                        List.of("football", "recap", "season"),
                        ReelStatus.ARCHIVED,
                        210,
                        298_400,
                        21_300,
                        870,
                        4_100,
                        "Recap",
                        "#1e293b",
                        "#334155",
                        List.of()));

        List<Reel> saved = new ArrayList<>();
        for (Seed s : seeds) {
            // The seed's "views" figure is now a POPULARITY WEIGHT: it decides how
            // many view events this reel gets, and the counters are derived from
            // those. Divided down so the whole seed is ~20k documents rather than
            // 7 million.
            popularityOut.add(s.status() == ReelStatus.PUBLISHED ? (int) Math.max(20, s.views() / 250) : 0);
            Creator creator = creators.get(s.creator());
            Instant when = Instant.now().minus(s.daysAgo(), ChronoUnit.DAYS);

            List<String> collectionIds = s.collections().stream()
                    .map(i -> collections.get(i).getId())
                    .toList();

            saved.add(reelRepository.save(Reel.builder()
                    .slug(slugService.slugify(s.title()))
                    .title(s.title())
                    .description(s.description())
                    .status(s.status())
                    .publishedAt(s.status() == ReelStatus.PUBLISHED || s.status() == ReelStatus.ARCHIVED ? when : null)
                    .scheduledFor(
                            s.status() == ReelStatus.SCHEDULED ? Instant.now().plus(3, ChronoUnit.DAYS) : null)
                    .video(VideoAsset.builder()
                            // No real files ship with the repo, so published reels get a
                            // poster and a null url. ReelPlayer renders the poster, which
                            // is the same path a reel takes in production between upload
                            // and transcode.
                            .url(null)
                            .posterUrl(poster(s.from(), s.to(), s.posterLabel(), formatDuration(s.duration())))
                            .durationSeconds(s.duration())
                            .width(1080)
                            .height(1920)
                            .sizeBytes(0)
                            .build())
                    .creator(CreatorRef.builder()
                            .id(creator.getId())
                            .username(creator.getUsername())
                            .displayName(creator.getDisplayName())
                            .avatarUrl(creator.getAvatarUrl())
                            .build())
                    .tags(new ArrayList<>(s.tags()))
                    .collectionIds(new ArrayList<>(collectionIds))
                    // Counters start at ZERO and are derived from the view events
                    // below - see reconcileStats(). Seeding an impressive-looking
                    // number here and a much smaller pile of events underneath it
                    // gives you a dashboard whose headline total disagrees with
                    // every panel on the same screen.
                    .stats(ReelStats.builder().build())
                    .build()));
        }
        return saved;
    }

    private void linkCollections(List<ReelCollection> collections, List<Reel> reels) {
        for (ReelCollection collection : collections) {
            List<String> ids = reels.stream()
                    .filter(r -> r.getCollectionIds().contains(collection.getId()))
                    .map(Reel::getId)
                    .toList();
            collection.setReelIds(new ArrayList<>(ids));
            collectionRepository.save(collection);
        }
    }

    /* --------------------------------------------------------------- comments */

    private void seedComments(List<Reel> reels) {
        List<String> bodies = List.of(
                "The footwork on the pivot is the part nobody talks about.",
                "Watched this twelve times and I still do not understand the angle.",
                "Commentator completely losing it is half the clip.",
                "This is going straight into the end-of-season package.",
                "Genuinely do not know how that stayed in.",
                "Whoever cut this deserves a raise, the timing on the slow-mo is perfect.",
                "The defender's reaction at 0:14 says everything.",
                "Somebody explain the physics here because I refuse to accept it.");
        List<String> names = List.of("Mark", "Priya", "Dee", "Tam", "Jules", "Ade");

        List<Comment> batch = new ArrayList<>();
        int i = 0;
        for (Reel reel : reels) {
            if (reel.getStatus() != ReelStatus.PUBLISHED) {
                continue;
            }
            int count = 3 + (i % 4);
            for (int n = 0; n < count; n++) {
                String name = names.get((i + n) % names.size());
                batch.add(Comment.builder()
                        .reelId(reel.getId())
                        .author(CreatorRef.builder()
                                .username(name.toLowerCase())
                                .displayName(name)
                                .avatarUrl(AvatarFactory.forName(name))
                                .build())
                        .body(bodies.get((i * 3 + n) % bodies.size()))
                        .likes(random.nextInt(240))
                        .build());
            }
            i++;
        }
        commentRepository.saveAll(batch);
    }

    /* ----------------------------------------------------------- view events */

    /**
     * Generates 30 days of playback events, then derives every counter from them.
     *
     * <p>THE COUNTERS ARE NOT SEEDED INDEPENDENTLY, and that is the point. It is tempting to give
     * each reel a big round "1,240,600 views" so the demo looks busy, and then insert a few
     * thousand events underneath it because seeding a million documents is slow. Do that and the
     * dashboard shows a headline total of 7.5M above a "top reels" table whose best row reads 390 -
     * two numbers on one screen that cannot both be true. In an app whose whole claim is that every
     * figure comes from a real aggregation, that is the one inconsistency you cannot ship.
     *
     * <p>So: events are generated from a popularity weight, and stats.views is then set to the
     * number of events actually inserted. The numbers are smaller than a real product's. They are
     * also all true, and they all agree with each other.
     */
    private void seedViewEvents(List<Reel> reels, List<Integer> popularity) {
        final int days = 30;

        List<ViewEvent> batch = new ArrayList<>();
        Instant now = Instant.now();

        for (int i = 0; i < reels.size(); i++) {
            Reel reel = reels.get(i);
            if (reel.getStatus() != ReelStatus.PUBLISHED) {
                continue;
            }
            int total = popularity.get(i);
            int duration = Math.max(1, reel.getVideo().getDurationSeconds());

            for (int n = 0; n < total; n++) {
                // Weighted towards recent days, so the chart has a visible trend
                // rather than a flat line.
                int dayOffset = (int) (days * Math.pow(random.nextDouble(), 1.6));
                Instant ts = now.minus(dayOffset, ChronoUnit.DAYS).minus(random.nextInt(24 * 60), ChronoUnit.MINUTES);

                batch.add(ViewEvent.builder()
                        .ts(ts)
                        .metadata(ViewEvent.ViewMetadata.builder()
                                .reelId(reel.getId())
                                .creatorId(reel.getCreator().getId())
                                .country(random.nextBoolean() ? "US" : "GB")
                                .device(random.nextInt(3) == 0 ? "desktop" : "mobile")
                                .build())
                        // Watch time skewed high - most people finish a short clip.
                        .watchSeconds((int) Math.round(duration * (0.35 + random.nextDouble() * 0.75)))
                        .build());
            }
        }

        // One insert call rather than one per document. Against a time-series
        // collection that is the difference between a second and a minute.
        if (!batch.isEmpty()) {
            mongo.insert(batch, ViewEvent.class);
        }
        log.info("Seeded {} view events", batch.size());
    }

    /**
     * Sets each reel's embedded counters from the events and comments that actually exist, so the
     * read model and the event log agree. This is the same reconciliation a production system runs
     * on a schedule to repair counter drift.
     */
    private void reconcileStats(List<Reel> reels, List<Integer> popularity) {
        for (int i = 0; i < reels.size(); i++) {
            Reel reel = reels.get(i);
            if (reel.getStatus() != ReelStatus.PUBLISHED) {
                continue;
            }
            long views = popularity.get(i);
            reel.setStats(ReelStats.builder()
                    .views(views)
                    // Plausible engagement ratios rather than invented totals:
                    // roughly 9% like, 0.6% comment, 1.8% share.
                    .likes(Math.round(views * 0.09))
                    .comments(commentRepository
                            .findByReelIdOrderByCreatedAtDesc(reel.getId(), PageRequest.of(0, 100))
                            .size())
                    .shares(Math.round(views * 0.018))
                    .build());
            reelRepository.save(reel);
        }
    }

    /* ------------------------------------------------------------------ users */

    private void seedUsers(List<Creator> creators) {
        userRepository.save(User.builder()
                .email("admin@reelcms.test")
                .passwordHash(passwordEncoder.encode("admin123"))
                .displayName("Site Admin")
                .roles(new ArrayList<>(List.of("ADMIN")))
                .build());

        userRepository.save(User.builder()
                .email("creator@reelcms.test")
                .passwordHash(passwordEncoder.encode("creator123"))
                .displayName("Hoops Daily")
                .roles(new ArrayList<>(List.of("CREATOR")))
                .creatorId(creators.get(0).getId())
                .build());
    }

    /* ---------------------------------------------------------------- helpers */

    private String poster(String from, String to, String label, String sub) {
        String svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920' viewBox='0 0 1080 1920'>"
                        + "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
                        + "<stop offset='0%%' stop-color='%s'/><stop offset='100%%' stop-color='%s'/>"
                        + "</linearGradient></defs>"
                        + "<rect width='1080' height='1920' fill='url(#g)'/>"
                        + "<circle cx='880' cy='300' r='240' fill='rgba(255,255,255,0.08)'/>"
                        + "<circle cx='150' cy='1640' r='330' fill='rgba(0,0,0,0.12)'/>"
                        + "<text x='540' y='940' text-anchor='middle' font-family='Inter, system-ui, sans-serif' "
                        + "font-size='96' font-weight='800' fill='rgba(255,255,255,0.96)'>%s</text>"
                        + "<text x='540' y='1040' text-anchor='middle' font-family='Inter, system-ui, sans-serif' "
                        + "font-size='46' font-weight='500' fill='rgba(255,255,255,0.72)'>%s</text></svg>")
                // escaped(): "4th & Inches" contains a raw ampersand, which makes the SVG
                // malformed and the data URI silently render as a broken image.
                .formatted(from, to, escaped(label), escaped(sub));
        return "data:image/svg+xml;charset=utf-8,"
                + URLEncoder.encode(svg, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String escaped(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private String formatDuration(int seconds) {
        return "%d:%02d".formatted(seconds / 60, seconds % 60);
    }
}
