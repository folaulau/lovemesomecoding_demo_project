package com.reelcms.api.entity.comment;

import com.reelcms.api.dto.Dtos.CommentDto;
import com.reelcms.api.dto.EntityDtoMapper;
import com.reelcms.api.entity.creator.AvatarFactory;
import com.reelcms.api.entity.reel.CreatorRef;
import com.reelcms.api.entity.reel.ReelDAO;
import com.reelcms.api.entity.reel.ReelRepository;
import com.reelcms.api.exception.ApiException;
import com.reelcms.api.security.AuthPrincipal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CommentServiceImpl implements CommentService {

    private final CommentRepository commentRepository;
    private final ReelRepository reelRepository;
    private final ReelDAO reelDAO;
    private final EntityDtoMapper mapper;

    /** A thread is paged, not unbounded - the reason comments are their own collection. */
    private static final int THREAD_PAGE_SIZE = 50;

    @Override
    public List<CommentDto> forReel(String reelId) {
        return commentRepository.findByReelIdOrderByCreatedAtDesc(reelId, PageRequest.of(0, THREAD_PAGE_SIZE)).stream()
                .map(mapper::toDto)
                .toList();
    }

    @Override
    public CommentDto add(String reelId, String body) {
        if (!reelRepository.existsById(reelId)) {
            throw ApiException.notFound("Reel");
        }

        Comment saved = commentRepository.save(Comment.builder()
                .reelId(reelId)
                .author(currentAuthor())
                .body(body.trim())
                .likes(0)
                .build());

        // Keep the denormalized counter in step. Two writes, not one - the price of
        // having a count the feed can read without a second query.
        reelDAO.incrementStat(reelId, "comments", 1);

        return mapper.toDto(saved);
    }

    /**
     * Comments are open to anonymous visitors, so this falls back to a "Guest" identity rather than
     * requiring a login. A real product wants an account here; the demo wants the comment box to
     * work without one.
     */
    private CreatorRef currentAuthor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal p) {
            return CreatorRef.builder()
                    .id(p.userId())
                    .username(p.email().split("@")[0])
                    .displayName(p.email().split("@")[0])
                    .avatarUrl(AvatarFactory.forName(p.email()))
                    .build();
        }
        return CreatorRef.builder()
                .id(null)
                .username("guest")
                .displayName("Guest")
                .avatarUrl(AvatarFactory.forName("Guest"))
                .build();
    }
}
