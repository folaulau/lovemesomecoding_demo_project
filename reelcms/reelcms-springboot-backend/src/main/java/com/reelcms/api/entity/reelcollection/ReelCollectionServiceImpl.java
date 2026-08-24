package com.reelcms.api.entity.reelcollection;

import com.reelcms.api.dto.Dtos.CollectionDto;
import com.reelcms.api.dto.Dtos.CollectionPageDto;
import com.reelcms.api.dto.Dtos.CollectionRequest;
import com.reelcms.api.dto.EntityDtoMapper;
import com.reelcms.api.entity.reel.Reel;
import com.reelcms.api.entity.reel.ReelDAO;
import com.reelcms.api.entity.reel.ReelRepository;
import com.reelcms.api.entity.reel.ReelStatus;
import com.reelcms.api.entity.reel.SlugService;
import com.reelcms.api.exception.ApiException;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ReelCollectionServiceImpl implements ReelCollectionService {

    private final ReelCollectionRepository collectionRepository;
    private final ReelRepository reelRepository;
    private final ReelDAO reelDAO;
    private final SlugService slugService;
    private final EntityDtoMapper mapper;

    @Override
    public List<CollectionDto> list() {
        return collectionRepository.findAllByOrderByCreatedAtAsc().stream()
                .map(mapper::toDto)
                .toList();
    }

    @Override
    public CollectionPageDto bySlug(String slug) {
        ReelCollection collection =
                collectionRepository.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Collection"));

        // findByIdInAndStatus is one query for the whole set. Looping findById per id
        // would be a round trip each - the classic N+1, which a document store makes no
        // less expensive than a relational one.
        List<Reel> reels = collection.getReelIds().isEmpty()
                ? List.of()
                : reelRepository.findByIdInAndStatus(collection.getReelIds(), ReelStatus.PUBLISHED);

        return new CollectionPageDto(mapper.toDto(collection), mapper.toReelDtos(reels));
    }

    @Override
    public CollectionDto create(CollectionRequest request) {
        String slug = slugService.uniqueSlug(
                StringUtils.hasText(request.slug())
                        ? slugService.slugify(request.slug())
                        : slugService.slugify(request.name()),
                s -> collectionRepository.findBySlug(s).isPresent());

        return mapper.toDto(collectionRepository.save(ReelCollection.builder()
                .slug(slug)
                .name(request.name())
                .description(request.description() == null ? "" : request.description())
                .coverUrl(CoverFactory.forName(request.name()))
                .reelIds(new ArrayList<>())
                .build()));
    }

    @Override
    public CollectionDto update(String id, CollectionRequest request) {
        ReelCollection collection =
                collectionRepository.findById(id).orElseThrow(() -> ApiException.notFound("Collection"));

        if (StringUtils.hasText(request.slug())) {
            String desired = slugService.slugify(request.slug());
            if (!desired.equals(collection.getSlug())) {
                collection.setSlug(slugService.uniqueSlug(
                        desired, s -> collectionRepository.findBySlug(s).isPresent()));
            }
        }
        collection.setName(request.name());
        collection.setDescription(request.description() == null ? "" : request.description());
        return mapper.toDto(collectionRepository.save(collection));
    }

    @Override
    public void delete(String id) {
        if (!collectionRepository.existsById(id)) {
            throw ApiException.notFound("Collection");
        }
        // Both sides of the relationship have to be cleaned up. Deleting only the
        // collection leaves every reel pointing at an id that resolves to nothing -
        // there is no foreign key to stop you.
        reelDAO.pullCollectionId(id);
        collectionRepository.deleteById(id);
    }

    @Override
    public void syncMembership(String reelId, List<String> collectionIds) {
        // Membership is stored on both sides (see ReelCollection's class comment), so a
        // change on the reel has to be mirrored here. Rewriting both lists is fine at
        // this scale; a larger system would use $addToSet / $pull to avoid the read.
        for (ReelCollection collection : collectionRepository.findAll()) {
            boolean shouldContain = collectionIds != null && collectionIds.contains(collection.getId());
            boolean doesContain = collection.getReelIds().contains(reelId);

            if (shouldContain && !doesContain) {
                collection.getReelIds().add(reelId);
                collectionRepository.save(collection);
            } else if (!shouldContain && doesContain) {
                collection.getReelIds().remove(reelId);
                collectionRepository.save(collection);
            }
        }
    }

    @Override
    public void removeReelFromAll(String reelId) {
        for (ReelCollection collection : collectionRepository.findAll()) {
            if (collection.getReelIds().remove(reelId)) {
                collectionRepository.save(collection);
            }
        }
    }
}
