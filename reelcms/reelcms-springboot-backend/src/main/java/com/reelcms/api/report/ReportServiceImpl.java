package com.reelcms.api.report;

import com.reelcms.api.dto.Dtos.ReportDto;
import com.reelcms.api.dto.Dtos.StatusCountDto;
import com.reelcms.api.dto.Dtos.TotalsDto;
import com.reelcms.api.entity.creator.CreatorRepository;
import com.reelcms.api.entity.reel.Reel;
import com.reelcms.api.entity.reel.ReelRepository;
import com.reelcms.api.entity.reel.ReelStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private final ReportDAO reportDAO;
    private final ReelRepository reelRepository;
    private final CreatorRepository creatorRepository;

    private static final Duration WINDOW = Duration.ofDays(30);
    private static final Duration WEEK = Duration.ofDays(7);

    @Override
    public ReportDto dashboard() {
        Instant now = Instant.now();
        Instant from = now.minus(WINDOW);

        var viewsOverTime = reportDAO.viewsOverTime(from);
        var topReels = reportDAO.topReels(from, 8);
        var byTag = reportDAO.engagementByTag(10);

        // The headline totals come from the reels themselves rather than from the event
        // log, because stats.* IS the maintained read model - see ViewEventService.
        List<Reel> all = reelRepository.findAll();
        List<Reel> published =
                all.stream().filter(r -> r.getStatus() == ReelStatus.PUBLISHED).toList();

        long viewsLast7 = reportDAO.viewsBetween(now.minus(WEEK), now);
        long viewsPrev7 = reportDAO.viewsBetween(now.minus(WEEK.multipliedBy(2)), now.minus(WEEK));

        var totals = new TotalsDto(
                all.size(),
                published.size(),
                published.stream().mapToLong(r -> r.getStats().getViews()).sum(),
                published.stream().mapToLong(r -> r.getStats().getLikes()).sum(),
                published.stream().mapToLong(r -> r.getStats().getComments()).sum(),
                creatorRepository.count(),
                reportDAO.averageCompletionRate(from),
                viewsLast7,
                viewsPrev7);

        var statusBreakdown = Arrays.stream(ReelStatus.values())
                .map(s -> new StatusCountDto(
                        s, all.stream().filter(r -> r.getStatus() == s).count()))
                .toList();

        return new ReportDto(viewsOverTime, topReels, byTag, totals, statusBreakdown);
    }
}
