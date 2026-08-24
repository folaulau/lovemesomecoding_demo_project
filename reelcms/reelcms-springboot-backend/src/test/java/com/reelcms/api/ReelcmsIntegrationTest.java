package com.reelcms.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.reelcms.api.dto.Dtos.CreatorRequest;
import com.reelcms.api.dto.Dtos.ReelRequest;
import com.reelcms.api.dto.Dtos.StatusRequest;
import com.reelcms.api.dto.Dtos.VideoDto;
import com.reelcms.api.entity.comment.CommentRepository;
import com.reelcms.api.entity.comment.CommentService;
import com.reelcms.api.entity.creator.Creator;
import com.reelcms.api.entity.creator.CreatorRepository;
import com.reelcms.api.entity.creator.CreatorService;
import com.reelcms.api.entity.reel.Reel;
import com.reelcms.api.entity.reel.ReelDAO;
import com.reelcms.api.entity.reel.ReelRepository;
import com.reelcms.api.entity.reel.ReelService;
import com.reelcms.api.entity.reel.ReelStatus;
import com.reelcms.api.entity.viewevent.ViewEventService;
import com.reelcms.api.exception.ApiException;
import com.reelcms.api.report.ReportService;
import com.reelcms.api.security.AuthPrincipal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

/**
 * Integration tests against a REAL MongoDB.
 *
 * <p>No embedded/in-memory Mongo on purpose. Almost everything worth testing here is behaviour of
 * the actual server - $inc atomicity, $lookup type matching, text-index ranking, time-series
 * inserts and change streams. A fake would either not implement them or implement them differently,
 * which is the opposite of useful.
 *
 * <p>REQUIRES {@code docker compose up -d} from the project root. Every test writes into a
 * throwaway {@code reelcms_test} database and clears it first, so it never touches the demo data.
 * Both the uri and the database property are overridden - see the annotation for why one is not
 * enough.
 */
@SpringBootTest(
        properties = {
            "spring.mongodb.uri=mongodb://localhost:27018/reelcms_test?replicaSet=rs0",
            // Set explicitly as well as in the URI. If application.properties ever
            // reintroduces spring.mongodb.database, that property silently wins over
            // the URI's database - and these tests, which delete everything in
            // @BeforeEach, would run against the live demo database. Belt and braces
            // on a mistake whose blast radius is "all the data".
            "spring.mongodb.database=reelcms_test",
        })
class ReelcmsIntegrationTest {

    @Autowired
    ReelService reelService;

    @Autowired
    ReelDAO reelDAO;

    @Autowired
    CreatorService creatorService;

    @Autowired
    CommentService commentService;

    @Autowired
    ViewEventService viewEventService;

    @Autowired
    ReportService reportService;

    @Autowired
    ReelRepository reelRepository;

    @Autowired
    CreatorRepository creatorRepository;

    @Autowired
    CommentRepository commentRepository;

    @Autowired
    MongoTemplate mongo;

    private AuthPrincipal admin;
    private AuthPrincipal creatorUser;
    private Creator creatorA;
    private Creator creatorB;

    @BeforeEach
    void setUp() {
        // Only the documents, not the collections: dropping view_events would take
        // its time-series options with it and the next insert would silently
        // recreate it as an ordinary collection.
        mongo.remove(new Query(), Reel.class);
        mongo.remove(new Query(), Creator.class);
        mongo.getCollection("comments").deleteMany(new org.bson.Document());
        mongo.getCollection("view_events").deleteMany(new org.bson.Document());

        creatorA = creatorRepository.save(Creator.builder()
                .username("creator-a")
                .displayName("Creator A")
                .bio("")
                .build());
        creatorB = creatorRepository.save(Creator.builder()
                .username("creator-b")
                .displayName("Creator B")
                .bio("")
                .build());

        admin = new AuthPrincipal("admin-id", "admin@test", List.of("ADMIN"), null);
        creatorUser = new AuthPrincipal("creator-id", "a@test", List.of("CREATOR"), creatorA.getId());
    }

    private VideoDto video() {
        return new VideoDto("/media/videos/x.mp4", "/media/posters/x.jpg", 30, 1080, 1920, 1024);
    }

    private ReelRequest request(String title, ReelStatus status, String creatorId, List<String> tags) {
        return new ReelRequest(title, null, "A description.", status, null, creatorId, tags, List.of(), video());
    }

    /* --------------------------------------------------------------- modelling */

    @Test
    @DisplayName("the creator snapshot is embedded on the reel at create time")
    void embedsCreatorSnapshot() {
        var reel = reelService.create(request("Snapshot test", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);

        assertThat(reel.creator().id()).isEqualTo(creatorA.getId());
        assertThat(reel.creator().displayName()).isEqualTo("Creator A");
        assertThat(reel.creator().username()).isEqualTo("creator-a");
    }

    @Test
    @DisplayName("renaming a creator fans the new snapshot out over all their reels")
    void renameFansOut() {
        reelService.create(request("One", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        reelService.create(request("Two", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        reelService.create(request("Other owner", ReelStatus.PUBLISHED, creatorB.getId(), List.of()), admin);

        creatorService.update(creatorA.getId(), new CreatorRequest("Creator A Renamed", "creator-a-renamed", "bio"));

        var theirs = reelRepository.findAll().stream()
                .filter(r -> r.getCreator().getId().equals(creatorA.getId()))
                .toList();
        assertThat(theirs).hasSize(2);
        assertThat(theirs).allSatisfy(r -> {
            assertThat(r.getCreator().getDisplayName()).isEqualTo("Creator A Renamed");
            assertThat(r.getCreator().getUsername()).isEqualTo("creator-a-renamed");
        });

        // ...and crucially, the OTHER creator's reel is untouched.
        var others = reelRepository.findAll().stream()
                .filter(r -> r.getCreator().getId().equals(creatorB.getId()))
                .toList();
        assertThat(others)
                .singleElement()
                .satisfies(r -> assertThat(r.getCreator().getDisplayName()).isEqualTo("Creator B"));
    }

    @Test
    @DisplayName("comments live in their own collection, not on the reel")
    void commentsAreReferencedNotEmbedded() {
        var reel = reelService.create(request("Commented", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);

        commentService.add(reel.id(), "First!");
        commentService.add(reel.id(), "Second!");

        // The reel document has no comments array at all...
        var raw = mongo.getCollection("reels")
                .find(new org.bson.Document("slug", reel.slug()))
                .first();
        assertThat(raw).isNotNull();
        assertThat(raw.get("comments")).isNull();

        // ...but the counter on it was kept in step, and the thread reads back.
        assertThat(commentService.forReel(reel.id())).hasSize(2);
        assertThat(reelRepository.findById(reel.id()).orElseThrow().getStats().getComments())
                .isEqualTo(2);
    }

    @Test
    @DisplayName("deleting a reel also deletes its comments — there is no cascade in MongoDB")
    void deleteRemovesOrphanComments() {
        var reel = reelService.create(request("Doomed", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        commentService.add(reel.id(), "Soon to be an orphan");
        assertThat(commentRepository.count()).isEqualTo(1);

        reelService.delete(reel.id(), admin);

        assertThat(reelRepository.findById(reel.id())).isEmpty();
        assertThat(commentRepository.count()).isZero();
    }

    /* ----------------------------------------------------------------- counters */

    @Test
    @DisplayName("$inc moves the counter without rewriting the document")
    void incrementsAtomically() {
        var reel = reelService.create(request("Counted", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);

        for (int i = 0; i < 5; i++) {
            reelDAO.incrementStat(reel.id(), "views", 1);
        }

        assertThat(reelRepository.findById(reel.id()).orElseThrow().getStats().getViews())
                .isEqualTo(5);
    }

    @Test
    @DisplayName("concurrent increments do not lose updates")
    void concurrentIncrementsAllLand() throws Exception {
        var reel = reelService.create(request("Contended", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);

        // The read-modify-write version of this loses increments here; $inc does not.
        int threads = 8;
        int perThread = 25;
        var pool = java.util.concurrent.Executors.newFixedThreadPool(threads);
        var latch = new java.util.concurrent.CountDownLatch(threads);
        for (int t = 0; t < threads; t++) {
            pool.submit(() -> {
                try {
                    for (int i = 0; i < perThread; i++) {
                        reelDAO.incrementStat(reel.id(), "views", 1);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await(30, java.util.concurrent.TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(reelRepository.findById(reel.id()).orElseThrow().getStats().getViews())
                .isEqualTo((long) threads * perThread);
    }

    /* ------------------------------------------------------------------- feed */

    @Test
    @DisplayName("the cursor feed pages without skipping or repeating a reel")
    void cursorPagingIsStable() {
        for (int i = 0; i < 7; i++) {
            reelService.create(request("Reel " + i, ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        }

        var first = reelService.feed(null, 3);
        assertThat(first.items()).hasSize(3);
        assertThat(first.nextCursor()).isNotNull();

        var second = reelService.feed(first.nextCursor(), 3);
        var third = reelService.feed(second.nextCursor(), 3);

        var seen = java.util.stream.Stream.of(first, second, third)
                .flatMap(p -> p.items().stream())
                .map(r -> r.id())
                .toList();

        assertThat(seen).hasSize(7).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("only PUBLISHED reels reach the public feed")
    void feedHidesUnpublished() {
        reelService.create(request("Live", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        reelService.create(request("Draft", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);
        reelService.create(request("Archived", ReelStatus.ARCHIVED, creatorA.getId(), List.of()), admin);

        assertThat(reelService.feed(null, 20).items()).singleElement().satisfies(r -> assertThat(r.title())
                .isEqualTo("Live"));
    }

    @Test
    @DisplayName("an unpublished slug returns 404, not 403 — it must not confirm the reel exists")
    void unpublishedSlugIs404() {
        var draft = reelService.create(request("Secret", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);

        assertThatThrownBy(() -> reelService.bySlug(draft.slug()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    /* ----------------------------------------------------------------- search */

    @Test
    @DisplayName("the text index ranks a title match above a description-only match")
    void textSearchRanksByWeight() {
        reelService.create(
                new ReelRequest(
                        "Buzzer beater from halfway",
                        null,
                        "An ordinary description.",
                        ReelStatus.PUBLISHED,
                        null,
                        creatorA.getId(),
                        List.of(),
                        List.of(),
                        video()),
                admin);
        reelService.create(
                new ReelRequest(
                        "An ordinary title",
                        null,
                        "This one only mentions buzzer in the description.",
                        ReelStatus.PUBLISHED,
                        null,
                        creatorA.getId(),
                        List.of(),
                        List.of(),
                        video()),
                admin);

        var results = reelService.publicSearch("buzzer", null, 1, 10);

        assertThat(results.totalElements()).isEqualTo(2);
        // title weight 10 beats description weight 5
        assertThat(results.content().get(0).title()).isEqualTo("Buzzer beater from halfway");
    }

    @Test
    @DisplayName("tag filtering uses the multikey index and matches exactly")
    void filtersByTag() {
        reelService.create(
                request("Tagged", ReelStatus.PUBLISHED, creatorA.getId(), List.of("basketball", "dunk")), admin);
        reelService.create(request("Untagged", ReelStatus.PUBLISHED, creatorA.getId(), List.of("tennis")), admin);

        assertThat(reelService.publicSearch(null, "basketball", 1, 10).totalElements())
                .isEqualTo(1);
        assertThat(reelService.publicSearch(null, "nothing-here", 1, 10).totalElements())
                .isZero();
    }

    @Test
    @DisplayName("tags are slugified on write, so two spellings cannot become two tags")
    void normalisesTags() {
        var reel = reelService.create(
                request(
                        "Normalised",
                        ReelStatus.PUBLISHED,
                        creatorA.getId(),
                        List.of("Buzzer Beater", "buzzer beater", "NBA")),
                admin);

        assertThat(reel.tags()).containsExactly("buzzer-beater", "nba");
    }

    /* ------------------------------------------------------------ authorisation */

    @Test
    @DisplayName("a creator cannot edit another creator's reel")
    void creatorCannotTouchAnotherCreatorsReel() {
        var theirs = reelService.create(request("Not yours", ReelStatus.DRAFT, creatorB.getId(), List.of()), admin);

        assertThatThrownBy(() -> reelService.delete(theirs.id(), creatorUser))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("your own");
    }

    @Test
    @DisplayName("a creator can manage their own reel")
    void creatorCanManageTheirOwn() {
        var mine = reelService.create(request("Mine", ReelStatus.DRAFT, creatorA.getId(), List.of()), creatorUser);

        var published = reelService.setStatus(mine.id(), new StatusRequest(ReelStatus.PUBLISHED), creatorUser);

        assertThat(published.status()).isEqualTo(ReelStatus.PUBLISHED);
        assertThat(published.publishedAt()).isNotNull();
    }

    @Test
    @DisplayName("publishing without a video is refused")
    void cannotPublishWithoutAVideo() {
        var request = new ReelRequest(
                "No media", null, "", ReelStatus.PUBLISHED, null, creatorA.getId(), List.of(), List.of(), null);

        assertThatThrownBy(() -> reelService.create(request, admin))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Upload a video");
    }

    @Test
    @DisplayName("publishedAt is stamped once and never moved by a later edit")
    void publishedAtIsStable() {
        var reel = reelService.create(request("Stamped", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        var firstStamp = reel.publishedAt();

        var edited = reelService.update(
                reel.id(), request("Stamped, retitled", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);

        assertThat(edited.publishedAt()).isEqualTo(firstStamp);
    }

    @Test
    @DisplayName("a timestamp read back from Mongo equals the one the write returned")
    void timestampsSurviveTheRoundTrip() {
        // BSON keeps milliseconds; Instant.now() carries microseconds. Without the
        // truncation in Timestamps, the value in the POST response and the value in
        // a subsequent GET differ by a few hundred microseconds - which nothing
        // reports, and which breaks any client comparing them.
        var created =
                reelService.create(request("Round trip", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);

        var reread = reelService.adminById(created.id());

        assertThat(reread.publishedAt()).isEqualTo(created.publishedAt());
        assertThat(reread.createdAt()).isEqualTo(created.createdAt());
        assertThat(reread.updatedAt()).isEqualTo(created.updatedAt());
    }

    @Test
    @DisplayName("duplicate titles get distinct slugs")
    void slugsStayUnique() {
        var a = reelService.create(request("Same title", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);
        var b = reelService.create(request("Same title", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);

        assertThat(a.slug()).isEqualTo("same-title");
        assertThat(b.slug()).isEqualTo("same-title-2");
    }

    /* ----------------------------------------------------------------- reports */

    @Test
    @DisplayName("the aggregation pipelines read back the events they were given")
    void reportsAggregateRealEvents() {
        var reel =
                reelService.create(request("Measured", ReelStatus.PUBLISHED, creatorA.getId(), List.of("nba")), admin);

        // 30-second reel; 27s watched is 90%, so each of these is a completion.
        for (int i = 0; i < 6; i++) {
            viewEventService.record(reel.id(), 27, "US", "mobile");
        }
        // ...and these are not.
        for (int i = 0; i < 4; i++) {
            viewEventService.record(reel.id(), 3, "GB", "desktop");
        }

        var report = reportService.dashboard();

        assertThat(report.totals().totalViews()).isEqualTo(10);
        assertThat(report.viewsOverTime()).isNotEmpty();
        assertThat(report.viewsOverTime().stream().mapToLong(d -> d.views()).sum())
                .isEqualTo(10);
        assertThat(report.viewsOverTime().stream()
                        .mapToLong(d -> d.completions())
                        .sum())
                .isEqualTo(6);

        // $lookup only matches because metadata.reelId is stored as an ObjectId.
        assertThat(report.topReels()).singleElement().satisfies(r -> {
            assertThat(r.title()).isEqualTo("Measured");
            assertThat(r.views()).isEqualTo(10);
        });

        assertThat(report.engagementByTag()).anySatisfy(t -> assertThat(t.tag()).isEqualTo("nba"));
    }

    @Test
    @DisplayName("view events land in the time-series collection with an ObjectId reference")
    void viewEventsAreStoredForJoining() {
        var reel = reelService.create(request("Joined", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        viewEventService.record(reel.id(), 10, "US", "mobile");

        var raw = mongo.getCollection("view_events").find().first();
        assertThat(raw).isNotNull();
        var metadata = (org.bson.Document) raw.get("metadata");

        // If this is a String, every $lookup in ReportDAOImp silently returns nothing.
        assertThat(metadata.get("reelId")).isInstanceOf(org.bson.types.ObjectId.class);
        assertThat(metadata.get("reelId").toString()).isEqualTo(reel.id());
    }

    @Test
    @DisplayName("status breakdown counts every state")
    void statusBreakdownIsComplete() {
        reelService.create(request("P", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        reelService.create(request("D1", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);
        reelService.create(request("D2", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);

        var breakdown = reportService.dashboard().statusBreakdown();

        assertThat(breakdown).hasSize(ReelStatus.values().length);
        assertThat(breakdown).anySatisfy(s -> {
            assertThat(s.status()).isEqualTo(ReelStatus.DRAFT);
            assertThat(s.count()).isEqualTo(2);
        });
    }

    /* ------------------------------------------------------------------ admin */

    @Test
    @DisplayName("the admin list filters by status and creator together")
    void adminSearchFilters() {
        reelService.create(request("A published", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);
        reelService.create(request("A draft", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);
        reelService.create(request("B draft", ReelStatus.DRAFT, creatorB.getId(), List.of()), admin);

        assertThat(reelService.adminSearch(null, null, null, 1, 10).totalElements())
                .isEqualTo(3);
        assertThat(reelService.adminSearch(null, ReelStatus.DRAFT, null, 1, 10).totalElements())
                .isEqualTo(2);
        assertThat(reelService
                        .adminSearch(null, ReelStatus.DRAFT, creatorA.getId(), 1, 10)
                        .totalElements())
                .isEqualTo(1);
    }

    @Test
    @DisplayName("the admin search box matches a partial word, unlike the text index")
    void adminSearchMatchesPrefixes() {
        reelService.create(request("Fadeaway jumper", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);

        // $text would need the whole word "fadeaway"; the admin filter is a regex
        // so it matches as you type.
        assertThat(reelService.adminSearch("fade", null, null, 1, 10).totalElements())
                .isEqualTo(1);
    }

    @Test
    @DisplayName("a regex metacharacter in the search box is escaped, not executed")
    void adminSearchEscapesRegex() {
        reelService.create(request("Plain title", ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);

        // Unescaped, ".*" would match everything and "(" would throw
        // PatternSyntaxException. Both must be treated as literal text.
        assertThat(reelService.adminSearch(".*", null, null, 1, 10).totalElements())
                .isZero();
        assertThat(reelService.adminSearch("((", null, null, 1, 10).totalElements())
                .isZero();
    }

    @Test
    @DisplayName("paging reports the true total, not the page size")
    void pagingCountsTheWholeResult() {
        for (int i = 0; i < 12; i++) {
            reelService.create(request("Reel " + i, ReelStatus.DRAFT, creatorA.getId(), List.of()), admin);
        }

        var page = reelService.adminSearch(null, null, null, 1, 5);

        assertThat(page.content()).hasSize(5);
        assertThat(page.totalElements()).isEqualTo(12);
        assertThat(page.totalPages()).isEqualTo(3);
    }

    @Test
    @DisplayName("a unique index guards the creator username")
    void duplicateUsernameIsRejected() {
        assertThatThrownBy(() -> creatorService.create(new CreatorRequest("Clash", "creator-a", "")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already taken");
    }

    @Test
    void unknownCursorIsABadRequest() {
        assertThatThrownBy(() -> reelService.feed("507f1f77bcf86cd799439011", 3))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cursor");
    }

    @Test
    @DisplayName("indexes actually exist on the reels collection")
    void indexesAreCreated() {
        var names = mongo.indexOps("reels").getIndexInfo().stream()
                .map(i -> i.getName())
                .toList();

        // Names are derived from the fields, so this asserts the shape rather than
        // a literal string that a Spring Data upgrade could change.
        assertThat(names).anyMatch(n -> n.contains("status") && n.contains("publishedAt"));
        assertThat(names).anyMatch(n -> n.contains("slug"));
        assertThat(names).anyMatch(n -> n.contains("tags"));
        assertThat(names).anyMatch(n -> n.contains("text") || n.contains("title"));
    }

    @Test
    @DisplayName("the feed query is served by an index, with no in-memory sort")
    void feedQueryUsesTheIndex() {
        reelService.create(request("Indexed", ReelStatus.PUBLISHED, creatorA.getId(), List.of()), admin);

        var explain = mongo.getCollection("reels")
                .find(new org.bson.Document("status", "PUBLISHED"))
                .sort(new org.bson.Document("publishedAt", -1))
                .explain();

        // A SORT stage above the scan means the index is not covering the ordering,
        // and Mongo aborts the query outright once the result exceeds 32 MB.
        assertThat(explain.toJson()).contains("IXSCAN").doesNotContain("\"stage\": \"SORT\"");
    }
}
