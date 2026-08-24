package com.reelcms.api.entity.reelcollection;

import com.reelcms.api.dto.Dtos.CollectionDto;
import com.reelcms.api.dto.Dtos.CollectionPageDto;
import com.reelcms.api.dto.Dtos.CollectionRequest;
import java.util.List;

public interface ReelCollectionService {

    List<CollectionDto> list();

    CollectionPageDto bySlug(String slug);

    CollectionDto create(CollectionRequest request);

    CollectionDto update(String id, CollectionRequest request);

    void delete(String id);

    /** Rewrites this reel's membership on the collection side of the relationship. */
    void syncMembership(String reelId, List<String> collectionIds);

    void removeReelFromAll(String reelId);
}
