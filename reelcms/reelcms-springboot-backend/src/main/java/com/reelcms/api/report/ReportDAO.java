package com.reelcms.api.report;

import com.reelcms.api.dto.Dtos.DailyViewsDto;
import com.reelcms.api.dto.Dtos.TagEngagementDto;
import com.reelcms.api.dto.Dtos.TopReelDto;
import java.time.Instant;
import java.util.List;

/**
 * The aggregation pipelines behind the dashboard.
 *
 * <p>Every number on that page comes from one of these, run against real data. No hard-coded
 * figures anywhere - the same rule the pizza backend follows for its reports.
 */
public interface ReportDAO {

    /** Every day from {@code from} to the present. Deliberately unbounded at the top - see the impl. */
    List<DailyViewsDto> viewsOverTime(Instant from);

    List<TopReelDto> topReels(Instant from, int limit);

    List<TagEngagementDto> engagementByTag(int limit);

    double averageCompletionRate(Instant from);

    long viewsBetween(Instant from, Instant to);
}
