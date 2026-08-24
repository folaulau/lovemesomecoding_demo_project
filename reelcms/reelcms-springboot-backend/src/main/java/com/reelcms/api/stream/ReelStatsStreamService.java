package com.reelcms.api.stream;

import com.mongodb.client.model.changestream.ChangeStreamDocument;
import com.mongodb.client.model.changestream.FullDocument;
import com.reelcms.api.dto.Dtos.StatsEventDto;
import com.reelcms.api.entity.reel.Reel;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.messaging.ChangeStreamRequest;
import org.springframework.data.mongodb.core.messaging.DefaultMessageListenerContainer;
import org.springframework.data.mongodb.core.messaging.MessageListener;
import org.springframework.data.mongodb.core.messaging.MessageListenerContainer;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Pushes view-count changes to the admin dashboard live, using a MongoDB CHANGE STREAM.
 *
 * <p>A change stream is a tailable cursor over the replica set's oplog. Mongo hands you every write
 * as it is committed, with no polling and no application-level bus. It is the single most
 * underused feature in MongoDB and the reason this dashboard needs no websocket server.
 *
 * <p>THREE THINGS THAT WILL BITE YOU:
 *
 * <ol>
 *   <li>IT REQUIRES A REPLICA SET. A standalone mongod has no oplog, and the failure is
 *       {@code The $changeStream stage is only supported on replica sets}. docker-compose.yml runs
 *       a single-node set precisely for this.
 *   <li>THE DEFAULT EVENT HAS NO DOCUMENT. An update event carries only the changed fields unless
 *       you ask for {@code fullDocument: updateLookup}, which makes Mongo re-read the document.
 *       Without it, getBody() is null on every update and the cause is not obvious.
 *   <li>IT IS A BLOCKING CURSOR. Spring Data's MessageListenerContainer runs it on its own thread,
 *       which is why this uses that rather than iterating the cursor inline - doing the latter in a
 *       @PostConstruct hangs startup forever.
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReelStatsStreamService {

    private final MongoTemplate mongoTemplate;

    private MessageListenerContainer container;
    private final AtomicBoolean running = new AtomicBoolean(false);

    /** Connected dashboards. CopyOnWriteArrayList because it is read far more than written. */
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** Last seen view count per reel, so an event can report the DELTA and not just the total. */
    private final Map<String, Long> lastViews = new ConcurrentHashMap<>();

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        try {
            container = new DefaultMessageListenerContainer(mongoTemplate);

            primeBaseline();

            MessageListener<ChangeStreamDocument<Document>, Reel> listener =
                    message -> onReelChanged(message.getBody());

            var request = ChangeStreamRequest.builder(listener)
                    .collection("reels")
                    // Filter SERVER-SIDE, so unrelated writes are never shipped to this
                    // process at all.
                    //
                    // Note this is the filter(Document...) overload, NOT filter(Aggregation).
                    // The Aggregation form runs the pipeline through Spring Data's field
                    // mapper against the domain type - and `operationType` is a field of the
                    // CHANGE EVENT, not of Reel, so the mapper rewrites it into something
                    // that matches nothing. The stream then opens cleanly and delivers
                    // silence, which is a genuinely miserable thing to debug.
                    .filter(new Document(
                            "$match", new Document("operationType", new Document("$in", List.of("update", "replace")))))
                    // See point 2 in the class comment - without updateLookup the body is null.
                    .fullDocumentLookup(FullDocument.UPDATE_LOOKUP)
                    .build();

            container.start();
            // The ErrorHandler overload matters: without it a failure inside the cursor
            // is swallowed and the stream just stops delivering.
            container.register(request, Reel.class, error -> log.error("Change stream error", error));

            log.info("Change stream on `reels` started");
        } catch (Exception ex) {
            running.set(false);
            // A dashboard without live counters is a degraded feature, not a dead app -
            // so this logs and moves on rather than failing startup.
            log.warn("Could not start the change stream (is MongoDB a replica set?): {}", ex.getMessage());
        }
    }

    /**
     * Seeds the per-reel view baseline from the current state.
     *
     * <p>Without this the FIRST change event for each reel has nothing to compare against, so its
     * delta is unknowable and the event is dropped. On a quiet site that is the one view someone
     * was watching the dashboard for.
     */
    private void primeBaseline() {
        for (Reel reel : mongoTemplate.findAll(Reel.class)) {
            if (reel.getStats() != null) {
                lastViews.put(reel.getId(), reel.getStats().getViews());
            }
        }
    }

    private void onReelChanged(Reel reel) {
        if (reel == null || reel.getStats() == null) {
            return;
        }
        long views = reel.getStats().getViews();
        Long previous = lastViews.put(reel.getId(), views);
        long delta = previous == null ? 0 : views - previous;
        if (delta <= 0) {
            // Only view increases are interesting to the live panel; a title edit also
            // arrives here and should not flash a counter.
            return;
        }
        broadcast(new StatsEventDto(reel.getId(), reel.getSlug(), reel.getTitle(), views, delta));
    }

    public SseEmitter subscribe() {
        // 0L = no timeout. The default is 30s, after which the browser reconnects and
        // the server logs an AsyncRequestTimeoutException every half minute forever.
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        try {
            // An immediate frame so the browser's EventSource opens rather than sitting
            // in CONNECTING until the first real event.
            emitter.send(SseEmitter.event().name("open").data("connected"));
        } catch (IOException ignored) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    private void broadcast(StatsEventDto event) {
        for (SseEmitter emitter : emitters) {
            try {
                // The event NAME must match the client's addEventListener("stats", ...).
                // Send it unnamed and the listener never fires, while onmessage would -
                // a mismatch with no error on either side.
                emitter.send(SseEmitter.event().name("stats").data(event));
            } catch (Exception ex) {
                // A disconnected browser throws on the next send. Expected, not an error.
                emitters.remove(emitter);
            }
        }
    }

    @PreDestroy
    public void stop() {
        if (container != null) {
            container.stop();
        }
        emitters.forEach(SseEmitter::complete);
        emitters.clear();
    }
}
