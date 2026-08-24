package com.reelcms.api.entity.creator;

import com.reelcms.api.dto.Dtos.CreatorAdminDto;
import com.reelcms.api.dto.Dtos.CreatorProfileDto;
import com.reelcms.api.dto.Dtos.CreatorRequest;
import com.reelcms.api.dto.EntityDtoMapper;
import com.reelcms.api.entity.reel.Reel;
import com.reelcms.api.entity.reel.ReelDAO;
import com.reelcms.api.entity.reel.ReelRepository;
import com.reelcms.api.entity.reel.ReelStatus;
import com.reelcms.api.entity.reel.SlugService;
import com.reelcms.api.exception.ApiException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreatorServiceImpl implements CreatorService {

    private final CreatorRepository creatorRepository;
    private final ReelRepository reelRepository;
    private final ReelDAO reelDAO;
    private final SlugService slugService;
    private final EntityDtoMapper mapper;

    @Override
    public CreatorProfileDto publicProfile(String username) {
        Creator creator =
                creatorRepository.findByUsername(username).orElseThrow(() -> ApiException.notFound("Creator"));
        List<Reel> reels =
                reelRepository.findByCreatorIdAndStatusOrderByPublishedAtDesc(creator.getId(), ReelStatus.PUBLISHED);
        return new CreatorProfileDto(mapper.toDto(creator), mapper.toReelDtos(reels));
    }

    @Override
    public List<CreatorAdminDto> adminList() {
        List<Creator> creators = creatorRepository.findAll();

        // One findAll() then group in memory, rather than two queries per creator inside
        // the loop. At demo scale either works; the N+1 version is the one that quietly
        // becomes 200 round trips once there are 100 creators, so it is worth writing
        // the right shape even where it does not yet matter.
        Map<String, List<Reel>> byCreator = reelRepository.findAll().stream()
                .collect(Collectors.groupingBy(r -> r.getCreator().getId()));

        return creators.stream()
                .map(c -> {
                    List<Reel> owned = byCreator.getOrDefault(c.getId(), List.of());
                    long views = owned.stream()
                            .mapToLong(r -> r.getStats().getViews())
                            .sum();
                    return new CreatorAdminDto(
                            c.getId(),
                            c.getUsername(),
                            c.getDisplayName(),
                            c.getAvatarUrl(),
                            c.getBio(),
                            c.getFollowerCount(),
                            c.getCreatedAt(),
                            owned.size(),
                            views);
                })
                .toList();
    }

    @Override
    public CreatorAdminDto create(CreatorRequest request) {
        String username = slugService.slugify(request.username());
        if (creatorRepository.existsByUsername(username)) {
            throw ApiException.conflict("That username is already taken.");
        }
        Creator saved = creatorRepository.save(Creator.builder()
                .username(username)
                .displayName(request.displayName())
                .bio(request.bio() == null ? "" : request.bio())
                .avatarUrl(AvatarFactory.forName(request.displayName()))
                .followerCount(0)
                .build());
        return toAdminDto(saved, 0, 0);
    }

    @Override
    public CreatorAdminDto update(String id, CreatorRequest request) {
        Creator creator = creatorRepository.findById(id).orElseThrow(() -> ApiException.notFound("Creator"));

        String username = slugService.slugify(request.username());
        if (!username.equals(creator.getUsername()) && creatorRepository.existsByUsername(username)) {
            throw ApiException.conflict("That username is already taken.");
        }

        creator.setUsername(username);
        creator.setDisplayName(request.displayName());
        creator.setBio(request.bio() == null ? "" : request.bio());
        Creator saved = creatorRepository.save(creator);

        // THE COST OF DENORMALIZATION, PAID HERE.
        //
        // Every reel carries a copy of this creator's username, display name and avatar
        // so the feed needs no $lookup. That copy is now stale on every reel they own,
        // and this is the write that fixes it.
        //
        // The trade is deliberate and worth stating plainly: reads are constant and
        // free, this write is O(reels owned) and rare. A profile is renamed perhaps
        // twice in its life; the feed is read millions of times. If the ratio were
        // reversed, the snapshot would be the wrong design.
        long touched = reelDAO.refreshCreatorSnapshot(
                saved.getId(), saved.getUsername(), saved.getDisplayName(), saved.getAvatarUrl());
        log.info("Refreshed creator snapshot on {} reel(s) for {}", touched, saved.getUsername());

        List<Reel> owned = reelRepository.findAll().stream()
                .filter(r -> r.getCreator().getId().equals(saved.getId()))
                .toList();
        return toAdminDto(
                saved,
                owned.size(),
                owned.stream().mapToLong(r -> r.getStats().getViews()).sum());
    }

    private CreatorAdminDto toAdminDto(Creator c, long reelCount, long totalViews) {
        return new CreatorAdminDto(
                c.getId(),
                c.getUsername(),
                c.getDisplayName(),
                c.getAvatarUrl(),
                c.getBio(),
                c.getFollowerCount(),
                c.getCreatedAt(),
                reelCount,
                totalViews);
    }
}
