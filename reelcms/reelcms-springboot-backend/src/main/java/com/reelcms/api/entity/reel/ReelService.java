package com.reelcms.api.entity.reel;

import com.reelcms.api.dto.Dtos.FeedDto;
import com.reelcms.api.dto.Dtos.PageDto;
import com.reelcms.api.dto.Dtos.ReelDto;
import com.reelcms.api.dto.Dtos.ReelRequest;
import com.reelcms.api.dto.Dtos.StatusRequest;
import com.reelcms.api.security.AuthPrincipal;
import java.util.List;

public interface ReelService {

    FeedDto feed(String cursor, int limit);

    ReelDto bySlug(String slug);

    PageDto<ReelDto> publicSearch(String q, String tag, int page, int size);

    List<String> trendingTags();

    PageDto<ReelDto> adminSearch(String q, ReelStatus status, String creatorId, int page, int size);

    ReelDto adminById(String id);

    ReelDto create(ReelRequest request, AuthPrincipal actor);

    ReelDto update(String id, ReelRequest request, AuthPrincipal actor);

    ReelDto setStatus(String id, StatusRequest request, AuthPrincipal actor);

    void delete(String id, AuthPrincipal actor);

    long like(String reelId, boolean liked);
}
