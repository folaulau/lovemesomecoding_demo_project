package com.reelcms.api.dto;

import com.reelcms.api.dto.Dtos.CollectionDto;
import com.reelcms.api.dto.Dtos.CommentDto;
import com.reelcms.api.dto.Dtos.CreatorDto;
import com.reelcms.api.dto.Dtos.CreatorRefDto;
import com.reelcms.api.dto.Dtos.ReelDto;
import com.reelcms.api.dto.Dtos.StatsDto;
import com.reelcms.api.dto.Dtos.UserDto;
import com.reelcms.api.dto.Dtos.VideoDto;
import com.reelcms.api.entity.comment.Comment;
import com.reelcms.api.entity.creator.Creator;
import com.reelcms.api.entity.reel.CreatorRef;
import com.reelcms.api.entity.reel.Reel;
import com.reelcms.api.entity.reel.ReelStats;
import com.reelcms.api.entity.reel.VideoAsset;
import com.reelcms.api.entity.reelcollection.ReelCollection;
import com.reelcms.api.entity.user.User;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * The one place documents become DTOs.
 *
 * <p>Hand-written rather than MapStruct, which is what the pizza backend uses. The reason is
 * specific to this app: a MapStruct mapper is generated code you cannot read next to the model, and
 * the whole point here is that a reader can see exactly which document fields reach the wire and
 * which do not - {@link User#getPasswordHash()} being the one that matters. Twenty lines of
 * obvious mapping beat a generated class for that.
 */
@Component
public class EntityDtoMapper {

    public ReelDto toDto(Reel r) {
        if (r == null) {
            return null;
        }
        return new ReelDto(
                r.getId(),
                r.getSlug(),
                r.getTitle(),
                r.getDescription(),
                r.getStatus(),
                r.getPublishedAt(),
                r.getScheduledFor(),
                toDto(r.getVideo()),
                toDto(r.getCreator()),
                r.getTags(),
                r.getCollectionIds(),
                toDto(r.getStats()),
                r.getCreatedAt(),
                r.getUpdatedAt());
    }

    public List<ReelDto> toReelDtos(List<Reel> reels) {
        return reels.stream().map(this::toDto).toList();
    }

    public VideoDto toDto(VideoAsset v) {
        if (v == null) {
            return new VideoDto(null, null, 0, 0, 0, 0);
        }
        return new VideoDto(
                v.getUrl(), v.getPosterUrl(), v.getDurationSeconds(), v.getWidth(), v.getHeight(), v.getSizeBytes());
    }

    public VideoAsset toEntity(VideoDto v) {
        if (v == null) {
            return VideoAsset.builder().build();
        }
        return VideoAsset.builder()
                .url(v.url())
                .posterUrl(v.posterUrl())
                .durationSeconds(v.durationSeconds())
                .width(v.width())
                .height(v.height())
                .sizeBytes(v.sizeBytes())
                .build();
    }

    public CreatorRefDto toDto(CreatorRef c) {
        return c == null ? null : new CreatorRefDto(c.getId(), c.getUsername(), c.getDisplayName(), c.getAvatarUrl());
    }

    public StatsDto toDto(ReelStats s) {
        if (s == null) {
            return new StatsDto(0, 0, 0, 0);
        }
        return new StatsDto(s.getViews(), s.getLikes(), s.getComments(), s.getShares());
    }

    public CreatorDto toDto(Creator c) {
        if (c == null) {
            return null;
        }
        return new CreatorDto(
                c.getId(),
                c.getUsername(),
                c.getDisplayName(),
                c.getAvatarUrl(),
                c.getBio(),
                c.getFollowerCount(),
                c.getCreatedAt());
    }

    /** The snapshot copied onto reels and comments. Three display fields plus the reference. */
    public CreatorRef toRef(Creator c) {
        return CreatorRef.builder()
                .id(c.getId())
                .username(c.getUsername())
                .displayName(c.getDisplayName())
                .avatarUrl(c.getAvatarUrl())
                .build();
    }

    public CommentDto toDto(Comment c) {
        return new CommentDto(
                c.getId(), c.getReelId(), toDto(c.getAuthor()), c.getBody(), c.getLikes(), c.getCreatedAt());
    }

    public CollectionDto toDto(ReelCollection c) {
        return new CollectionDto(
                c.getId(),
                c.getSlug(),
                c.getName(),
                c.getDescription(),
                c.getCoverUrl(),
                c.getReelIds(),
                c.getCreatedAt());
    }

    /** Note what is absent: passwordHash has no field to be copied into. */
    public UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getDisplayName(), u.getRoles(), u.getCreatorId());
    }
}
