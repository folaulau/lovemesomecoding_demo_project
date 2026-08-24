package com.reelcms.api.entity.reel;

import com.reelcms.api.config.Timestamps;
import com.reelcms.api.dto.Dtos.FeedDto;
import com.reelcms.api.dto.Dtos.PageDto;
import com.reelcms.api.dto.Dtos.ReelDto;
import com.reelcms.api.dto.Dtos.ReelRequest;
import com.reelcms.api.dto.Dtos.StatusRequest;
import com.reelcms.api.dto.EntityDtoMapper;
import com.reelcms.api.entity.comment.CommentRepository;
import com.reelcms.api.entity.creator.Creator;
import com.reelcms.api.entity.creator.CreatorRepository;
import com.reelcms.api.entity.reelcollection.ReelCollectionService;
import com.reelcms.api.exception.ApiException;
import com.reelcms.api.security.AuthPrincipal;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReelServiceImpl implements ReelService {

    private final ReelRepository reelRepository;
    private final ReelDAO reelDAO;
    private final CreatorRepository creatorRepository;
    private final CommentRepository commentRepository;
    private final ReelCollectionService collectionService;
    private final SlugService slugService;
    private final EntityDtoMapper mapper;

    /* ------------------------------------------------------------------ public */

    @Override
    public FeedDto feed(String cursor, int limit) {
        int size = Math.clamp(limit, 1, 20);
        var pageable = PageRequest.of(0, size);

        List<Reel> items;
        if (StringUtils.hasText(cursor)) {
            // The cursor is the id of the last reel the client saw. Resolving it to its
            // publishedAt and seeking from there keeps the query O(page size) no matter
            // how deep the reader has scrolled - unlike skip(), which walks and discards
            // every document before the offset.
            Reel last = reelRepository.findById(cursor).orElseThrow(() -> ApiException.badRequest("Unknown cursor"));
            items = reelRepository.findByStatusAndPublishedAtLessThanOrderByPublishedAtDesc(
                    ReelStatus.PUBLISHED, last.getPublishedAt(), pageable);
        } else {
            items = reelRepository.findByStatusOrderByPublishedAtDesc(ReelStatus.PUBLISHED, pageable);
        }

        // A full page means there is PROBABLY more; a short page proves there is not.
        // The client stops when nextCursor comes back null, so the worst case is one
        // extra request that returns nothing - much cheaper than counting the whole
        // collection on every feed load just to be exact.
        String nextCursor = items.size() == size ? items.get(items.size() - 1).getId() : null;
        return new FeedDto(mapper.toReelDtos(items), nextCursor);
    }

    @Override
    public ReelDto bySlug(String slug) {
        Reel reel = reelRepository.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Reel"));
        if (reel.getStatus() != ReelStatus.PUBLISHED) {
            // 404 rather than 403 on purpose: confirming that an unpublished slug exists
            // leaks the editorial pipeline to anyone who can guess a URL.
            throw ApiException.notFound("Reel");
        }
        return mapper.toDto(reel);
    }

    @Override
    public PageDto<ReelDto> publicSearch(String q, String tag, int page, int size) {
        var result = reelDAO.textSearch(q, tag, PageRequest.of(Math.max(0, page - 1), Math.clamp(size, 1, 48)));
        return toPageDto(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public List<String> trendingTags() {
        return reelDAO.trendingTags(8);
    }

    @Override
    public long like(String reelId, boolean liked) {
        Reel reel = reelRepository.findById(reelId).orElseThrow(() -> ApiException.notFound("Reel"));
        reelDAO.incrementStat(reelId, "likes", liked ? 1 : -1);
        return reel.getStats().getLikes() + (liked ? 1 : -1);
    }

    /* ------------------------------------------------------------------- admin */

    @Override
    public PageDto<ReelDto> adminSearch(String q, ReelStatus status, String creatorId, int page, int size) {
        var pageable = PageRequest.of(
                Math.max(0, page - 1), Math.clamp(size, 1, 100), Sort.by(Sort.Direction.DESC, "updatedAt"));
        var result = reelDAO.search(q, status, creatorId, pageable);
        return toPageDto(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public ReelDto adminById(String id) {
        return mapper.toDto(reelRepository.findById(id).orElseThrow(() -> ApiException.notFound("Reel")));
    }

    @Override
    public ReelDto create(ReelRequest request, AuthPrincipal actor) {
        Creator creator = resolveCreator(request.creatorId(), actor);
        assertMayActAs(creator.getId(), actor);

        String slug = slugService.uniqueSlug(
                StringUtils.hasText(request.slug())
                        ? slugService.slugify(request.slug())
                        : slugService.slugify(request.title()),
                reelRepository::existsBySlug);

        ReelStatus status = request.status() == null ? ReelStatus.DRAFT : request.status();
        assertPublishable(status, request);

        Reel reel = Reel.builder()
                .slug(slug)
                .title(request.title())
                .description(request.description() == null ? "" : request.description())
                .status(status)
                .publishedAt(status == ReelStatus.PUBLISHED ? Timestamps.now() : null)
                .scheduledFor(Timestamps.toStorage(request.scheduledFor()))
                .video(mapper.toEntity(request.video()))
                .creator(mapper.toRef(creator))
                .tags(normalizeTags(request.tags()))
                .collectionIds(
                        request.collectionIds() == null ? new ArrayList<>() : new ArrayList<>(request.collectionIds()))
                .stats(ReelStats.builder().build())
                .build();

        Reel saved = reelRepository.save(reel);
        collectionService.syncMembership(saved.getId(), saved.getCollectionIds());
        return mapper.toDto(saved);
    }

    @Override
    public ReelDto update(String id, ReelRequest request, AuthPrincipal actor) {
        Reel reel = reelRepository.findById(id).orElseThrow(() -> ApiException.notFound("Reel"));
        assertMayActAs(reel.getCreator().getId(), actor);

        if (StringUtils.hasText(request.slug())) {
            String desired = slugService.slugify(request.slug());
            if (!desired.equals(reel.getSlug())) {
                reel.setSlug(slugService.uniqueSlug(desired, reelRepository::existsBySlug));
            }
        }

        ReelStatus status = request.status() == null ? reel.getStatus() : request.status();
        assertPublishable(status, request);

        reel.setTitle(request.title());
        reel.setDescription(request.description() == null ? "" : request.description());
        reel.setStatus(status);
        reel.setScheduledFor(Timestamps.toStorage(request.scheduledFor()));
        reel.setTags(normalizeTags(request.tags()));
        reel.setCollectionIds(
                request.collectionIds() == null ? new ArrayList<>() : new ArrayList<>(request.collectionIds()));
        if (request.video() != null) {
            reel.setVideo(mapper.toEntity(request.video()));
        }

        // Only an admin may reassign a reel to a different creator.
        if (StringUtils.hasText(request.creatorId())
                && !request.creatorId().equals(reel.getCreator().getId())) {
            if (!actor.isAdmin()) {
                throw ApiException.forbidden("Only an admin can reassign a reel to another creator.");
            }
            reel.setCreator(mapper.toRef(creatorRepository
                    .findById(request.creatorId())
                    .orElseThrow(() -> ApiException.notFound("Creator"))));
        }

        // publishedAt is set ONCE, the first time it goes live, and never moved after.
        // Re-stamping it on every save would reshuffle the feed each time an editor
        // fixed a typo.
        if (reel.getStatus() == ReelStatus.PUBLISHED && reel.getPublishedAt() == null) {
            reel.setPublishedAt(Timestamps.now());
        }

        Reel saved = reelRepository.save(reel);
        collectionService.syncMembership(saved.getId(), saved.getCollectionIds());
        return mapper.toDto(saved);
    }

    @Override
    public ReelDto setStatus(String id, StatusRequest request, AuthPrincipal actor) {
        Reel reel = reelRepository.findById(id).orElseThrow(() -> ApiException.notFound("Reel"));
        assertMayActAs(reel.getCreator().getId(), actor);

        if (request.status() == ReelStatus.PUBLISHED
                && (reel.getVideo() == null
                        || !StringUtils.hasText(reel.getVideo().getUrl()))) {
            throw ApiException.badRequest("Upload a video before publishing this reel.");
        }

        reel.setStatus(request.status());
        if (request.status() == ReelStatus.PUBLISHED && reel.getPublishedAt() == null) {
            reel.setPublishedAt(Timestamps.now());
        }
        return mapper.toDto(reelRepository.save(reel));
    }

    @Override
    public void delete(String id, AuthPrincipal actor) {
        Reel reel = reelRepository.findById(id).orElseThrow(() -> ApiException.notFound("Reel"));
        assertMayActAs(reel.getCreator().getId(), actor);

        // No cascade in MongoDB - referential integrity is the application's job. Miss
        // this and the comments become orphans that nothing will ever read or clean up.
        commentRepository.deleteByReelId(id);
        collectionService.removeReelFromAll(id);
        reelRepository.deleteById(id);
    }

    /**
     * Promotes SCHEDULED reels once their time arrives. Runs every minute, which is as precise as a
     * publishing schedule needs to be and cheap because the {status, ...} index makes the query a
     * seek rather than a scan.
     */
    @Scheduled(fixedDelayString = "PT1M")
    public void publishDueReels() {
        var due = reelRepository.findByStatusAndScheduledForLessThanEqual(ReelStatus.SCHEDULED, Timestamps.now());
        for (Reel reel : due) {
            if (reel.getVideo() == null || !StringUtils.hasText(reel.getVideo().getUrl())) {
                log.warn("Scheduled reel {} has no video; leaving it scheduled", reel.getSlug());
                continue;
            }
            reel.setStatus(ReelStatus.PUBLISHED);
            reel.setPublishedAt(Timestamps.now());
            reelRepository.save(reel);
            log.info("Published scheduled reel {}", reel.getSlug());
        }
    }

    /* ----------------------------------------------------------------- helpers */

    private Creator resolveCreator(String creatorId, AuthPrincipal actor) {
        String id = StringUtils.hasText(creatorId) ? creatorId : actor.creatorId();
        if (!StringUtils.hasText(id)) {
            throw ApiException.badRequest("A creator is required.");
        }
        return creatorRepository.findById(id).orElseThrow(() -> ApiException.notFound("Creator"));
    }

    /** A CREATOR acts only as themselves; an ADMIN acts as anyone. */
    private void assertMayActAs(String creatorId, AuthPrincipal actor) {
        if (!actor.isAdmin() && !actor.ownsCreator(creatorId)) {
            throw ApiException.forbidden("You can only manage your own reels.");
        }
    }

    private void assertPublishable(ReelStatus status, ReelRequest request) {
        if (status == ReelStatus.PUBLISHED
                && (request.video() == null
                        || !StringUtils.hasText(request.video().url()))) {
            throw ApiException.badRequest("Upload a video before publishing this reel.");
        }
        if (status == ReelStatus.SCHEDULED && request.scheduledFor() == null) {
            throw ApiException.badRequest("A scheduled reel needs a date.");
        }
    }

    /** Tags are slugified so "Buzzer Beater" and "buzzer-beater" cannot become two tags. */
    private List<String> normalizeTags(List<String> raw) {
        if (raw == null) {
            return new ArrayList<>();
        }
        return raw.stream()
                .map(slugService::slugify)
                .filter(StringUtils::hasText)
                .distinct()
                .limit(8)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }

    private PageDto<ReelDto> toPageDto(List<Reel> content, int page, int size, long total) {
        int totalPages = (int) Math.max(1, Math.ceil((double) total / Math.max(1, size)));
        return new PageDto<>(mapper.toReelDtos(content), page, size, total, totalPages);
    }
}
