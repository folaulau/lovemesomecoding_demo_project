package com.reelcms.api.entity.viewevent;

import com.reelcms.api.config.Timestamps;
import com.reelcms.api.entity.reel.Reel;
import com.reelcms.api.entity.reel.ReelDAO;
import com.reelcms.api.entity.reel.ReelRepository;
import com.reelcms.api.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

/**
 * Records a playback.
 *
 * <p>Two writes, on purpose, and the split is the design:
 *
 * <ul>
 *   <li>an append to the view_events TIME-SERIES collection — the durable fact, kept for 90 days
 *       and aggregated by every dashboard report
 *   <li>an $inc of the reel's embedded counter — the READ MODEL, so the feed can show a view count
 *       without aggregating 30 million events on every render
 * </ul>
 *
 * <p>They can drift, and that is accepted: a view count is a vanity number, not a ledger. If it had
 * to be exact you would rebuild it from the events on a schedule rather than pay for a transaction
 * on the hot path.
 */
@Service
@RequiredArgsConstructor
public class ViewEventService {

    private final MongoTemplate mongo;
    private final ReelRepository reelRepository;
    private final ReelDAO reelDAO;

    public void record(String reelId, int watchSeconds, String country, String device) {
        Reel reel = reelRepository.findById(reelId).orElseThrow(() -> ApiException.notFound("Reel"));

        mongo.insert(ViewEvent.builder()
                .ts(Timestamps.now())
                .metadata(ViewEvent.ViewMetadata.builder()
                        .reelId(reelId)
                        .creatorId(reel.getCreator().getId())
                        .country(country)
                        .device(device)
                        .build())
                .watchSeconds(Math.max(0, watchSeconds))
                .build());

        // This $inc is what the change stream in ReelStatsStreamService picks up and
        // pushes to the dashboard - the live counter is a side effect of this line.
        reelDAO.incrementStat(reelId, "views", 1);
    }
}
