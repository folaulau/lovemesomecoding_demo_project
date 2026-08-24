package com.reelcms.api.entity.reelcollection;

import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ReelCollectionRepository extends MongoRepository<ReelCollection, String> {

    Optional<ReelCollection> findBySlug(String slug);

    List<ReelCollection> findAllByOrderByCreatedAtAsc();
}
