package com.reelcms.api.entity.creator;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CreatorRepository extends MongoRepository<Creator, String> {

    Optional<Creator> findByUsername(String username);

    boolean existsByUsername(String username);
}
