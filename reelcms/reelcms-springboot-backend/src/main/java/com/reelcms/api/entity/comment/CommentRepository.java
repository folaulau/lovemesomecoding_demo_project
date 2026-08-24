package com.reelcms.api.entity.comment;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CommentRepository extends MongoRepository<Comment, String> {

    /** Served by the {reelId, createdAt} compound index - equality then sort. */
    List<Comment> findByReelIdOrderByCreatedAtDesc(String reelId, Pageable pageable);

    long deleteByReelId(String reelId);
}
